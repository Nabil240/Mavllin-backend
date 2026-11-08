const { sendError } = require('../utils/apiResponse');
const env = require('../config/env');

function notFoundHandler(req, res, _next) {
  return sendError(res, {
    statusCode: 404,
    message: `Cannot ${req.method} ${req.originalUrl} - Route Not Found`,
  });
}

function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal Server Error';
  let errors = Array.isArray(err.errors) ? err.errors : null;

  // Intercept body-parser SyntaxError (e.g. malformed JSON body)
  if (err instanceof SyntaxError && (err.status === 400 || statusCode === 400) && 'body' in err) {
    statusCode = 400;
    message = 'Malformed JSON payload in request body';
    errors = null;
  }

  // Intercept MySQL Database Errors
  if (err.code) {
    switch (err.code) {
      case 'ER_DUP_ENTRY':
        statusCode = 409;
        message = 'A record with duplicate unique value already exists';
        break;
      case 'ER_NO_REFERENCED_ROW_2':
        statusCode = 400;
        message = 'Referenced entity does not exist';
        break;
      case 'ECONNREFUSED':
      case 'PROTOCOL_CONNECTION_LOST':
        statusCode = 503;
        message = 'Database service temporarily unavailable';
        break;
    }
  }

  // Intercept JWT Errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  // Intercept Multer Errors
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Uploaded file exceeds the maximum allowed size';
    } else {
      message = `File upload error: ${err.message}`;
    }
  }

  // Sanitize internal details from message (prevent leakage of passwords, paths, SQL)
  if (
    statusCode >= 500 ||
    message.includes('node_modules') ||
    message.includes('password') ||
    message.includes('mysql2')
  ) {
    if (env.nodeEnv === 'production' || statusCode === 500) {
      message = 'An unexpected error occurred. Please try again later.';
      errors = null;
    }
  }

  if (statusCode >= 500) {
    console.error(`[Server Error 500] ${req.method} ${req.originalUrl}:`, err);
  } else {
    console.warn(`[Client Error ${statusCode}] ${req.method} ${req.originalUrl}: ${message}`);
  }

  const responsePayload = {
    statusCode,
    message,
    errors,
  };

  // Stack trace only in development for 500 errors as a top-level property
  if (env.nodeEnv === 'development' && statusCode === 500) {
    responsePayload.stack = err.stack;
  }

  return sendError(res, responsePayload);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
