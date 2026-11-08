const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdapter, MockAdapter } = require('../src/services/messaging-adapters/adapter.factory');
const FacebookAdapter = require('../src/services/messaging-adapters/facebook.adapter');
const WhatsAppAdapter = require('../src/services/messaging-adapters/whatsapp.adapter');
const aiMessagingService = require('../src/services/ai-messaging.service');
const n8nWebhookService = require('../src/services/n8n-webhook.service');
const { getAdminToken } = require('./helpers/auth.helper');

describe('Milestone 2 Adversarial Empirical Challenger Suite (R4 & R5)', () => {
  let adminToken;
  const mockAdapter = getAdapter('facebook');
  const createdConvIds = [];
  const createdOrderIds = [];

  before(async () => {
    adminToken = getAdminToken();
  });

  after(async () => {
    if (createdConvIds.length > 0) {
      await pool.query('DELETE FROM messaging_conversations WHERE id IN (?)', [createdConvIds]);
    }
    if (createdOrderIds.length > 0) {
      await pool.query('DELETE FROM orders WHERE id IN (?)', [createdOrderIds]);
    }
  });

  beforeEach(() => {
    mockAdapter.clear();
    n8nWebhookService.clearDispatchedEvents();
  });

  // =========================================================================
  // SECTION 1: MESSAGING ADAPTERS ADVERSARIAL EDGE CASES
  // =========================================================================
  describe('1. Messaging Adapters Adversarial Edge Cases', () => {
    it('throws when requesting unsupported messaging channel in both test and live modes', () => {
      // In test/mock mode:
      assert.throws(() => getAdapter('telegram'), /Unsupported messaging channel: telegram/);
      assert.throws(() => getAdapter('viber'), /Unsupported messaging channel: viber/);
      assert.throws(() => getAdapter(''), /Unsupported messaging channel: /);
      assert.throws(() => getAdapter(null), /Unsupported messaging channel: null/);
      assert.throws(() => getAdapter('custom_test_channel'), /Unsupported messaging channel: custom_test_channel/);

      // Supported channels return MockAdapter in test/mock mode:
      const testMockFb = getAdapter('facebook');
      assert.strictEqual(testMockFb.channel, 'facebook');
      const testMockWa = getAdapter('whatsapp');
      assert.strictEqual(testMockWa.channel, 'whatsapp');

      // In production live mode:
      const env = require('../src/config/env');
      const origMode = env.messaging.mode;
      const origEnv = process.env.NODE_ENV;
      try {
        env.messaging.mode = 'live';
        process.env.NODE_ENV = 'production';
        assert.throws(() => getAdapter('telegram'), /Unsupported messaging channel: telegram/);
        assert.throws(() => getAdapter('viber'), /Unsupported messaging channel: viber/);
        assert.throws(() => getAdapter(''), /Unsupported messaging channel: /);
        assert.throws(() => getAdapter(null), /Unsupported messaging channel: null/);
      } finally {
        env.messaging.mode = origMode;
        process.env.NODE_ENV = origEnv;
      }
    });

    it('FacebookAdapter: handles malformed webhook payloads without throwing', () => {
      const fb = new FacebookAdapter({ verifyToken: 'test_token' });

      // Null, undefined, empty object
      assert.deepEqual(fb.parseInboundWebhook(null), []);
      assert.deepEqual(fb.parseInboundWebhook(undefined), []);
      assert.deepEqual(fb.parseInboundWebhook({}), []);
      assert.deepEqual(fb.parseInboundWebhook({ object: 'instagram' }), []);
      assert.deepEqual(fb.parseInboundWebhook({ object: 'page', entry: [] }), []);
      assert.deepEqual(fb.parseInboundWebhook({ object: 'page', entry: [{ messaging: [] }] }), []);

      // Echo message (from our own page) must be ignored
      const echoPayload = {
        object: 'page',
        entry: [
          {
            messaging: [
              {
                message: { is_echo: true, text: 'This is an echo from bot' },
                sender: { id: 'page_123' },
              },
            ],
          },
        ],
      };
      assert.deepEqual(fb.parseInboundWebhook(echoPayload), []);

      // Attachment without text (sticker, image, audio) must be ignored
      const nonTextPayload = {
        object: 'page',
        entry: [
          {
            messaging: [
              {
                message: { attachments: [{ type: 'image' }] },
                sender: { id: 'user_456' },
              },
            ],
          },
        ],
      };
      assert.deepEqual(fb.parseInboundWebhook(nonTextPayload), []);
    });

    it('FacebookAdapter: verifies webhook tokens and rejects mismatches', () => {
      const fb = new FacebookAdapter({ verifyToken: 'fb_secret_token_123' });

      // Valid subscribe
      const validQuery = {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'fb_secret_token_123',
        'hub.challenge': 'CHALLENGE_FB_OK',
      };
      assert.strictEqual(fb.verifyWebhook(validQuery), 'CHALLENGE_FB_OK');

      // Invalid token
      assert.strictEqual(
        fb.verifyWebhook({ ...validQuery, 'hub.verify_token': 'wrong_secret' }),
        null
      );

      // Invalid mode
      assert.strictEqual(
        fb.verifyWebhook({ ...validQuery, 'hub.mode': 'publish' }),
        null
      );

      // Missing challenge
      assert.strictEqual(
        fb.verifyWebhook({ 'hub.mode': 'subscribe', 'hub.verify_token': 'fb_secret_token_123' }),
        undefined
      );
    });

    it('WhatsAppAdapter: handles malformed webhook payloads and extracts contacts safely', () => {
      const wa = new WhatsAppAdapter({
        verifyToken: 'wa_secret_123',
        accessToken: '',
        phoneNumberId: '',
      });

      // Null, empty, missing fields
      assert.deepEqual(wa.parseInboundWebhook(null), []);
      assert.deepEqual(wa.parseInboundWebhook(undefined), []);
      assert.deepEqual(wa.parseInboundWebhook({}), []);
      assert.deepEqual(wa.parseInboundWebhook({ object: 'page' }), []);
      assert.deepEqual(wa.parseInboundWebhook({ object: 'whatsapp_business_account', entry: [] }), []);

      // Non-text message (e.g. audio, sticker) ignored
      const audioPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [{ type: 'audio', id: 'wamid.123', from: '8801700000000' }],
                },
              },
            ],
          },
        ],
      };
      assert.deepEqual(wa.parseInboundWebhook(audioPayload), []);

      // Valid WhatsApp text payload with contact profile
      const validPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ wa_id: '8801711223344', profile: { name: 'Farhan Kabir' } }],
                  messages: [
                    {
                      type: 'text',
                      from: '8801711223344',
                      text: { body: 'Panjabi size 40 ache?' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };
      const parsed = wa.parseInboundWebhook(validPayload);
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].customerName, 'Farhan Kabir');
      assert.strictEqual(parsed[0].customerPhone, '+8801711223344');
      assert.strictEqual(parsed[0].text, 'Panjabi size 40 ache?');
    });

    it('MockAdapter: captures and clears outbound messages deterministically', async () => {
      const mock = new MockAdapter('mock_test');
      assert.strictEqual(mock.getSentMessages().length, 0);

      const res1 = await mock.sendTextMessage({
        recipientId: 'user_001',
        text: 'Hello Customer',
      });
      assert.strictEqual(res1.success, true);
      assert.strictEqual(mock.getSentMessages().length, 1);
      assert.strictEqual(mock.getLastSentMessage().text, 'Hello Customer');

      const res2 = await mock.sendTextMessage({
        recipientId: 'user_002',
        text: 'Second Message',
      });
      assert.strictEqual(res2.success, true);
      assert.strictEqual(mock.getSentMessages().length, 2);

      mock.clear();
      assert.strictEqual(mock.getSentMessages().length, 0);
      assert.strictEqual(mock.getLastSentMessage(), null);
    });
  });

  // =========================================================================
  // SECTION 2: AI MESSAGING ENGINE & BRAIN BOUNDARY STRESS TESTS
  // =========================================================================
  describe('2. AI Messaging Engine & Brain Boundary Stress Tests', () => {
    it('handles unexpected, empty, and non-string inputs safely without crashing', async () => {
      assert.strictEqual(aiMessagingService.detectLanguage(''), 'en');
      assert.strictEqual(aiMessagingService.detectLanguage(null), 'en');
      assert.strictEqual(aiMessagingService.detectLanguage(undefined), 'en');
      assert.strictEqual(aiMessagingService.detectLanguage(12345), 'en');
      assert.strictEqual(aiMessagingService.detectLanguage({}), 'en');

      const intentNull = aiMessagingService.classifyIntent(null);
      assert.strictEqual(intentNull.intent, 'UNKNOWN');
      assert.ok(intentNull.confidence <= 0.5);

      const resEmpty = await aiMessagingService.generateResponse({ messageText: '' });
      assert.ok(resEmpty.replyText.length > 0);
      assert.strictEqual(resEmpty.handoffRequired, false);
    });

    it('enforces 2-inch garment chest ease and full size chart (38-46) in sizing replies', async () => {
      const res = await aiMessagingService.generateResponse({
        messageText: 'Could you give me the exact chest measurements for all sizes?',
      });
      assert.strictEqual(res.intent, 'SIZING_QUERY');
      assert.match(res.replyText, /38 \(S\): 40" Finished Chest/i);
      assert.match(res.replyText, /40 \(M\): 42" Finished Chest/i);
      assert.match(res.replyText, /42 \(L\): 44" Finished Chest/i);
      assert.match(res.replyText, /44 \(XL\): 46" Finished Chest/i);
      assert.match(res.replyText, /46 \(XXL\): 48" Finished Chest/i);
      assert.match(res.replyText, /2 inches/i);
    });

    it('gracefully handles adversarial haggling with fixed BDT pricing and WELCOME10 coupon', async () => {
      const testCases = [
        'Can I bargain or get 50% discount?',
        'দাম কিছু কমান ভাই, একদামে নিব',
        'Can you give me a discount on the panjabi?',
      ];

      for (const text of testCases) {
        const res = await aiMessagingService.generateResponse({ messageText: text });
        assert.strictEqual(res.intent, 'PRICING_DISCOUNT_INQUIRY');
        assert.match(res.replyText, /WELCOME10/);
        assert.match(res.replyText, /২,৫০০|2,500/);
      }
    });

    it('correctly classifies 4-digit price inquiries as PRICING_DISCOUNT_INQUIRY without false tracking', async () => {
      const res = aiMessagingService.classifyIntent('vai 1500 takay deya jabe?');
      assert.strictEqual(res.intent, 'PRICING_DISCOUNT_INQUIRY');

      const res2 = aiMessagingService.classifyIntent('can I pay 2500?');
      assert.strictEqual(res2.intent, 'PRICING_DISCOUNT_INQUIRY');

      // Genuine tracking queries still resolve to ORDER_STATUS_TRACKING
      const resTrack = aiMessagingService.classifyIntent('where is my order 5678');
      assert.strictEqual(resTrack.intent, 'ORDER_STATUS_TRACKING');
      assert.strictEqual(resTrack.entities.orderNumber, '5678');
    });

    it('correctly handles all human escalation triggers with handoffRequired=true', async () => {
      const triggers = [
        'I demand to speak to a real person right now',
        'কথা বলতে চাই প্রতিনিধির সাথে',
        'Can I order custom bespoke tailoring for my measurements?',
        'My parcel arrived damaged and torn',
      ];

      for (const text of triggers) {
        const res = await aiMessagingService.generateResponse({ messageText: text });
        assert.strictEqual(res.intent, 'HUMAN_ESCALATION');
        assert.strictEqual(res.handoffRequired, true);
        assert.strictEqual(res.shouldEscalate, true);
      }
    });

    it('correctly returns BDT delivery fees: ৳70 inside Dhaka, ৳130 outside, free at ৳2,500', async () => {
      const resDhaka = await aiMessagingService.generateResponse({
        messageText: 'What is the courier fee inside Dhaka?',
      });
      assert.match(resDhaka.replyText, /70/);
      assert.match(resDhaka.replyText, /130/);
      assert.match(resDhaka.replyText, /2,500/);

      const resOutside = await aiMessagingService.generateResponse({
        messageText: 'ঢাকার বাইরে ডেলিভারি চার্জ কত?',
      });
      assert.strictEqual(resOutside.detectedLanguage, 'bn');
      assert.match(resOutside.replyText, /৭০/);
      assert.match(resOutside.replyText, /১৩০/);
      assert.match(resOutside.replyText, /২,৫০০/);
    });
  });

  // =========================================================================
  // SECTION 3: INBOUND WEBHOOK & CONTROLLER ADVERSARIAL STRESS TESTS
  // =========================================================================
  describe('3. Inbound Webhook & Controller Adversarial Stress Tests', () => {
    it('rejects unsupported channel on GET and POST webhooks with 400', async () => {
      const getRes = await request(app).get('/api/v1/messaging/webhook/telegram');
      assert.strictEqual(getRes.statusCode, 400);

      const postRes = await request(app).post('/api/v1/messaging/webhook/telegram').send({});
      assert.strictEqual(postRes.statusCode, 400);
    });

    it('handles empty body on POST /api/v1/messaging/webhook/facebook gracefully', async () => {
      const res = await request(app)
        .post('/api/v1/messaging/webhook/facebook')
        .send({});

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'EVENT_RECEIVED');
      assert.strictEqual(res.body.count, 0);
    });

    it('rejects inbound webhook with forged/invalid HMAC SHA-256 signature with 401', async () => {
      const res = await request(app)
        .post('/api/v1/messaging/webhook/facebook')
        .set('x-hub-signature-256', 'sha256=invalid_forged_hash_1234567890abcdef')
        .send({ object: 'page' });

      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /signature/i);
    });

    it('accepts inbound webhook with valid HMAC SHA-256 signature', async () => {
      const crypto = require('crypto');
      const body = JSON.stringify({
        object: 'page',
        entry: [
          {
            messaging: [
              {
                sender: { id: 'fb_hmac_valid_user' },
                message: { text: 'Testing HMAC signature verification' },
              },
            ],
          },
        ],
      });
      const validHash = crypto
        .createHmac('sha256', 'test_fb_app_secret')
        .update(Buffer.from(body, 'utf8'))
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/messaging/webhook/facebook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', `sha256=${validHash}`)
        .send(body);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.status, 'EVENT_RECEIVED');
    });

    it('in live mode, rejects inbound webhook missing x-hub-signature-256 header when secret is configured', async () => {
      const env = require('../src/config/env');
      const origMode = env.messaging.mode;
      const origSecret = env.messaging.fbAppSecret;
      try {
        env.messaging.mode = 'live';
        env.messaging.fbAppSecret = 'live_production_secret_key';

        const res = await request(app)
          .post('/api/v1/messaging/webhook/facebook')
          .send({ object: 'page' });

        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.success, false);
        assert.match(res.body.message, /signature/i);
      } finally {
        env.messaging.mode = origMode;
        env.messaging.fbAppSecret = origSecret;
      }
    });

    it('rejects manual reply with missing or whitespace-only message content with 400', async () => {
      // Create temporary conversation
      const [c] = await pool.query(
        `INSERT INTO messaging_conversations 
          (channel, external_sender_id, customer_name, is_ai_enabled, unread_count)
         VALUES ('facebook', 'fb_stress_test_1', 'Stress Test Patron', 1, 0)`
      );
      const convId = c.insertId;
      createdConvIds.push(convId);

      // Missing content
      const res1 = await request(app)
        .post(`/api/v1/admin/messaging/conversations/${convId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      assert.strictEqual(res1.statusCode, 400);

      // Whitespace only
      const res2 = await request(app)
        .post(`/api/v1/admin/messaging/conversations/${convId}/reply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: '    ' });
      assert.strictEqual(res2.statusCode, 400);

      // Non-existent conversation
      const res3 = await request(app)
        .post('/api/v1/admin/messaging/conversations/999999/reply')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'Hello patron' });
      assert.strictEqual(res3.statusCode, 404);
    });

    it('handles AI toggle on non-existent conversation with 404', async () => {
      const res = await request(app)
        .patch('/api/v1/admin/messaging/conversations/999999/toggle-ai')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_ai_enabled: false });

      assert.strictEqual(res.statusCode, 404);
    });

    it('toggles AI state between true and false and verifies DB persistence', async () => {
      const [c] = await pool.query(
        `INSERT INTO messaging_conversations 
          (channel, external_sender_id, customer_name, is_ai_enabled, unread_count)
         VALUES ('whatsapp', 'wa_toggle_persist', 'Persist Client', 1, 0)`
      );
      const convId = c.insertId;
      createdConvIds.push(convId);

      // 1. Toggle OFF
      const offRes = await request(app)
        .patch(`/api/v1/admin/messaging/conversations/${convId}/toggle-ai`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_ai_enabled: false });
      assert.strictEqual(offRes.statusCode, 200);
      assert.strictEqual(offRes.body.data.is_ai_enabled, 0);

      // 2. Toggle ON
      const onRes = await request(app)
        .patch(`/api/v1/admin/messaging/conversations/${convId}/toggle-ai`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_ai_enabled: true });
      assert.strictEqual(onRes.statusCode, 200);
      assert.strictEqual(onRes.body.data.is_ai_enabled, 1);
    });

    it('inbound escalation message automatically disables AI on conversation', async () => {
      const senderId = `fb_escalation_${Date.now()}`;
      const payload = {
        object: 'page',
        entry: [
          {
            messaging: [
              {
                sender: { id: senderId },
                message: { text: 'I need to speak with a human agent please' },
              },
            ],
          },
        ],
      };

      const res = await request(app)
        .post('/api/v1/messaging/webhook/facebook')
        .send(payload);

      assert.strictEqual(res.statusCode, 200);

      // Allow async processing
      await new Promise((r) => setTimeout(r, 120));

      const [rows] = await pool.query(
        'SELECT * FROM messaging_conversations WHERE external_sender_id = ?',
        [senderId]
      );
      assert.strictEqual(rows.length, 1);
      const conv = rows[0];
      createdConvIds.push(conv.id);

      // AI must be disabled because of escalation
      assert.strictEqual(conv.is_ai_enabled, 0);

      // Outbound message was sent to patron advising transfer
      const sent = mockAdapter.getSentMessages();
      assert.ok(sent.some((m) => m.recipientId === senderId && /human concierge team/i.test(m.text)));
    });
  });

  // =========================================================================
  // SECTION 4: N8N ORDER WEBHOOK UNDER ADVERSARIAL EDGE CASES
  // =========================================================================
  describe('4. N8N Order Automation Webhook Stress & Resilience (R5)', () => {
    it('builds payload safely with missing optional fields without throwing', () => {
      // Bare minimal order
      const minimalOrder = {
        id: 1001,
        order_number: 'MAV-MINIMAL-01',
        total_amount: 1500,
      };

      const payload = n8nWebhookService.buildPayload(minimalOrder);
      assert.strictEqual(payload.event, 'order.created');
      assert.strictEqual(payload.order.order_number, 'MAV-MINIMAL-01');
      assert.strictEqual(payload.customer.name, 'Guest');
      assert.strictEqual(payload.customer.is_guest, true);
      assert.strictEqual(payload.customer.email, null);
      assert.strictEqual(payload.items.length, 0);
      assert.ok(payload.formatted_alert_fallback.includes('MAV-MINIMAL-01'));
      assert.ok(payload.formatted_alert_fallback.includes('1,500'));
    });

    it('builds payload safely when shipping_address is JSON string or object', () => {
      const orderWithJsonAddress = {
        id: 1002,
        order_number: 'MAV-JSON-ADDR',
        total_amount: 2500,
        shipping_address: JSON.stringify({
          recipient_name: 'Tanvir Hasan',
          city: 'Sylhet',
          area: 'Zindabazar',
          phone: '01822334455',
        }),
      };

      const payload = n8nWebhookService.buildPayload(orderWithJsonAddress);
      assert.strictEqual(payload.shipping_address.city, 'Sylhet');
      assert.ok(payload.formatted_alert_fallback.includes('Outside Dhaka'));
      assert.ok(payload.formatted_alert_fallback.includes('Zindabazar'));
    });

    it('safely handles unparseable plain string shipping_address in buildPayload without throwing', () => {
      const orderWithPlainString = {
        id: 1003,
        order_number: 'MAV-PLAIN-ADDR',
        total_amount: 3200,
        shipping_address: 'House 5, Road 2, Dhanmondi, Dhaka',
      };

      const payload = n8nWebhookService.buildPayload(orderWithPlainString);
      assert.ok(payload);
      assert.strictEqual(payload.shipping_address.city, 'Dhaka');
      assert.strictEqual(payload.shipping_address.street_address, 'House 5, Road 2, Dhanmondi, Dhaka');
      assert.ok(payload.formatted_alert_fallback.includes('House 5, Road 2, Dhanmondi, Dhaka'));
    });

    it('dispatchOrderPlaced returns false if no order provided', async () => {
      const result = await n8nWebhookService.dispatchOrderPlaced(null);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.reason, 'No order provided');
    });

    it('formats WhatsApp alert with ACTION REQUIRED for manual payments and COD notes for COD', () => {
      const manualOrder = {
        id: 2001,
        order_number: 'MAV-MANUAL-ALERT',
        payment_method: 'bkash',
        transaction_id: 'TRX_BKASH_9988',
        sender_phone: '01700112233',
        advance_amount: 1000,
        due_amount: 1500,
        total_amount: 2500,
        items: [{ product_name: 'Heritage Silk Panjabi', quantity: 1, unit_price: 2500 }],
      };

      const manualPayload = n8nWebhookService.buildPayload(manualOrder);
      assert.ok(manualPayload.formatted_alert_fallback.includes('TRX_BKASH_9988'));
      assert.ok(manualPayload.formatted_alert_fallback.includes('VERIFY TrxID'));
      assert.ok(manualPayload.formatted_alert_fallback.includes('*Advance Paid/Required:* ৳1,000.00'));

      const codOrder = {
        id: 2002,
        order_number: 'MAV-COD-ALERT',
        payment_method: 'cod',
        total_amount: 2100,
        items: [{ product_name: 'Everyday Kurta', quantity: 1, unit_price: 2100 }],
      };

      const codPayload = n8nWebhookService.buildPayload(codOrder);
      assert.ok(codPayload.formatted_alert_fallback.includes('COD'));
      assert.ok(codPayload.formatted_alert_fallback.includes('Order Financials'));
    });

    it('verifies non-blocking guarantee: guest checkout succeeds 201 even when N8N fails', async () => {
      // Simulate N8N live failure by pointing to an unrouteable blackhole IP
      const origMode = process.env.ORDER_NOTIFICATION_MODE;
      const origUrl = process.env.N8N_WEBHOOK_URL;
      process.env.ORDER_NOTIFICATION_MODE = 'live';
      process.env.N8N_WEBHOOK_URL = 'http://192.0.2.1:9999/webhook-blackhole'; // RFC 5737 TEST-NET-1

      try {
        // Create product variant for checkout
        const [p] = await pool.query(
          `INSERT INTO products (name, slug, base_price, is_active)
           VALUES ('Resilience Test Product', 'resilience-test-prod', 1800.00, 1)`
        );
        const prodId = p.insertId;

        const [v] = await pool.query(
          `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
           VALUES (?, 'SKU-RES-01', '40 (M)', 'White', 1800.00, 20, 1)`,
          [prodId]
        );
        const varId = v.insertId;

        const startTime = Date.now();
        const res = await request(app)
          .post('/api/v1/orders/guest-checkout')
          .send({
            guest_email: 'resilience-guarantee@mavllin.test',
            payment_method: 'cod',
            shipping_address: {
              recipient_name: 'Guaranteed Client',
              phone: '01711009988',
              street_address: 'House 1, Road 1',
              city: 'Dhaka',
              postal_code: '1212',
            },
            items: [
              {
                product_id: prodId,
                variant_id: varId,
                quantity: 1,
              },
            ],
          });
        const duration = Date.now() - startTime;

        // Check that response was IMMEDIATE (< 500ms), NOT blocked by the 6-second webhook timeout
        assert.strictEqual(res.statusCode, 201);
        assert.ok(duration < 1500, `Checkout took ${duration}ms, expected < 1500ms non-blocking`);
        createdOrderIds.push(res.body.data.id);

        // Cleanup product
        await pool.query('DELETE FROM products WHERE id = ?', [prodId]);
      } finally {
        process.env.ORDER_NOTIFICATION_MODE = origMode || 'mock';
        process.env.N8N_WEBHOOK_URL = origUrl || '';
      }
    });
  });
});
