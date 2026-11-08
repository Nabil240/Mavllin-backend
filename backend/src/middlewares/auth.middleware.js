const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { sendError } = require('../utils/apiResponse');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, { statusCode: 401, message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    req.user = decoded; // { id, email, role }
    return next();
  } catch (_err) {
    return sendError(res, { statusCode: 401, message: 'Invalid or expired token' });
  }
}

function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    req.user = decoded;
    return next();
  } catch (_err) {
    return sendError(res, { statusCode: 401, message: 'Invalid or expired token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, { statusCode: 401, message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, {
        statusCode: 403,
        message: 'Access denied: insufficient permissions',
      });
    }

    return next();
  };
}

module.exports = {
  authenticate,
  requireAuth: authenticate,
  requireAdmin: requireRole('admin'),
  optionalAuthenticate,
  requireRole,
  authorize: requireRole,
};
