const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const { uploadAvatarImage } = require('../middlewares/upload.middleware');
const { authLimiter } = require('../middlewares/rateLimit.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// POST /api/v1/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    body('phone').optional().trim(),
    validateRequest,
  ],
  asyncHandler(AuthController.register)
);

// POST /api/v1/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validateRequest,
  ],
  asyncHandler(AuthController.login)
);

// GET /api/v1/auth/me
router.get('/me', authenticate, asyncHandler(AuthController.getMe));

// PUT /api/v1/auth/profile
router.put(
  '/profile',
  authenticate,
  [
    body('full_name').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
    body('phone').optional().trim(),
    validateRequest,
  ],
  asyncHandler(AuthController.updateProfile)
);

// PUT /api/v1/auth/change-password
router.put(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long'),
    validateRequest,
  ],
  asyncHandler(AuthController.changePassword)
);

// POST /api/v1/auth/avatar
router.post(
  '/avatar',
  authenticate,
  uploadAvatarImage.single('avatar'),
  asyncHandler(AuthController.uploadAvatar)
);

// POST /api/v1/auth/logout
router.post('/logout', asyncHandler(AuthController.logout));

// POST /api/v1/auth/forgot-password
router.post(
  '/forgot-password',
  authLimiter,
  [
    body('email').trim().isEmail().withMessage('Valid email is required'),
    validateRequest,
  ],
  asyncHandler(AuthController.forgotPassword)
);

// POST /api/v1/auth/reset-password
router.post(
  '/reset-password',
  authLimiter,
  [
    body('token').trim().notEmpty().withMessage('Reset token is required'),
    body('newPassword')
      .optional()
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long'),
    body('password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
    validateRequest,
  ],
  asyncHandler(AuthController.resetPassword)
);

module.exports = router;
