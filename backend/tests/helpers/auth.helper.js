const jwt = require('jsonwebtoken');
const env = require('../../src/config/env');

function getAdminToken(payload = {}) {
  return jwt.sign(
    {
      id: 1,
      email: 'admin@mavllin.com',
      role: 'admin',
      ...payload,
    },
    env.jwt.secret,
    { expiresIn: '1h' }
  );
}

function getCustomerToken(payload = {}) {
  return jwt.sign(
    {
      id: 2,
      email: 'customer@mavllin.com',
      role: 'customer',
      ...payload,
    },
    env.jwt.secret,
    { expiresIn: '1h' }
  );
}

module.exports = {
  getAdminToken,
  getCustomerToken,
};
