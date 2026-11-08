const BaseMessagingAdapter = require('./base.adapter');
const env = require('../../config/env');

class MockAdapter extends BaseMessagingAdapter {
  constructor(channel = 'mock') {
    super(channel);
    this.sentMessages = [];
  }

  verifyWebhook(query) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    const expectedToken =
      this.channel === 'whatsapp'
        ? env.messaging.whatsappVerifyToken
        : env.messaging.fbVerifyToken;

    if (mode === 'subscribe' && token === expectedToken) {
      return challenge;
    }
    return null;
  }

  parseInboundWebhook(body) {
    // 1. If payload is standard Meta FB structure
    if (body?.object === 'page' && Array.isArray(body?.entry)) {
      const messages = [];
      for (const entry of body.entry) {
        for (const evt of entry.messaging || []) {
          if (evt.message && !evt.message.is_echo && evt.message.text) {
            messages.push({
              channel: this.channel === 'mock' ? 'facebook' : this.channel,
              externalSenderId: String(evt.sender?.id || 'mock_fb_user_1'),
              text: evt.message.text,
              customerName: 'Mock FB Customer',
              customerPhone: null,
              rawPayload: evt,
            });
          }
        }
      }
      return messages;
    }

    // 2. If payload is standard Meta WA structure
    if (body?.object === 'whatsapp_business_account' && Array.isArray(body?.entry)) {
      const messages = [];
      for (const entry of body.entry) {
        for (const change of entry.changes || []) {
          for (const msg of change.value?.messages || []) {
            if (msg.type === 'text' && msg.text?.body) {
              messages.push({
                channel: this.channel === 'mock' ? 'whatsapp' : this.channel,
                externalSenderId: String(msg.from || '8801711000000'),
                text: msg.text.body,
                customerName: 'Mock WA Customer',
                customerPhone: `+${msg.from || '8801711000000'}`,
                rawPayload: msg,
              });
            }
          }
        }
      }
      return messages;
    }

    // 3. Direct test synthetic payload format
    if (body?.external_sender_id && body?.text) {
      return [
        {
          channel: this.channel,
          externalSenderId: String(body.external_sender_id),
          text: String(body.text),
          customerName: body.customer_name || 'Test User',
          customerPhone: body.customer_phone || null,
          rawPayload: body,
        },
      ];
    }

    return [];
  }

  async sendTextMessage({ recipientId, text, metadata = {} }) {
    const record = {
      id: `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      channel: this.channel,
      recipientId: String(recipientId),
      text: String(text),
      metadata,
      sentAt: new Date().toISOString(),
    };
    this.sentMessages.push(record);

    return {
      success: true,
      messageId: record.id,
      mock: true,
      data: record,
    };
  }

  getSentMessages() {
    return [...this.sentMessages];
  }

  getLastSentMessage() {
    return this.sentMessages[this.sentMessages.length - 1] || null;
  }

  clear() {
    this.sentMessages = [];
  }
}

module.exports = MockAdapter;
