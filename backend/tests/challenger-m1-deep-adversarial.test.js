const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const CartModel = require('../src/models/cart.model');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Milestone 1 Challenger Empirical Verification: Adversarial Stress Tests', () => {
  let adminToken;
  let customerToken;
  let testUserId;
  const createdOrderIds = [];
  const createdProductIds = [];
  const ts = Date.now();

  let testVarBase;
  let testVarAdv30;
  let testVarAdvDeliv;
  let testVarAdv0;
  let testVarAdvFull;
  let testProdBaseId;
  let testProdAdv30Id;
  let testProdAdvDelivId;
  let testProdAdv0Id;
  let testProdAdvFullId;

  const validDhakaAddress = {
    recipient_name: 'Adversarial Tester Dhaka',
    phone: '01711001122',
    street_address: 'House 5, Road 10, Dhanmondi',
    city: 'Dhaka',
    postal_code: '1209',
  };

  const validOutsideDhakaAddress = {
    recipient_name: 'Adversarial Tester Chittagong',
    phone: '01811001122',
    street_address: 'GEC Circle',
    city: 'Chittagong',
    postal_code: '4000',
  };

  before(async () => {
    adminToken = getAdminToken();

    // 1. Create test customer
    const [u] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'customer', 1)`,
      [`Challenger User ${ts}`, `chal-user-${ts}@mavllin.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    testUserId = u.insertId;
    customerToken = getCustomerToken({ id: testUserId, email: `chal-user-${ts}@mavllin.test` });

    // 2. Setup standard base product
    const pBase = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `CHAL Base Garment ${ts}`,
        base_price: 1000.0,
        is_active: 1,
        variants: [
          {
            sku: `SKU-BASE-${ts}`,
            size: 'M',
            color: 'Navy',
            price: 1000.0,
            stock_quantity: 200,
            is_active: 1,
          },
        ],
      });
    assert.strictEqual(pBase.statusCode, 201, `Failed base product: ${JSON.stringify(pBase.body)}`);
    testProdBaseId = pBase.body.data.id;
    testVarBase = pBase.body.data.variants[0].id;
    createdProductIds.push(testProdBaseId);

    // 3. Setup Advance 30% Product (Price 500)
    const pAdv30 = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `CHAL Adv30 Garment ${ts}`,
        base_price: 500.0,
        advance_payment_type: 'thirty_percent',
        is_active: 1,
        variants: [
          {
            sku: `SKU-ADV30-${ts}`,
            size: 'M',
            color: 'Emerald',
            price: 500.0,
            stock_quantity: 200,
            is_active: 1,
          },
        ],
      });
    assert.strictEqual(pAdv30.statusCode, 201);
    testProdAdv30Id = pAdv30.body.data.id;
    testVarAdv30 = pAdv30.body.data.variants[0].id;
    createdProductIds.push(testProdAdv30Id);

    // 4. Setup Delivery Charge Advance Product (Price 600)
    const pAdvDeliv = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `CHAL AdvDeliv Garment ${ts}`,
        base_price: 600.0,
        advance_payment_type: 'delivery_charge',
        is_active: 1,
        variants: [
          {
            sku: `SKU-ADVDEL-${ts}`,
            size: 'L',
            color: 'Teal',
            price: 600.0,
            stock_quantity: 200,
            is_active: 1,
          },
        ],
      });
    assert.strictEqual(pAdvDeliv.statusCode, 201);
    testProdAdvDelivId = pAdvDeliv.body.data.id;
    testVarAdvDeliv = pAdvDeliv.body.data.variants[0].id;
    createdProductIds.push(testProdAdvDelivId);

    // 5. Setup 0% Advance Product (Price 400)
    const pAdv0 = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `CHAL Adv0 Garment ${ts}`,
        base_price: 400.0,
        advance_payment_type: 'none',
        is_active: 1,
        variants: [
          {
            sku: `SKU-ADV0-${ts}`,
            size: 'S',
            color: 'White',
            price: 400.0,
            stock_quantity: 200,
            is_active: 1,
          },
        ],
      });
    assert.strictEqual(pAdv0.statusCode, 201);
    testProdAdv0Id = pAdv0.body.data.id;
    testVarAdv0 = pAdv0.body.data.variants[0].id;
    createdProductIds.push(testProdAdv0Id);

    // 6. Setup 100% Full Advance Product (Price 1200)
    const pAdvFull = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `CHAL AdvFull Garment ${ts}`,
        base_price: 1200.0,
        advance_payment_type: 'full',
        is_active: 1,
        variants: [
          {
            sku: `SKU-ADVFULL-${ts}`,
            size: 'XL',
            color: 'Burgundy',
            price: 1200.0,
            stock_quantity: 200,
            is_active: 1,
          },
        ],
      });
    assert.strictEqual(pAdvFull.statusCode, 201);
    testProdAdvFullId = pAdvFull.body.data.id;
    testVarAdvFull = pAdvFull.body.data.variants[0].id;
    createdProductIds.push(testProdAdvFullId);
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
      await pool.query('DELETE FROM cart_items WHERE user_id = ?', [testUserId]);
      await pool.query('DELETE FROM orders WHERE user_id = ?', [testUserId]);
      await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
    }
  });

  // =========================================================================
  // SECTION 1: Manual Payment Gateway Adversarial Verification
  // =========================================================================
  describe('1. Manual Payment Gateway Edge Cases & Boundary Probing', () => {
    it('accepts transaction_id of exactly 120 characters', async () => {
      const exact120 = 'T'.repeat(120);
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          transaction_id: exact120,
          sender_phone: '01711223344',
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201, `Failed on 120 chars: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.transaction_id, exact120);
      createdOrderIds.push(res.body.data.id);
    });

    it('rejects transaction_id of 121 characters with 400/422 Unprocessable Entity (not 500 crash)', async () => {
      const over120 = 'T'.repeat(121);
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          transaction_id: over120,
          sender_phone: '01711223344',
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });

      assert.ok([400, 422].includes(res.statusCode), `Expected 400/422 on 121 chars, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, false);
      const msg = JSON.stringify(res.body);
      assert.ok(msg.includes('must not exceed 120 characters') || msg.includes('Transaction ID'), msg);
    });

    it('rejects oversized transaction_id of 250 characters with 400/422 Bad Request', async () => {
      const huge250 = 'X'.repeat(250);
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          transaction_id: huge250,
          sender_phone: '01711223344',
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });

      assert.ok([400, 422].includes(res.statusCode));
      assert.strictEqual(res.body.success, false);
    });

    it('accepts sender_phone of exactly 30 characters', async () => {
      const phone30 = '+8801711'.padEnd(30, '0');
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          transaction_id: `PHONE30-${ts}`,
          sender_phone: phone30,
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.sender_phone, phone30);
      createdOrderIds.push(res.body.data.id);
    });

    it('rejects sender_phone of 35 characters with 400/422 Bad Request', async () => {
      const phone35 = '+8801711'.padEnd(35, '0');
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          transaction_id: `PHONE35-${ts}`,
          sender_phone: phone35,
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });

      assert.ok([400, 422].includes(res.statusCode));
      assert.strictEqual(res.body.success, false);
      assert.ok(JSON.stringify(res.body).includes('must not exceed 30 characters'));
    });

    it('handles special characters, Unicode, punctuation, and XSS safely in transaction_id', async () => {
      const complexTrx = `MFS-২০২৬-১১২৩#@!%^&*()_+<script>alert(1)</script>`;
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          transaction_id: complexTrx,
          sender_phone: '01711223344',
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201, `Failed on complexTrx: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.transaction_id, complexTrx);
      createdOrderIds.push(res.body.data.id);

      // Verify safe retrieval via public track endpoint
      const trackRes = await request(app).get(`/api/v1/orders/track/${res.body.data.order_number}`);
      assert.strictEqual(trackRes.statusCode, 200);
      assert.strictEqual(trackRes.body.data.transaction_id, complexTrx);
    });

    it('rejects pure whitespace transaction_id on manual payment with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          transaction_id: '      ',
          sender_phone: '01711223344',
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Transaction ID is required'));
    });

    it('trims leading and trailing whitespace on valid transaction_id', async () => {
      const rawTrx = `   TRX-SPACED-${ts}   `;
      const expectedTrx = `TRX-SPACED-${ts}`;
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          transaction_id: rawTrx,
          sender_phone: '01711223344',
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.data.transaction_id, expectedTrx);
      createdOrderIds.push(res.body.data.id);
    });

    it('rejects completely missing transaction_id on manual payment with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          sender_phone: '01711223344',
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Transaction ID is required'));
    });

    it('observes duplicate TrxID behavior across multiple orders', async () => {
      const dupTrx = `DUP-TRX-${ts}`;

      // Order 1 with TrxID
      const res1 = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          transaction_id: dupTrx,
          sender_phone: '01711000001',
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });
      assert.strictEqual(res1.statusCode, 201);
      createdOrderIds.push(res1.body.data.id);

      // Order 2 with identical TrxID
      const res2 = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          transaction_id: dupTrx,
          sender_phone: '01711000002',
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });

      // Empirical check: DB schema does not have a UNIQUE constraint on payments.transaction_id,
      // allowing duplicate TrxIDs to be stored for admin review / cross-check flag.
      assert.strictEqual(res2.statusCode, 201);
      createdOrderIds.push(res2.body.data.id);

      // Both orders exist in admin list with that TrxID
      const adminSearch = await request(app)
        .get(`/api/v1/admin/orders?search=${dupTrx}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(adminSearch.statusCode, 200);
      const matches = adminSearch.body.data.filter((o) => o.transaction_id && o.transaction_id.includes(dupTrx));
      assert.ok(matches.length >= 2, `Expected at least 2 matching orders for duplicate TrxID, got ${matches.length}`);
    });

    it('admin verification status transition matrix & idempotency', async () => {
      // 1. Create order
      const createRes = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'manual',
          transaction_id: `VERIFY-STATE-${ts}`,
          sender_phone: '01711334455',
          items: [{ variant_id: testVarBase, quantity: 1 }],
        });
      assert.strictEqual(createRes.statusCode, 201);
      const orderId = createRes.body.data.id;
      createdOrderIds.push(orderId);

      // 2. Customer token cannot verify payment (403 Forbidden)
      const custForbidden = await request(app)
        .put(`/api/v1/admin/orders/${orderId}/verify-payment`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ note: 'Malicious attempt' });
      assert.strictEqual(custForbidden.statusCode, 403);

      // 3. Admin verifies payment -> payment_status = 'paid', payments.status = 'completed', paid_at = NOW()
      const adminVerify1 = await request(app)
        .put(`/api/v1/admin/orders/${orderId}/verify-payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'First verification call' });
      assert.strictEqual(adminVerify1.statusCode, 200);
      assert.strictEqual(adminVerify1.body.data.payment_status, 'paid');

      const [pRows1] = await pool.query('SELECT status, paid_at FROM payments WHERE order_id = ?', [orderId]);
      assert.strictEqual(pRows1[0].status, 'completed');
      assert.ok(pRows1[0].paid_at != null);

      // 4. Repeated call (idempotency check)
      const adminVerify2 = await request(app)
        .put(`/api/v1/admin/orders/${orderId}/verify-payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Second verification call' });
      assert.strictEqual(adminVerify2.statusCode, 200);
      assert.strictEqual(adminVerify2.body.data.payment_status, 'paid');

      // 5. Status history records transition
      const [hist] = await pool.query('SELECT note FROM order_status_history WHERE order_id = ? ORDER BY id ASC', [orderId]);
      assert.ok(hist.some((h) => h.note.includes('First verification call') || h.note.includes('verified')));

      // 6. Admin can update payment_status to 'failed' if cross-check fails
      const adminFail = await request(app)
        .put(`/api/v1/orders/${orderId}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'failed', note: 'Fraudulent transaction ID' });
      assert.strictEqual(adminFail.statusCode, 200);
      assert.strictEqual(adminFail.body.data.payment_status, 'failed');

      const [pRowsFail] = await pool.query('SELECT status FROM payments WHERE order_id = ?', [orderId]);
      assert.strictEqual(pRowsFail[0].status, 'failed');

      // 7. Admin rejects invalid payment status with 400/422 Bad Request
      const adminInvalid = await request(app)
        .put(`/api/v1/orders/${orderId}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'banana_status' });
      assert.ok([400, 422].includes(adminInvalid.statusCode));

      // 8. 404 when non-existent order ID is provided
      const admin404 = await request(app)
        .put('/api/v1/admin/orders/99999999/verify-payment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Ghost order' });
      assert.strictEqual(admin404.statusCode, 404);
    });
  });

  // =========================================================================
  // SECTION 2: Advance Payment Rules Adversarial Verification
  // =========================================================================
  describe('2. Advance Payment Rules & Math Stress Testing', () => {
    it('Scenario 1: Mixed Cart Below Free Shipping Threshold (30% + Delivery Charge + 0%)', async () => {
      // Items:
      // Item 1 (Adv 30%): 1 x 500 = 500. Expected item advance = 150.00.
      // Item 2 (Adv Delivery): 1 x 600 = 600. Expected item advance = 0.00. Requires delivery advance = true.
      // Item 3 (Adv 0%): 1 x 400 = 400. Expected item advance = 0.00.
      // Subtotal = 500 + 600 + 400 = 1500.00.
      // Outside Dhaka: Shipping Fee = 130.00.
      // Total Amount = 1500 + 130 = 1630.00.
      // Delivery advance = 130.00.
      // Required Advance = 150 + 130 = 280.00.
      // Due on Delivery = 1630 - 280 = 1350.00.

      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validOutsideDhakaAddress,
          payment_method: 'bkash',
          transaction_id: `ADV-MIX-BELOW-${ts}`,
          sender_phone: '01811001122',
          items: [
            { variant_id: testVarAdv30, quantity: 1 },
            { variant_id: testVarAdvDeliv, quantity: 1 },
            { variant_id: testVarAdv0, quantity: 1 },
          ],
        });

      assert.strictEqual(res.statusCode, 201, `Failed mixed below threshold: ${JSON.stringify(res.body)}`);
      const ord = res.body.data;
      createdOrderIds.push(ord.id);

      assert.strictEqual(Number(ord.subtotal), 1500.0);
      assert.strictEqual(Number(ord.shipping_fee), 130.0);
      assert.strictEqual(Number(ord.total_amount), 1630.0);
      assert.strictEqual(Number(ord.advance_amount), 280.0, 'advance_amount must equal 280.00 (150 item + 130 shipping)');
      assert.strictEqual(Number(ord.due_amount), 1350.0, 'due_amount must equal 1350.00');
      assert.strictEqual(
        Number(ord.advance_amount) + Number(ord.due_amount),
        Number(ord.total_amount),
        'advance_amount + due_amount MUST strictly equal total_amount'
      );
      assert.strictEqual(ord.advance_payment_status, 'unpaid');

      // Verify line items in DB
      const [dbItems] = await pool.query(
        'SELECT variant_id, line_total, advance_amount FROM order_items WHERE order_id = ? ORDER BY id ASC',
        [ord.id]
      );
      assert.strictEqual(dbItems.length, 3);
      const itemAdv30 = dbItems.find((i) => i.variant_id === testVarAdv30);
      const itemAdvDel = dbItems.find((i) => i.variant_id === testVarAdvDeliv);
      const itemAdv0 = dbItems.find((i) => i.variant_id === testVarAdv0);

      assert.strictEqual(Number(itemAdv30.advance_amount), 150.0, 'Item 30% advance_amount must be 150.00');
      assert.strictEqual(Number(itemAdvDel.advance_amount), 0.0, 'Delivery advance item line advance_amount is 0 (borne in order advance)');
      assert.strictEqual(Number(itemAdv0.advance_amount), 0.0, 'Item 0% advance_amount must be 0.00');
    });

    it('Scenario 2: Mixed Cart Above Free Shipping Threshold (30% + Delivery Charge + 0%)', async () => {
      // Items:
      // Item 1 (Adv 30%): 1 x 500 = 500. Item advance = 150.00.
      // Item 2 (Adv Delivery): 1 x 600 = 600. Requires delivery advance = true.
      // Item 3 (Adv 0%): 4 x 400 = 1600.
      // Subtotal = 500 + 600 + 1600 = 2700.00 (>= 2500.00 free shipping threshold).
      // Shipping Fee = 0.00.
      // Total Amount = 2700.00.
      // Delivery advance = 0.00 (because shipping fee is 0.00).
      // Required Advance = 150.00.
      // Due on Delivery = 2700 - 150 = 2550.00.

      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validOutsideDhakaAddress,
          payment_method: 'nagad',
          transaction_id: `ADV-MIX-ABOVE-${ts}`,
          sender_phone: '01811001122',
          items: [
            { variant_id: testVarAdv30, quantity: 1 },
            { variant_id: testVarAdvDeliv, quantity: 1 },
            { variant_id: testVarAdv0, quantity: 4 },
          ],
        });

      assert.strictEqual(res.statusCode, 201, `Failed mixed above threshold: ${JSON.stringify(res.body)}`);
      const ord = res.body.data;
      createdOrderIds.push(ord.id);

      assert.strictEqual(Number(ord.subtotal), 2700.0);
      assert.strictEqual(Number(ord.shipping_fee), 0.0, 'Shipping fee must be 0 for subtotal >= 2500');
      assert.strictEqual(Number(ord.total_amount), 2700.0);
      assert.strictEqual(Number(ord.advance_amount), 150.0, 'advance_amount must equal 150.00 (shipping fee is 0)');
      assert.strictEqual(Number(ord.due_amount), 2550.0, 'due_amount must equal 2550.00');
      assert.strictEqual(
        Number(ord.advance_amount) + Number(ord.due_amount),
        Number(ord.total_amount),
        'advance_amount + due_amount MUST strictly equal total_amount'
      );
    });

    it('Scenario 3: 100% Full Advance Item (Full Advance + Shipping Fee)', async () => {
      // Item 1 (Full): 1 x 1200 = 1200.
      // Shipping inside Dhaka: 70.00.
      // Total Amount: 1200 + 70 = 1270.00.
      // allItemsFullAdvance is true -> deliveryAdvance = shippingFee = 70.00.
      // Required advance = 1200 + 70 = 1270.00.
      // Due on Delivery = 0.00.

      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'rocket',
          transaction_id: `ADV-FULL-${ts}`,
          sender_phone: '01911001122',
          items: [{ variant_id: testVarAdvFull, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const ord = res.body.data;
      createdOrderIds.push(ord.id);

      assert.strictEqual(Number(ord.subtotal), 1200.0);
      assert.strictEqual(Number(ord.shipping_fee), 70.0);
      assert.strictEqual(Number(ord.total_amount), 1270.0);
      assert.strictEqual(Number(ord.advance_amount), 1270.0, 'advance_amount must equal 100% of order total (1270)');
      assert.strictEqual(Number(ord.due_amount), 0.0, 'due_amount must be 0 for full advance order');
      assert.strictEqual(
        Number(ord.advance_amount) + Number(ord.due_amount),
        Number(ord.total_amount),
        'advance_amount + due_amount MUST strictly equal total_amount'
      );
    });

    it('rejects pure unbacked COD when required advance > 0', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'cod',
          items: [{ variant_id: testVarAdv30, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('Advance payment of ৳150 is required'));
    });

    it('allows COD order when customer supplies an advance TrxID', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'cod',
          transaction_id: `COD-ADV-BACKED-${ts}`,
          sender_phone: '01711998877',
          items: [{ variant_id: testVarAdv30, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.payment_method, 'cash_on_delivery');
      assert.strictEqual(Number(res.body.data.advance_amount), 150.0);
      assert.strictEqual(res.body.data.transaction_id, `COD-ADV-BACKED-${ts}`);
      createdOrderIds.push(res.body.data.id);
    });
  });

  // =========================================================================
  // SECTION 3: Product Discounts Adversarial Verification
  // =========================================================================
  describe('3. Product Discounts: Edge Cases & Pricing Precedence Stress Testing', () => {
    let excessFixedProdId;
    let excessFixedVarId;
    let excessPercentProdId;
    let excessPercentVarId;
    let precedenceProdId;
    let precedenceVarHighId;
    let precedenceVarLowId;

    it('Fixed discount > base_price (1500 discount on 1000 base_price) clamps to 0 (no negative prices)', async () => {
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Excess Fixed Discount Product ${ts}`,
          base_price: 1000.0,
          discount_type: 'fixed',
          discount_value: 1500.0,
          is_active: 1,
          variants: [
            {
              sku: `EXC-FIX-${ts}`,
              size: 'M',
              color: 'Gold',
              price: 1000.0,
              stock_quantity: 10,
              is_active: 1,
            },
          ],
        });

      assert.strictEqual(res.statusCode, 201);
      excessFixedProdId = res.body.data.id;
      excessFixedVarId = res.body.data.variants[0].id;
      createdProductIds.push(excessFixedProdId);

      // discount_price must be clamped to 0.00 (Math.max(0, 1000 - 1500) = 0)
      assert.strictEqual(Number(res.body.data.discount_price), 0.0);

      // CartModel effective_price query
      await CartModel.addItem(testUserId, excessFixedProdId, excessFixedVarId, 1);
      const cartItems = await CartModel.getItemsByUserId(testUserId);
      const item = cartItems.find((i) => i.product_id === excessFixedProdId);
      assert.ok(item);
      assert.strictEqual(Number(item.effective_price), 0.0, 'Effective price must be clamped to 0.00');
      assert.strictEqual(Number(item.line_total), 0.0, 'Line total must be 0.00');
      await CartModel.clearCart(testUserId);
    });

    it('Percentage discount > 100% probing (150% discount on 1000 base_price)', async () => {
      // Test how the system responds to percentage discount > 100%
      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Excess Percent Discount Product ${ts}`,
          base_price: 1000.0,
          discount_type: 'percentage',
          discount_value: 150.0,
          is_active: 1,
          variants: [
            {
              sku: `EXC-PCT-${ts}`,
              size: 'M',
              color: 'Crimson',
              price: 1000.0,
              stock_quantity: 10,
              is_active: 1,
            },
          ],
        });

      assert.strictEqual(res.statusCode, 201);
      excessPercentProdId = res.body.data.id;
      excessPercentVarId = res.body.data.variants[0].id;
      createdProductIds.push(excessPercentProdId);

      // EMPIRICAL OBSERVATION:
      // The API currently accepts discount_value = 150 because route validator is `isFloat({ min: 0 })` without max: 100.
      // In resolveDiscountData: 1000 * (1 - 1.5) = -500.00!
      const computedPrice = Number(res.body.data.discount_price);
      // Let's document exact observed value:
      console.log(`[EMPIRICAL OBSERVATION] 150% discount computed discount_price: ${computedPrice}`);
      // Now test what happens in cart:
      await CartModel.addItem(testUserId, excessPercentProdId, excessPercentVarId, 1);
      const cartItems = await CartModel.getItemsByUserId(testUserId);
      const item = cartItems.find((i) => i.product_id === excessPercentProdId);
      console.log(`[EMPIRICAL OBSERVATION] Cart item effective_price with 150% discount: ${item.effective_price}`);
      await CartModel.clearCart(testUserId);
    });

    it('Discount precedence: Variant price exists and discount applied to variant price', async () => {
      // Product base_price = 1000.
      // Variant High: price = 1400.
      // Variant Low: price = 800.
      // Product discount_type = 'percentage', discount_value = 20%.
      // High variant price after 20% discount: 1400 * 0.8 = 1120.00.
      // Low variant price after 20% discount: 800 * 0.8 = 640.00.

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Precedence Multi-Variant Garment ${ts}`,
          base_price: 1000.0,
          discount_type: 'percentage',
          discount_value: 20.0,
          is_active: 1,
          variants: [
            {
              sku: `PREC-HI-${ts}`,
              size: 'XL',
              color: 'Navy',
              price: 1400.0,
              stock_quantity: 10,
              is_active: 1,
            },
            {
              sku: `PREC-LO-${ts}`,
              size: 'S',
              color: 'Navy',
              price: 800.0,
              stock_quantity: 10,
              is_active: 1,
            },
          ],
        });

      assert.strictEqual(res.statusCode, 201);
      precedenceProdId = res.body.data.id;
      precedenceVarHighId = res.body.data.variants.find((v) => v.sku === `PREC-HI-${ts}`).id;
      precedenceVarLowId = res.body.data.variants.find((v) => v.sku === `PREC-LO-${ts}`).id;
      createdProductIds.push(precedenceProdId);

      // Verify CartModel calculation for High variant
      await CartModel.addItem(testUserId, precedenceProdId, precedenceVarHighId, 1);
      const cartItemsHi = await CartModel.getItemsByUserId(testUserId);
      const itemHi = cartItemsHi.find((i) => i.variant_id === precedenceVarHighId);
      assert.ok(itemHi);
      assert.strictEqual(itemHi.unit_price, 1400.0);
      assert.strictEqual(itemHi.effective_price, 1120.0, '20% discount on 1400 variant price must equal 1120.00');
      assert.strictEqual(itemHi.line_total, 1120.0);
      await CartModel.clearCart(testUserId);

      // Verify CartModel calculation for Low variant
      await CartModel.addItem(testUserId, precedenceProdId, precedenceVarLowId, 1);
      const cartItemsLo = await CartModel.getItemsByUserId(testUserId);
      const itemLo = cartItemsLo.find((i) => i.variant_id === precedenceVarLowId);
      assert.ok(itemLo);
      assert.strictEqual(itemLo.unit_price, 800.0);
      assert.strictEqual(itemLo.effective_price, 640.0, '20% discount on 800 variant price must equal 640.00');
      assert.strictEqual(itemLo.line_total, 640.0);
      await CartModel.clearCart(testUserId);

      // Direct Order Item resolution check
      const directOrderRes = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: validDhakaAddress,
          payment_method: 'cod',
          items: [{ variant_id: precedenceVarHighId, quantity: 2 }],
        });
      assert.strictEqual(directOrderRes.statusCode, 201);
      const dirOrd = directOrderRes.body.data;
      createdOrderIds.push(dirOrd.id);
      assert.strictEqual(Number(dirOrd.subtotal), 2240.0, 'Subtotal must be 1120 * 2 = 2240.00');
    });

    it('Discount precedence: explicit discount_price vs variant price', async () => {
      // Product base_price = 1000, discount_type = 'none', discount_price = 950.
      // Variant High: price = 1400 -> discount_price 950 < 1400 -> effective_price = 950.
      // Variant Low: price = 800 -> 950 is NOT < 800 -> effective_price = 800 (lowest price).
      const pRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Explicit Discount Price Test ${ts}`,
          base_price: 1000.0,
          discount_type: 'none',
          discount_price: 950.0,
          is_active: 1,
          variants: [
            {
              sku: `EXPLICIT-HI-${ts}`,
              size: 'XL',
              color: 'Black',
              price: 1400.0,
              stock_quantity: 10,
              is_active: 1,
            },
            {
              sku: `EXPLICIT-LO-${ts}`,
              size: 'S',
              color: 'Black',
              price: 800.0,
              stock_quantity: 10,
              is_active: 1,
            },
          ],
        });

      assert.strictEqual(pRes.statusCode, 201);
      const pId = pRes.body.data.id;
      const vHiId = pRes.body.data.variants.find((v) => v.sku === `EXPLICIT-HI-${ts}`).id;
      const vLoId = pRes.body.data.variants.find((v) => v.sku === `EXPLICIT-LO-${ts}`).id;
      createdProductIds.push(pId);

      // 1. Verify that resolveDiscountData converted discount_price 950 into fixed discount 50 BDT (1000 - 950 = 50)
      assert.strictEqual(pRes.body.data.discount_type, 'fixed');
      assert.strictEqual(Number(pRes.body.data.discount_value), 50.0);

      // In cart: variant 1400 minus fixed discount 50 yields 1350
      await CartModel.addItem(testUserId, pId, vHiId, 1);
      const itemsHi = await CartModel.getItemsByUserId(testUserId);
      const itemHi = itemsHi.find((i) => i.variant_id === vHiId);
      assert.strictEqual(itemHi.effective_price, 1350.0, 'Fixed discount of 50 off 1400 variant price yields 1350');
      await CartModel.clearCart(testUserId);

      // 2. Now test SQL CASE branch where discount_type is explicitly 'none' and discount_price = 950:
      await pool.query('UPDATE products SET discount_type = "none", discount_value = 0, discount_price = 950.00 WHERE id = ?', [pId]);

      // High variant: discount_price (950) < variant price (1400) -> SQL CASE evaluates to 950!
      await CartModel.addItem(testUserId, pId, vHiId, 1);
      const itemsHiDirect = await CartModel.getItemsByUserId(testUserId);
      const itemHiDirect = itemsHiDirect.find((i) => i.variant_id === vHiId);
      assert.strictEqual(itemHiDirect.effective_price, 950.0, 'When discount_type is none, CartModel prioritizes discount_price 950 over variant price 1400');
      await CartModel.clearCart(testUserId);

      // Low variant: variant price 800 is LESS than discount_price 950 -> SQL CASE evaluates to 800!
      await CartModel.addItem(testUserId, pId, vLoId, 1);
      const itemsLoDirect = await CartModel.getItemsByUserId(testUserId);
      const itemLoDirect = itemsLoDirect.find((i) => i.variant_id === vLoId);
      assert.strictEqual(itemLoDirect.effective_price, 800.0, 'When variant price 800 is less than discount_price 950, CartModel preserves variant price 800');
      await CartModel.clearCart(testUserId);
    });
  });

  // =========================================================================
  // SECTION 4: Action Logging Synchronization Verification
  // =========================================================================
  describe('4. Action Logging in plan.md Verification', () => {
    const fs = require('fs');
    const path = require('path');

    it('verifies plan.md exists and contains the action log', () => {
      const planLower = path.resolve(__dirname, '../../plan.md');

      assert.ok(fs.existsSync(planLower), 'plan.md must exist');

      const lowerContent = fs.readFileSync(planLower, 'utf8');

      assert.ok(lowerContent.includes('## Project Action & Command Execution Log'), 'plan.md must contain Action Log table');
      assert.ok(lowerContent.includes('worker_m1_iter1_1'), 'plan.md must record worker actions');
    });
  });
});
