const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const n8nWebhookService = require('../src/services/n8n-webhook.service');

describe('Milestone 2: N8N Order Webhook & DeepSeek Notification (R5)', () => {
  let testProductId;
  let testVariantId;
  const ts = Date.now();
  const createdOrderIds = [];

  before(async () => {
    // Ensure test product exists
    const [p] = await pool.query(
      `INSERT INTO products (name, slug, base_price, is_active)
       VALUES (?, ?, 3500.00, 1)`,
      [`N8N Garment ${ts}`, `n8n-garment-${ts}`]
    );
    testProductId = p.insertId;

    const [v] = await pool.query(
      `INSERT INTO product_variants (product_id, sku, size, color, price, stock_quantity, is_active)
       VALUES (?, ?, '42 (L)', 'Navy Blue', 3500.00, 50, 1)`,
      [testProductId, `SKU-N8N-${ts}`]
    );
    testVariantId = v.insertId;
  });

  after(async () => {
    if (createdOrderIds.length > 0) {
      await pool.query('DELETE FROM orders WHERE id IN (?)', [createdOrderIds]);
    }
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    }
  });

  beforeEach(() => {
    n8nWebhookService.clearDispatchedEvents();
  });

  it('triggers non-blocking N8N webhook dispatch on guest order placement', async () => {
    const res = await request(app)
      .post('/api/v1/orders/guest-checkout')
      .send({
        guest_email: `n8n-guest-${ts}@mavllin.test`,
        payment_method: 'manual',
        transaction_id: 'TRX_N8N_VERIFIED_99',
        sender_phone: '01711223344',
        shipping_address: {
          recipient_name: 'Anika Tabassum',
          phone: '01711223344',
          street_address: 'House 12, Road 4',
          area: 'Dhanmondi',
          city: 'Dhaka',
          postal_code: '1205',
        },
        items: [
          {
            product_id: testProductId,
            variant_id: testVariantId,
            quantity: 1,
          },
        ],
      });

    assert.strictEqual(res.statusCode, 201);
    createdOrderIds.push(res.body.data.id);

    // Give asynchronous setImmediate tick
    await new Promise((r) => setTimeout(r, 100));

    // Verify webhook payload captured in mock queue
    const events = n8nWebhookService.getDispatchedEvents();
    assert.strictEqual(events.length, 1);

    const event = events[0];
    assert.strictEqual(event.event, 'order.created');
    assert.strictEqual(event.order.order_number, res.body.data.order_number);
    assert.strictEqual(event.order.transaction_id, 'TRX_N8N_VERIFIED_99');
    assert.strictEqual(event.customer.name, 'Anika Tabassum');
    assert.strictEqual(event.notification_target.ai_formatting.provider, 'deepseek');
    assert.ok(event.deepseek_config.system_prompt.includes('MAVLLIN'));
    assert.ok(event.formatted_alert_fallback.includes('TRX_N8N_VERIFIED_99'));
    assert.ok(event.formatted_alert_fallback.includes('ACTION REQUIRED'));
  });

  it('never blocks or fails order placement even if webhook encounters network error', async () => {
    // Temporarily point webhook to dead endpoint
    const origUrl = process.env.N8N_WEBHOOK_URL;
    const origMode = process.env.ORDER_NOTIFICATION_MODE;
    process.env.ORDER_NOTIFICATION_MODE = 'live';
    process.env.N8N_WEBHOOK_URL = 'http://127.0.0.1:1/nonexistent-webhook';

    try {
      const res = await request(app)
        .post('/api/v1/orders/guest-checkout')
        .send({
          guest_email: `resilience-${ts}@mavllin.test`,
          payment_method: 'cod',
          shipping_address: {
            recipient_name: 'Fault Tolerant Buyer',
            phone: '01899887766',
            street_address: 'Agrabad C/A',
            city: 'Chittagong',
            postal_code: '4100',
          },
          items: [
            {
              product_id: testProductId,
              variant_id: testVariantId,
              quantity: 1,
            },
          ],
        });

      // Checkout MUST succeed 201 Created regardless of external webhook failure
      assert.strictEqual(res.statusCode, 201);
      createdOrderIds.push(res.body.data.id);
    } finally {
      process.env.ORDER_NOTIFICATION_MODE = origMode || 'mock';
      process.env.N8N_WEBHOOK_URL = origUrl || '';
    }
  });
});
