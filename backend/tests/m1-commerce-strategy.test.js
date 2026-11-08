const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const CartModel = require('../src/models/cart.model');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Milestone 1 Core Commerce Strategy Verification', () => {
  let adminToken;
  let customerToken;
  let testUserId;
  let testProductId;
  let testVariantId;
  const createdOrderIds = [];
  const createdProductIds = [];
  const ts = Date.now();
  const testSku = `M1-COMM-${ts}`;

  before(async () => {
    adminToken = getAdminToken();

    // Create test customer
    const [u] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'customer', 1)`,
      [`M1 Customer ${ts}`, `m1-cust-${ts}@mavllin.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    testUserId = u.insertId;
    customerToken = getCustomerToken({ id: testUserId, email: `m1-cust-${ts}@mavllin.test` });

    // Create base product
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `M1 Base Product ${ts}`,
        short_description: 'Milestone 1 Test Garment',
        base_price: 2000.0,
        is_active: 1,
        variants: [
          {
            sku: testSku,
            size: 'L',
            color: 'Crimson',
            price: 2000.0,
            stock_quantity: 100,
            is_active: 1,
          },
        ],
      });

    assert.strictEqual(prodRes.statusCode, 201);
    testProductId = prodRes.body.data.id;
    testVariantId = prodRes.body.data.variants[0].id;
    createdProductIds.push(testProductId);
  });

  after(async () => {
    if (createdOrderIds.length > 0) {
      await pool.query('DELETE FROM payments WHERE order_id IN (?)', [createdOrderIds]);
      await pool.query('DELETE FROM order_status_history WHERE order_id IN (?)', [createdOrderIds]);
      await pool.query('DELETE FROM order_items WHERE order_id IN (?)', [createdOrderIds]);
      await pool.query('DELETE FROM orders WHERE id IN (?)', [createdOrderIds]);
    }
    if (createdProductIds.length > 0) {
      await pool.query('DELETE FROM product_variants WHERE product_id IN (?)', [createdProductIds]);
      await pool.query('DELETE FROM products WHERE id IN (?)', [createdProductIds]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
    }
  });

  const validAddress = {
    recipient_name: 'Sadman Sakib',
    phone: '01711223344',
    street_address: 'House 12, Road 4, Sector 3, Uttara',
    city: 'Dhaka',
    postal_code: '1230',
  };

  describe('1. R2: Manual Payment Gateway', () => {
    it('accepts order with payment_method: "manual" and valid TrxID', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validAddress,
          payment_method: 'manual',
          transaction_id: `BANK-DEP-${ts}`,
          sender_phone: '01711223344',
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.payment_method, 'manual');
      assert.strictEqual(res.body.data.payment_status, 'unpaid');
      assert.strictEqual(res.body.data.transaction_id, `BANK-DEP-${ts}`);
      createdOrderIds.push(res.body.data.id);
    });

    it('accepts order with payment_method: "manual_payment" alias', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validAddress,
          payment_method: 'manual_payment',
          transaction_id: `CTOUCH-${ts}`,
          sender_phone: '01811223344',
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.payment_method, 'manual');
      createdOrderIds.push(res.body.data.id);
    });

    it('rejects manual payment order when transaction_id is missing or empty with 400', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validAddress,
          payment_method: 'manual',
          transaction_id: '   ',
          sender_phone: '01711223344',
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Transaction ID is required'));
    });

    it('admin verifies manual payment via PUT /api/v1/admin/orders/:id/verify-payment', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validAddress,
          payment_method: 'manual',
          transaction_id: `VERIFY-TEST-${ts}`,
          sender_phone: '01711998877',
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(createRes.statusCode, 201);
      const orderId = createRes.body.data.id;
      createdOrderIds.push(orderId);

      const verifyRes = await request(app)
        .put(`/api/v1/admin/orders/${orderId}/verify-payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Deposit verified in City Bank account' });

      assert.strictEqual(verifyRes.statusCode, 200);
      assert.strictEqual(verifyRes.body.success, true);
      assert.strictEqual(verifyRes.body.data.payment_status, 'paid');

      // Verify DB payment row
      const [pRows] = await pool.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [orderId]);
      assert.strictEqual(pRows[0].status, 'completed');
      assert.ok(pRows[0].paid_at != null);

      // Verify status history
      const [hRows] = await pool.query('SELECT note FROM order_status_history WHERE order_id = ? ORDER BY id DESC LIMIT 1', [orderId]);
      assert.ok(hRows[0].note.includes('Deposit verified in City Bank account'));
    });
  });

  describe('2. R3: Product-Specific Discount', () => {
    let discountProdId;
    let discountVarId;

    it('creates product with 20% discount and calculates discount_price (2000 -> 1600)', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Discounted Silk Kurta ${ts}`,
          base_price: 2000.0,
          discount_type: 'percentage',
          discount_value: 20.0,
          variants: [
            {
              sku: `DSK-${ts}`,
              size: 'M',
              color: 'Silk Ivory',
              price: 2000.0,
              stock_quantity: 50,
            },
          ],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.discount_type, 'percentage');
      assert.strictEqual(Number(res.body.data.discount_value), 20);
      assert.strictEqual(Number(res.body.data.discount_price), 1600.0);
      discountProdId = res.body.data.id;
      discountVarId = res.body.data.variants[0].id;
      createdProductIds.push(discountProdId);
    });

    it('CartModel selects effective_price = 1600 over variant price 2000 (COALESCE bug fixed)', async () => {
      await CartModel.addItem(testUserId, discountProdId, discountVarId, 2);
      const items = await CartModel.getItemsByUserId(testUserId);
      const target = items.find((it) => it.product_id === discountProdId);

      assert.ok(target, 'Cart item should exist');
      assert.strictEqual(target.unit_price, 2000);
      assert.strictEqual(target.effective_price, 1600);
      assert.strictEqual(target.line_total, 3200); // 1600 * 2
      assert.strictEqual(target.discount_type, 'percentage');
      assert.strictEqual(target.discount_value, 20);

      // Clean up cart
      await CartModel.clearCart(testUserId);
    });

    it('updates product with fixed discount of 350 BDT (2000 -> 1650)', async () => {
      const res = await request(app)
        .put(`/api/v1/products/${discountProdId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          discount_type: 'fixed',
          discount_value: 350.0,
        });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.discount_type, 'fixed');
      assert.strictEqual(Number(res.body.data.discount_value), 350);
      assert.strictEqual(Number(res.body.data.discount_price), 1650.0);
    });
  });

  describe('3. R6: Advance Payment Options per Product', () => {
    let advanceProdId;
    let advanceVarId;

    it('creates product with 30% advance requirement', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Heritage Embroidered Sherwani ${ts}`,
          base_price: 3000.0,
          advance_payment_type: 'thirty_percent',
          variants: [
            {
              sku: `ADV30-${ts}`,
              size: 'XL',
              color: 'Royal Maroon',
              price: 3000.0,
              stock_quantity: 25,
            },
          ],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.advance_payment_type, 'thirty_percent');
      advanceProdId = res.body.data.id;
      advanceVarId = res.body.data.variants[0].id;
      createdProductIds.push(advanceProdId);
    });

    it('rejects pure COD without TrxID when cart item requires advance payment', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validAddress,
          payment_method: 'cod',
          items: [{ variant_id: advanceVarId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Advance payment of ৳900 is required'));
    });

    it('accepts order with advance payment TrxID and correctly stores advance_amount and due_amount', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validAddress, // Dhaka -> free shipping threshold 2500 reached (3000 >= 2500)
          payment_method: 'bkash',
          transaction_id: `BKS-ADV-${ts}`,
          sender_phone: '01711556677',
          items: [{ variant_id: advanceVarId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(Number(res.body.data.subtotal), 3000.0);
      assert.strictEqual(Number(res.body.data.total_amount), 3000.0);
      assert.strictEqual(Number(res.body.data.advance_amount), 900.0); // 30% of 3000
      assert.strictEqual(Number(res.body.data.due_amount), 2100.0); // 3000 - 900
      assert.strictEqual(res.body.data.advance_payment_status, 'unpaid');
      createdOrderIds.push(res.body.data.id);
    });

    it('order tracking endpoint returns advance_amount and due_amount', async () => {
      const lastOrderId = createdOrderIds[createdOrderIds.length - 1];
      const order = await request(app).get(`/api/v1/orders/${lastOrderId}`).set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(order.statusCode, 200);
      assert.strictEqual(Number(order.body.data.advance_amount), 900.0);
      assert.strictEqual(Number(order.body.data.due_amount), 2100.0);
      assert.strictEqual(order.body.data.payment_method, 'bkash');
    });
  });
});
