const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const UserModel = require('../models/user.model');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { sanitizeUser } = require('../utils/helpers');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.full_name },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

const AuthController = {
  async register(req, res) {
    const { full_name, email, password, phone } = req.body;

    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return sendError(res, { statusCode: 409, message: 'Email is already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await UserModel.create({
      full_name,
      email,
      password_hash,
      phone: phone || null,
      role: 'customer',
    });

    const token = generateToken(user);

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Account registered successfully',
      data: {
        user: sanitizeUser(user),
        token,
      },
    });
  },

  async login(req, res) {
    const { email, password } = req.body;

    const user = await UserModel.findByEmail(email);
    if (!user) {
      return sendError(res, { statusCode: 401, message: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return sendError(res, { statusCode: 403, message: 'This account has been deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return sendError(res, { statusCode: 401, message: 'Invalid email or password' });
    }

    const token = generateToken(user);

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Login successful',
      data: {
        user: sanitizeUser(user),
        token,
      },
    });
  },

  async getMe(req, res) {
    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return sendError(res, { statusCode: 404, message: 'User not found' });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'User profile retrieved',
      data: sanitizeUser(user),
    });
  },

  async updateProfile(req, res) {
    const { full_name, phone } = req.body;
    const updated = await UserModel.update(req.user.id, { full_name, phone });

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Profile updated successfully',
      data: sanitizeUser(updated),
    });
  },

  async changePassword(req, res) {
    const { currentPassword, newPassword } = req.body;

    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return sendError(res, { statusCode: 404, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return sendError(res, { statusCode: 400, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await UserModel.update(req.user.id, { password_hash });

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Password changed successfully',
    });
  },

  async uploadAvatar(req, res) {
    if (!req.file) {
      return sendError(res, { statusCode: 400, message: 'Please upload an image file' });
    }

    const avatar_url = `/uploads/avatars/${req.file.filename}`;
    const user = await UserModel.update(req.user.id, { avatar_url });

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Avatar uploaded successfully',
      data: {
        avatar_url,
        user: sanitizeUser(user),
      },
    });
  },

  async logout(_req, res) {
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Logged out successfully',
    });
  },

  async forgotPassword(req, res) {
    const { email } = req.body;
    const user = await UserModel.findByEmail(email);

    if (!user) {
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Password reset instructions sent',
        data: {},
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await UserModel.update(user.id, {
      reset_token_hash: resetTokenHash,
      reset_token_expires_at: expiresAt,
    });

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Password reset instructions sent',
      data: {
        reset_token: resetToken,
      },
    });
  },

  async resetPassword(req, res) {
    const { token, newPassword, password } = req.body;
    const targetPassword = newPassword || password;

    if (!token || !targetPassword) {
      return sendError(res, { statusCode: 400, message: 'Reset token and new password are required' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await UserModel.findByResetTokenHash(tokenHash);

    if (!user) {
      return sendError(res, { statusCode: 400, message: 'Invalid or expired password reset token' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(targetPassword, salt);

    await UserModel.update(user.id, {
      password_hash,
      reset_token_hash: null,
      reset_token_expires_at: null,
    });

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Password has been reset successfully',
    });
  },
};

module.exports = AuthController;
