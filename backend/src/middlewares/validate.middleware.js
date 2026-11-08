const { validationResult } = require('express-validator');
const { sendError } = require('../utils/apiResponse');

function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, {
      statusCode: 422,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
      })),
    });
  }
  return next();
}

module.exports = { validateRequest };
