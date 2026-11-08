const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/apiResponse');

const shouldSkip = (req) => {
  if (process.env.TEST_RATE_LIMIT === 'true' || (req && req.headers && req.headers['x-test-rate-limit'])) {
    return false;
  }
  return process.env.NODE_ENV === 'test';
};

// Tier A: Global API limiter (300 requests per 15 min)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => shouldSkip(req) || req.path === '/health' || (req.originalUrl && req.originalUrl.includes('/health')),
  handler: (_req, res) => {
    return sendError(res, {
      statusCode: 429,
      message: 'Too many requests from this IP, please try again after 15 minutes.',
    });
  },
});

// Tier B: Strict Auth limiter (20 requests per 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => shouldSkip(req),
  handler: (_req, res) => {
    return sendError(res, {
      statusCode: 429,
      message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
    });
  },
});

// Tier C: Search limiter (60 requests per 1 min)
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => shouldSkip(req),
  handler: (_req, res) => {
    return sendError(res, {
      statusCode: 429,
      message: 'Too many search requests from this IP, please slow down.',
    });
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  searchLimiter,
};
