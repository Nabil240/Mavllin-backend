const BaseMessagingAdapter = require('./base.adapter');
const env = require('../../config/env');

class WhatsAppAdapter extends BaseMessagingAdapter {
  constructor(config = {}) {
    super('whatsapp');
    this.verifyToken = config.verifyToken || env.messaging.whatsappVerifyToken;
    this.accessToken = config.accessToken || env.messaging.whatsappAccessToken;
    this.phoneNumberId = config.phoneNumberId || env.messaging.whatsappPhoneNumberId;
    this.graphApiUrl =
      config.graphApiUrl ||
      `https://graph.facebook.com/v20.0/${this.phoneNumberId}/messages`;
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
    if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body?.entry)) {
      return messages;
    }

    for (const entry of body.entry) {
      if (!Array.isArray(entry.changes)) continue;
      for (const change of entry.changes) {
        const val = change.value;
        if (!val || !Array.isArray(val.messages)) continue;

        const contactsMap = {};
        if (Array.isArray(val.contacts)) {
          for (const c of val.contacts) {
            if (c.wa_id) contactsMap[c.wa_id] = c.profile?.name || null;
          }
        }

        for (const msg of val.messages) {
          if (msg.type === 'text' && msg.text?.body) {
            const senderPhone = String(msg.from || '');
            messages.push({
              channel: 'whatsapp',
              externalSenderId: senderPhone,
              text: msg.text.body,
              customerName: contactsMap[senderPhone] || null,
              customerPhone: senderPhone.startsWith('+') ? senderPhone : `+${senderPhone}`,
              rawPayload: msg,
            });
          }
        }
      }
    }
    return messages;
  }

  async sendTextMessage({ recipientId, text, metadata = {} }) {
    if (!this.accessToken || !this.phoneNumberId) {
      console.warn('[WhatsAppAdapter] Missing WHATSAPP credentials; logging outbound message instead.');
      return { success: true, messageId: `wa_sim_${Date.now()}`, simulated: true };
    }

    const cleanTo = String(recipientId).replace(/[^\d]/g, '');

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanTo,
      type: 'text',
      text: { preview_url: false, body: text },
    };

    const res = await fetch(this.graphApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      const errMessage = data?.error?.message || res.statusText;
      throw new Error(`[WhatsAppAdapter] WhatsApp Cloud API failed (${res.status}): ${errMessage}`);
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id || `wa_${Date.now()}`,
      raw: data,
    };
  }
}

module.exports = WhatsAppAdapter;
