const crypto = require('crypto');
const MessagingModel = require('../models/messaging.model');
const { getAdapter } = require('../services/messaging-adapters/adapter.factory');
const aiMessagingService = require('../services/ai-messaging.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const env = require('../config/env');

function verifyMetaHmacSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  try {
    const [algorithm, signatureHash] = signatureHeader.split('=');
    if (algorithm !== 'sha256' || !signatureHash) return false;

    let payload;
    if (Buffer.isBuffer(rawBody)) {
      payload = rawBody;
    } else if (typeof rawBody === 'string') {
      payload = Buffer.from(rawBody, 'utf8');
    } else {
      payload = Buffer.from(JSON.stringify(rawBody || {}), 'utf8');
    }

    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    const signatureBuf = Buffer.from(signatureHash, 'utf8');
    const expectedBuf = Buffer.from(expectedHash, 'utf8');

    if (signatureBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(signatureBuf, expectedBuf);
  } catch (_e) {
    return false;
  }
}

const MessagingController = {
  /**
   * Helper to verify HMAC-SHA256 signature for Meta webhooks
   */
  verifyWebhookSignature(req, channel) {
    const signatureHeader = req.headers['x-hub-signature-256'] || req.headers['x-hub-signature'];
    const appSecret =
      channel === 'whatsapp'
        ? (env.messaging.whatsappAppSecret || env.messaging.fbAppSecret || process.env.WHATSAPP_APP_SECRET || process.env.FB_APP_SECRET)
        : (env.messaging.fbAppSecret || process.env.FB_APP_SECRET);

    // If client provided a signature header, always verify it
    if (signatureHeader) {
      const secretToUse =
        appSecret ||
        (env.messaging.mode === 'mock' || env.nodeEnv !== 'production' || process.env.NODE_ENV === 'test'
          ? 'test_fb_app_secret'
          : '');
      if (!secretToUse) return false;
      return verifyMetaHmacSignature(req.rawBody || req.body, signatureHeader, secretToUse);
    }

    // In live mode with configured secret, signature header is strictly mandatory
    if (env.messaging.mode === 'live' && appSecret) {
      return false;
    }

    // In mock/test/dev mode without signature header, allow pass-through
    return true;
  },

  /**
   * Express middleware to validate webhook HMAC signature
   */
  validateWebhookSignatureMiddleware(req, res, next) {
    const { channel } = req.params;
    if (channel !== 'facebook' && channel !== 'whatsapp') {
      return sendError(res, { statusCode: 400, message: 'Invalid channel' });
    }
    if (!MessagingController.verifyWebhookSignature(req, channel)) {
      return sendError(res, { statusCode: 401, message: 'Invalid or missing webhook signature' });
    }
    next();
  },

  /**
   * GET /api/v1/messaging/webhook/:channel
   * Meta Webhook verification handshake
   */
  async verifyWebhook(req, res) {
    const { channel } = req.params;
    if (channel !== 'facebook' && channel !== 'whatsapp') {
      return res.status(400).send('Invalid channel');
    }

    const adapter = getAdapter(channel);
    const challenge = adapter.verifyWebhook(req.query);

    if (challenge) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification token mismatch');
  },

  /**
   * POST /api/v1/messaging/webhook/:channel
   * Inbound message ingestion & asynchronous AI auto-response
   */
  async handleInboundWebhook(req, res) {
    const { channel } = req.params;
    if (channel !== 'facebook' && channel !== 'whatsapp') {
      return sendError(res, { statusCode: 400, message: 'Invalid channel' });
    }

    // Defense-in-depth: verify webhook signature if not already verified by middleware
    if (!MessagingController.verifyWebhookSignature(req, channel)) {
      return sendError(res, { statusCode: 401, message: 'Invalid or missing webhook signature' });
    }

    const adapter = getAdapter(channel);
    const incomingMessages = adapter.parseInboundWebhook(req.body);

    // Meta expects 200 OK immediately
    res.status(200).json({ status: 'EVENT_RECEIVED', count: incomingMessages.length });

    // Process messages asynchronously
    for (const msg of incomingMessages) {
      try {
        const conversation = await MessagingModel.findOrCreateConversation({
          channel,
          external_sender_id: msg.externalSenderId,
          customer_name: msg.customerName,
          customer_phone: msg.customerPhone,
        });

        await MessagingModel.createMessage({
          conversation_id: conversation.id,
          direction: 'inbound',
          sender_type: 'customer',
          content: msg.text,
          raw_payload: msg.rawPayload,
        });

        // Trigger AI auto-reply if enabled
        if (conversation.is_ai_enabled) {
          const aiResult = await aiMessagingService.generateReply({
            text: msg.text,
            channel,
            customerName: conversation.customer_name,
          });

          // Send outbound reply via adapter
          await adapter.sendTextMessage({
            recipientId: msg.externalSenderId,
            text: aiResult.text,
          });

          // Save AI outbound message
          await MessagingModel.createMessage({
            conversation_id: conversation.id,
            direction: 'outbound',
            sender_type: 'ai',
            content: aiResult.text,
            raw_payload: { ai_generated: true },
          });

          // If escalation triggered, disable AI on this conversation
          if (aiResult.shouldEscalate) {
            await MessagingModel.toggleAi(conversation.id, false);
          }
        }
      } catch (err) {
        console.error('[MessagingWebhook] Error processing inbound message:', err);
      }
    }
  },

  /**
   * GET /api/v1/admin/messaging/conversations
   */
  async getConversations(req, res) {
    const { channel = 'all', search = null, limit = 20, offset = 0 } = req.query;
    const result = await MessagingModel.getConversations({ channel, search, limit, offset });
    return sendSuccess(res, {
      message: 'Conversations retrieved successfully',
      data: result.conversations,
      meta: { total: result.total, limit: result.limit, offset: result.offset },
    });
  },

  /**
   * GET /api/v1/admin/messaging/conversations/:id/messages
   */
  async getMessages(req, res) {
    const conversationId = Number(req.params.id);
    const conversation = await MessagingModel.getConversationById(conversationId);
    if (!conversation) {
      return sendError(res, { statusCode: 404, message: 'Conversation not found' });
    }

    const { limit = 50, offset = 0 } = req.query;
    const messages = await MessagingModel.getMessagesByConversationId(conversationId, { limit, offset });

    // Mark unread as read
    await MessagingModel.markAsRead(conversationId);

    // Provide messages as primary data array while attaching conversation metadata
    return sendSuccess(res, {
      message: 'Messages retrieved successfully',
      data: messages,
      meta: {
        conversation,
      },
    });
  },

  /**
   * POST /api/v1/admin/messaging/conversations/:id/reply
   */
  async replyConversation(req, res) {
    const conversationId = Number(req.params.id);
    const content = req.body.content || req.body.message;

    if (!content || !content.trim()) {
      return sendError(res, { statusCode: 400, message: 'Message content is required' });
    }

    const conversation = await MessagingModel.getConversationById(conversationId);
    if (!conversation) {
      return sendError(res, { statusCode: 404, message: 'Conversation not found' });
    }

    const adapter = getAdapter(conversation.channel);

    // Send via channel adapter
    const sendResult = await adapter.sendTextMessage({
      recipientId: conversation.external_sender_id,
      text: content.trim(),
    });

    // Save outbound message
    const message = await MessagingModel.createMessage({
      conversation_id: conversationId,
      direction: 'outbound',
      sender_type: 'admin',
      content: content.trim(),
      raw_payload: sendResult,
    });

    const updatedConv = await MessagingModel.getConversationById(conversationId);

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Reply sent successfully',
      data: {
        message,
        conversation: updatedConv,
      },
    });
  },

  /**
   * PATCH /api/v1/admin/messaging/conversations/:id/toggle-ai
   */
  async toggleAi(req, res) {
    const conversationId = Number(req.params.id);
    const conversation = await MessagingModel.getConversationById(conversationId);
    if (!conversation) {
      return sendError(res, { statusCode: 404, message: 'Conversation not found' });
    }

    let targetState;
    if (req.body && typeof req.body.is_ai_enabled === 'boolean') {
      targetState = req.body.is_ai_enabled;
    } else if (req.body && typeof req.body.ai_enabled === 'boolean') {
      targetState = req.body.ai_enabled;
    } else {
      targetState = !conversation.is_ai_enabled;
    }

    const updated = await MessagingModel.toggleAi(conversationId, targetState);
    return sendSuccess(res, {
      message: `AI auto-reply ${updated.is_ai_enabled ? 'enabled' : 'disabled'} successfully`,
      data: updated,
    });
  },

  /**
   * PATCH /api/v1/admin/messaging/conversations/:id/read
   */
  async markAsRead(req, res) {
    const conversationId = Number(req.params.id);
    const conversation = await MessagingModel.getConversationById(conversationId);
    if (!conversation) {
      return sendError(res, { statusCode: 404, message: 'Conversation not found' });
    }

    await MessagingModel.markAsRead(conversationId);
    return sendSuccess(res, {
      message: 'Conversation marked as read',
      data: { id: conversationId, unread_count: 0 },
    });
  },
};

module.exports = MessagingController;
