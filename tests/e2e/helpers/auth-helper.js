const crypto = require('node:crypto');

const DEFAULT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';

function base64UrlEncode(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function generateTestToken(payload, secret = DEFAULT_SECRET, expiresInSec = 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSec,
  };

  const headerEncoded = base64UrlEncode(header);
  const payloadEncoded = base64UrlEncode(fullPayload);
  const data = `${headerEncoded}.${payloadEncoded}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${data}.${signature}`;
}

function getAdminToken(secret = DEFAULT_SECRET) {
  return generateTestToken({ id: 1, email: 'admin@projecteco.com', role: 'admin' }, secret);
}

function getCustomerToken(secret = DEFAULT_SECRET) {
  return generateTestToken({ id: 2, email: 'customer@projecteco.com', role: 'customer' }, secret);
}

function getExpiredAdminToken(secret = DEFAULT_SECRET) {
  return generateTestToken({ id: 1, email: 'admin@projecteco.com', role: 'admin' }, secret, -3600);
}

function getInvalidSecretToken() {
  return generateTestToken({ id: 1, email: 'admin@projecteco.com', role: 'admin' }, 'invalid_tampered_secret_key');
}

module.exports = {
  DEFAULT_SECRET,
  generateTestToken,
  getAdminToken,
  getCustomerToken,
  getExpiredAdminToken,
  getInvalidSecretToken,
};
