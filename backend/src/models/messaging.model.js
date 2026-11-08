const { pool } = require('../config/db');

const MessagingModel = {
  /**
   * Find an existing conversation or create a new one.
   * If customer name or phone is provided and previously null, updates them.
   */
  async findOrCreateConversation({ channel, external_sender_id, customer_name = null, customer_phone = null }) {
    const [existing] = await pool.query(
      `SELECT * FROM messaging_conversations WHERE channel = ? AND external_sender_id = ? LIMIT 1`,
      [channel, external_sender_id]
    );

    if (existing && existing.length > 0) {
      const conv = existing[0];
      const updates = [];
      const params = [];

      if (!conv.customer_name && customer_name) {
        updates.push('customer_name = ?');
        params.push(customer_name);
      }
      if (!conv.customer_phone && customer_phone) {
        updates.push('customer_phone = ?');
        params.push(customer_phone);
      }

      if (updates.length > 0) {
        params.push(conv.id);
        await pool.query(
          `UPDATE messaging_conversations SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
        return this.getConversationById(conv.id);
      }
      return conv;
    }

    const [insertResult] = await pool.query(
      `INSERT INTO messaging_conversations 
        (channel, external_sender_id, customer_name, customer_phone, is_ai_enabled, unread_count, last_message_at)
       VALUES (?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP)`,
      [channel, external_sender_id, customer_name, customer_phone]
    );

    return this.getConversationById(insertResult.insertId);
  },

  /**
   * Get single conversation by primary ID.
   */
  async getConversationById(id) {
    const [rows] = await pool.query(
      `SELECT * FROM messaging_conversations WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * List conversations with filtering, search, and pagination.
   */
  async getConversations({ channel = 'all', search = null, limit = 20, offset = 0 } = {}) {
    const conditions = [];
    const params = [];

    if (channel && channel !== 'all') {
      conditions.push('channel = ?');
      params.push(channel);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push('(customer_name LIKE ? OR customer_phone LIKE ? OR external_sender_id LIKE ? OR last_message_text LIKE ?)');
      params.push(term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const queryParams = [...params, Number(limit), Number(offset)];

    const [rows] = await pool.query(
      `SELECT * FROM messaging_conversations
       ${whereClause}
       ORDER BY last_message_at DESC
       LIMIT ? OFFSET ?`,
      queryParams
    );

    // Count query for pagination meta
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM messaging_conversations ${whereClause}`,
      params
    );

    return {
      conversations: rows,
      total: countRows[0]?.total || 0,
      limit: Number(limit),
      offset: Number(offset),
    };
  },

  /**
   * Append a message to a conversation and update conversation metadata.
   */
  async createMessage({ conversation_id, direction, sender_type, content, raw_payload = null }) {
    const payloadJson = raw_payload ? JSON.stringify(raw_payload) : null;

    const [result] = await pool.query(
      `INSERT INTO messaging_messages 
        (conversation_id, direction, sender_type, content, raw_payload)
       VALUES (?, ?, ?, ?, ?)`,
      [conversation_id, direction, sender_type, content, payloadJson]
    );

    const messageId = result.insertId;

    // Update conversation last_message_text, last_message_at, and unread_count
    const unreadDelta = direction === 'inbound' ? 1 : 0;
    await pool.query(
      `UPDATE messaging_conversations
       SET last_message_text = ?,
           last_message_at = CURRENT_TIMESTAMP,
           unread_count = unread_count + ?
       WHERE id = ?`,
      [content, unreadDelta, conversation_id]
    );

    return this.getMessageById(messageId);
  },

  /**
   * Get single message by ID.
   */
  async getMessageById(id) {
    const [rows] = await pool.query(
      `SELECT * FROM messaging_messages WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows[0]) return null;
    if (typeof rows[0].raw_payload === 'string') {
      try {
        rows[0].raw_payload = JSON.parse(rows[0].raw_payload);
      } catch (_e) {
        // preserve as string
      }
    }
    return rows[0];
  },

  /**
   * Retrieve message history for a conversation.
   */
  async getMessagesByConversationId(conversationId, { limit = 50, offset = 0 } = {}) {
    const [rows] = await pool.query(
      `SELECT * FROM messaging_messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC
       LIMIT ? OFFSET ?`,
      [conversationId, Number(limit), Number(offset)]
    );

    return rows.map((row) => {
      if (typeof row.raw_payload === 'string') {
        try {
          row.raw_payload = JSON.parse(row.raw_payload);
        } catch (_e) {
          // preserve
        }
      }
      return row;
    });
  },

  /**
   * Reset conversation unread counter upon admin view.
   */
  async markAsRead(conversationId) {
    await pool.query(
      `UPDATE messaging_conversations SET unread_count = 0 WHERE id = ?`,
      [conversationId]
    );
  },

  /**
   * Toggle AI auto-reply on/off for human takeover.
   */
  async toggleAi(conversationId, is_ai_enabled) {
    const flag = is_ai_enabled ? 1 : 0;
    await pool.query(
      `UPDATE messaging_conversations SET is_ai_enabled = ? WHERE id = ?`,
      [flag, conversationId]
    );
    return this.getConversationById(conversationId);
  },
};

module.exports = MessagingModel;
