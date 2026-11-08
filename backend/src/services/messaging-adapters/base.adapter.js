/**
 * BaseMessagingAdapter
 * Abstract contract defining required adapter capabilities.
 */
class BaseMessagingAdapter {
  constructor(channel) {
    if (!channel) throw new Error('Channel name is required for messaging adapter');
    this.channel = channel;
  }

  /**
   * Verify webhook challenge from Meta.
   * @param {Object} query - Express req.query
   * @returns {string|null} - Challenge token if valid, null otherwise
   */
  verifyWebhook(_query) {
    throw new Error(`verifyWebhook must be implemented by ${this.constructor.name}`);
  }

  /**
   * Parse inbound webhook payload into normalized message array.
   * @param {Object} body - Express req.body
   * @returns {Array<{ channel: string, externalSenderId: string, text: string, customerName?: string, customerPhone?: string, rawPayload: any }>}
   */
  parseInboundWebhook(_body) {
    throw new Error(`parseInboundWebhook must be implemented by ${this.constructor.name}`);
  }

  /**
   * Send outbound text message to external user.
   * @param {Object} params - { recipientId: string, text: string, metadata?: Object }
   * @returns {Promise<{ success: boolean, messageId?: string, raw?: any }>}
   */
  async sendTextMessage(_params) {
    throw new Error(`sendTextMessage must be implemented by ${this.constructor.name}`);
  }
}

module.exports = BaseMessagingAdapter;
