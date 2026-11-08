const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdapter } = require('../src/services/messaging-adapters/adapter.factory');
const { getAdminToken } = require('./helpers/auth.helper');

describe('Milestone 2: Unified Messaging Platform & Adapters (R4)', () => {
  let adminToken;
  const mockAdapter = getAdapter('facebook');

  before(async () => {
    adminToken = getAdminToken();
  });

  beforeEach(() => {
    mockAdapter.clear();
  });

  it('verifies Meta webhook handshake via GET /api/v1/messaging/webhook/facebook', async () => {
    const res = await request(app)
      .get('/api/v1/messaging/webhook/facebook')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'mavllin_fb_verify_token_2026',
        'hub.challenge': 'CHALLENGE_ACCEPTED_7749',
      });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.text, 'CHALLENGE_ACCEPTED_7749');
  });

  it('rejects invalid webhook verify token with 403', async () => {
    const res = await request(app)
      .get('/api/v1/messaging/webhook/facebook')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': 'CHALLENGE_XYZ',
      });

    assert.strictEqual(res.statusCode, 403);
  });

  it('processes inbound message, creates conversation, and auto-replies with AI', async () => {
    const senderId = `fb_cust_${Date.now()}`;
    const payload = {
      object: 'page',
      entry: [
        {
          messaging: [
            {
              sender: { id: senderId },
              message: { text: 'Hello, what are your delivery charges?' },
            },
          ],
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/messaging/webhook/facebook')
      .send(payload);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'EVENT_RECEIVED');

    // Give asynchronous AI worker a short tick
    await new Promise((r) => setTimeout(r, 100));

    // Verify conversation was created
    const [convRows] = await pool.query(
      'SELECT * FROM messaging_conversations WHERE external_sender_id = ?',
      [senderId]
    );
    assert.strictEqual(convRows.length, 1);
    const conv = convRows[0];
    assert.strictEqual(conv.channel, 'facebook');
    assert.strictEqual(conv.is_ai_enabled, 1);

    // Verify outbound reply was dispatched via mock adapter
    const sent = mockAdapter.getSentMessages();
    assert.ok(sent.length >= 1);
    assert.strictEqual(sent[0].recipientId, senderId);
    assert.match(sent[0].text, /delivery/i);

    // Clean up
    await pool.query('DELETE FROM messaging_conversations WHERE id = ?', [conv.id]);
  });

  it('admin can view conversations and messages', async () => {
    const res = await request(app)
      .get('/api/v1/admin/messaging/conversations')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  it('admin can toggle AI and post manual reply', async () => {
    // 1. Create a test conversation
    const [c] = await pool.query(
      `INSERT INTO messaging_conversations 
        (channel, external_sender_id, customer_name, is_ai_enabled, unread_count)
       VALUES ('whatsapp', '8801700998877', 'Admin Test Client', 1, 1)`
    );
    const convId = c.insertId;

    // 2. Toggle AI OFF
    const toggleRes = await request(app)
      .patch(`/api/v1/admin/messaging/conversations/${convId}/toggle-ai`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_ai_enabled: false });

    assert.strictEqual(toggleRes.statusCode, 200);
    assert.strictEqual(toggleRes.body.data.is_ai_enabled, 0);

    // 3. Admin posts manual reply
    const replyRes = await request(app)
      .post(`/api/v1/admin/messaging/conversations/${convId}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Hello! I am taking over this conversation manually.' });

    assert.strictEqual(replyRes.statusCode, 201);
    assert.strictEqual(replyRes.body.data.message.sender_type, 'admin');

    // Clean up
    await pool.query('DELETE FROM messaging_conversations WHERE id = ?', [convId]);
  });
});
