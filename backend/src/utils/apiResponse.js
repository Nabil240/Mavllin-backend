function sendSuccess(res, { statusCode = 200, message = 'Success', data = null, meta = null }) {
  const payload = { success: true, message, data };
  if (meta) payload.meta = meta;
  return res.status(statusCode).json(payload);
}

function sendError(res, { statusCode = 500, message = 'Internal Server Error', errors = null, stack = null }) {
  const payload = { success: false, message };
  if (errors !== null && errors !== undefined) {
    payload.errors = errors;
  }
  if (stack) {
    payload.stack = stack;
  }
  return res.status(statusCode).json(payload);
}

module.exports = { sendSuccess, sendError };
