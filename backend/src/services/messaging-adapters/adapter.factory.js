const FacebookAdapter = require('./facebook.adapter');
const WhatsAppAdapter = require('./whatsapp.adapter');
const MockAdapter = require('./mock.adapter');
const env = require('../../config/env');

const SUPPORTED_CHANNELS = ['facebook', 'whatsapp', 'mock'];

const instances = {
  facebook: null,
  whatsapp: null,
  mock: new MockAdapter('mock'),
};

function getAdapter(channel) {
  if (!channel || !SUPPORTED_CHANNELS.includes(channel)) {
    throw new Error(`Unsupported messaging channel: ${channel}`);
  }

  const mode = env.messaging.mode;

  if (mode === 'mock' || process.env.NODE_ENV === 'test') {
    const key = `mock_${channel}`;
    if (!instances[key]) {
      instances[key] = channel === 'mock' ? instances.mock : new MockAdapter(channel);
    }
    return instances[key];
  }

  if (channel === 'facebook') {
    if (!instances.facebook) {
      instances.facebook = new FacebookAdapter();
    }
    return instances.facebook;
  }

  if (channel === 'whatsapp') {
    if (!instances.whatsapp) {
      instances.whatsapp = new WhatsAppAdapter();
    }
    return instances.whatsapp;
  }

  if (channel === 'mock') {
    return instances.mock;
  }

  throw new Error(`Unsupported messaging channel: ${channel}`);
}

module.exports = {
  getAdapter,
  MockAdapter,
  instances,
  SUPPORTED_CHANNELS,
};
