const BaseMessagingAdapter = require('./base.adapter');
const env = require('../../config/env');

class FacebookAdapter extends BaseMessagingAdapter {
  constructor(config = {}) {
    super('facebook');
    this.verifyToken = config.verifyToken || env.messaging.fbVerifyToken;
    this.pageAccessToken = config.pageAccessToken || env.messaging.fbPageAccessToken;
    this.graphApiUrl = config.graphApiUrl || 'https://graph.facebook.com/v20.0/me/messages';
  }

  verifyWebhook(query) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    if (mode === 'subscribe' && token === this.verifyToken) {
      return challenge;
    }
    return null;
  }

  parseInboundWebhook(body) {
    const messages = [];
    if (body?.object !== 'page' || !Array.isArray(body?.entry)) {
      return messages;
    }

    for (const entry of body.entry) {
      if (!Array.isArray(entry.messaging)) continue;
      for (const event of entry.messaging) {
        // Ignore echo messages sent by our own page
        if (event.message && !event.message.is_echo && event.message.text) {
          messages.push({
            channel: 'facebook',
            externalSenderId: String(event.sender?.id || ''),
            text: event.message.text,
            customerName: null,
            customerPhone: null,
            rawPayload: event,
          });
        }
      }
    }
    return messages;
  }

  async sendTextMessage({ recipientId, text, metadata = {} }) {
    if (!this.pageAccessToken) {
      console.warn('[FacebookAdapter] Missing FB_PAGE_ACCESS_TOKEN; logging outbound message instead.');
      return { success: true, messageId: `fb_sim_${Date.now()}`, simulated: true };
    }

    const payload = {
      recipient: { id: recipientId },
      messaging_type: 'RESPONSE',
      message: { text },
    };

    const res = await fetch(this.graphApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.pageAccessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      const errMessage = data?.error?.message || res.statusText;
      throw new Error(`[FacebookAdapter] Meta Send API failed (${res.status}): ${errMessage}`);
    }

    return {
      success: true,
      messageId: data.message_id || `fb_${Date.now()}`,
      raw: data,
    };
  }
}

module.exports = FacebookAdapter;
