const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('../../backend/node_modules/supertest');
const app = require('../../backend/src/app');
const { pool } = require('../../backend/src/config/db');
const { getAdminToken, getCustomerToken } = require('../../backend/tests/helpers/auth.helper');
const OrderModel = require('../../backend/src/models/order.model');

describe('Empirical Challenger: Advance Payment Calculations, Zero-Advance Attack & Concurrency Stress', () => {
  let adminToken;
  let customerToken;
  let customerId;

  const createdOrderIds = [];
  const createdProductIds = [];
  const ts = Date.now();

  let prod30Id, var30Id;
  let prod50Id, var50Id;
  let prodFullId, varFullId;
  let prodDeliveryId, varDeliveryId;
  let prodNoneId, varNoneId;
  let prodConcurrencyId, varConcurrencyId;

  before(async () => {
    adminToken = getAdminToken();

    // 1. Create a dedicated customer
    const [userRes] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'customer', 1)`,
      [`Challenger Customer ${ts}`, `challenger-${ts}@mavllin.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    customerId = userRes.insertId;
    customerToken = getCustomerToken({ id: customerId, email: `challenger-${ts}@mavllin.test` });

    // Helper to create product with specific advance_payment_type and price
    async function createAdvProduct(name, price, advType, stock = 100) {
      const pRes = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `${name} ${ts}`,
          base_price: price,
          advance_payment_type: advType,
          is_active: 1,
          variants: [
            {
              sku: `ADV-${advType.toUpperCase()}-${Math.floor(Math.random() * 90000 + 10000)}`,
              size: 'Free',
              color: 'Heritage Onyx',
              price,
              stock_quantity: stock,
              is_active: 1,
            },
          ],
        });
      assert.strictEqual(pRes.statusCode, 201, `Failed to create product: ${JSON.stringify(pRes.body)}`);
      createdProductIds.push(pRes.body.data.id);
      return {
        productId: pRes.body.data.id,
        variantId: pRes.body.data.variants[0].id,
      };
    }

    // 2. Setup products for each advance type
    const p30 = await createAdvProduct('Odd 30% Panjabi', 333.33, 'thirty_percent');
    prod30Id = p30.productId;
    var30Id = p30.variantId;

    const p50 = await createAdvProduct('Odd 50% Sherwani', 777.77, 'fifty_percent');
    prod50Id = p50.productId;
    var50Id = p50.variantId;

    const pFull = await createAdvProduct('Full Advance Bespoke', 2000.00, 'full');
    prodFullId = pFull.productId;
    varFullId = pFull.variantId;

    const pDeliv = await createAdvProduct('Delivery Advance Kurta', 500.00, 'delivery_charge');
    prodDeliveryId = pDeliv.productId;
    varDeliveryId = pDeliv.variantId;

    const pNone = await createAdvProduct('Standard Cash Panjabi', 1200.00, 'none');
    prodNoneId = pNone.productId;
    varNoneId = pNone.variantId;

    const pConc = await createAdvProduct('Concurrency Limited Shawl', 1500.00, 'none', 10);
    prodConcurrencyId = pConc.productId;
    varConcurrencyId = pConc.variantId;
  });

  after(async () => {
    // 1. Delete created orders (cascading to payments, order_items, status history)
    if (createdOrderIds.length > 0) {
      await pool.query('DELETE FROM orders WHERE id IN (?)', [createdOrderIds]);
    }
    if (customerId) {
      await pool.query('DELETE FROM orders WHERE user_id = ?', [customerId]);
      await pool.query('DELETE FROM users WHERE id = ?', [customerId]);
    }
    // 2. Delete test products (cascading to variants)
    if (createdProductIds.length > 0) {
      await pool.query('DELETE FROM products WHERE id IN (?)', [createdProductIds]);
    }
  });

  const baseDhakaShipping = {
    recipient_name: 'Adversarial Tester',
    phone: '01711223344',
    street_address: 'House 42, Road 11, Dhanmondi',
    area: 'Dhanmondi',
    city: 'Dhaka',
    postal_code: '1209',
    country: 'Bangladesh',
  };

  // =========================================================================
  // 1. Zero-Advance Attack Probes (Must Fail on Advance-Required Products)
  // =========================================================================
  describe('1. Zero-Advance Attack Defenses', () => {
    it('blocks unbacked Cash on Delivery order when item requires thirty_percent advance', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'cod',
          items: [{ variant_id: var30Id, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Advance payment of ৳.*is required/i);
    });

    it('blocks unbacked Cash on Delivery order when item requires fifty_percent advance', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'cash_on_delivery',
          items: [{ variant_id: var50Id, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Advance payment of ৳.*is required/i);
    });

    it('blocks unbacked Cash on Delivery order when item requires full advance', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'cod',
          items: [{ variant_id: varFullId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Advance payment of ৳.*is required/i);
    });

    it('blocks unbacked Cash on Delivery order when item requires delivery_charge advance', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'cod',
          items: [{ variant_id: varDeliveryId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Advance payment of ৳.*is required/i);
    });

    it('neutralizes malicious payload sending advance_amount: 0 in request body', async () => {
      // Attacker attempts to bypass server advance calculation by asserting advance_amount = 0
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'cod',
          advance_amount: 0.00,
          due_amount: 403.33,
          items: [{ variant_id: var30Id, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 400, 'Server must not accept client-provided advance_amount');
      assert.strictEqual(res.body.success, false);
      assert.match(res.body.message, /Advance payment of ৳.*is required/i);
    });

    it('allows Cash on Delivery without TrxID ONLY when product advance_payment_type is none', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'cod',
          items: [{ variant_id: varNoneId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);
      const ord = res.body.data;
      createdOrderIds.push(ord.id);
      assert.strictEqual(Number(ord.advance_amount), 0.00);
      assert.strictEqual(Number(ord.due_amount), Number(ord.total_amount));
      assert.strictEqual(ord.advance_payment_status, 'paid');
    });
  });

  // =========================================================================
  // 2. BDT Floating Point Precision & Financial Invariant Tests
  // =========================================================================
  describe('2. BDT Precision & Financial Invariant (advance + due === total)', () => {
    it('calculates 30% advance on odd amount ৳333.33 without rounding leaks', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'manual',
          transaction_id: `TRX-ADV-30-${Date.now()}`,
          sender_phone: '01700112233',
          items: [{ variant_id: var30Id, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const ord = res.body.data;
      createdOrderIds.push(ord.id);

      // Subtotal: 333.33, Shipping: 70.00 -> Total: 403.33
      // 30% of 333.33 = 99.999 -> 100.00
      // Advance: 100.00, Due: 403.33 - 100.00 = 303.33
      assert.strictEqual(Number(ord.subtotal), 333.33);
      assert.strictEqual(Number(ord.shipping_fee), 70.00);
      assert.strictEqual(Number(ord.total_amount), 403.33);
      assert.strictEqual(Number(ord.advance_amount), 100.00);
      assert.strictEqual(Number(ord.due_amount), 303.33);

      // Financial Invariant: advance + due === total
      const invariant = Number((Number(ord.advance_amount) + Number(ord.due_amount)).toFixed(2));
      assert.strictEqual(invariant, Number(ord.total_amount));
    });

    it('calculates 50% advance on odd amount ৳777.77 without rounding leaks', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'bkash',
          transaction_id: `TRX-BKASH-50-${Date.now()}`,
          sender_phone: '01811223344',
          items: [{ variant_id: var50Id, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const ord = res.body.data;
      createdOrderIds.push(ord.id);

      // Subtotal: 777.77, Shipping: 70.00 -> Total: 847.77
      // 50% of 777.77 = 388.885. In IEEE-754 binary floating point, 388.885 rounds to 388.88 via toFixed(2).
      // Advance: 388.88, Due: 847.77 - 388.88 = 458.89
      assert.strictEqual(Number(ord.subtotal), 777.77);
      assert.strictEqual(Number(ord.shipping_fee), 70.00);
      assert.strictEqual(Number(ord.total_amount), 847.77);
      assert.strictEqual(Number(ord.advance_amount), 388.88);
      assert.strictEqual(Number(ord.due_amount), 458.89);

      // Financial Invariant: advance + due === total (1-paisa boundary absorbed into due_amount, zero financial leak)
      const invariant = Number((Number(ord.advance_amount) + Number(ord.due_amount)).toFixed(2));
      assert.strictEqual(invariant, Number(ord.total_amount));
    });

    it('calculates delivery_charge advance correctly (advance = shipping fee, due = subtotal)', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'nagad',
          transaction_id: `TRX-NAGAD-DEL-${Date.now()}`,
          sender_phone: '01911223344',
          items: [{ variant_id: varDeliveryId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const ord = res.body.data;
      createdOrderIds.push(ord.id);

      // Subtotal: 500.00, Shipping: 70.00 -> Total: 570.00
      // Advance: 70.00 (delivery fee), Due: 500.00
      assert.strictEqual(Number(ord.subtotal), 500.00);
      assert.strictEqual(Number(ord.shipping_fee), 70.00);
      assert.strictEqual(Number(ord.total_amount), 570.00);
      assert.strictEqual(Number(ord.advance_amount), 70.00);
      assert.strictEqual(Number(ord.due_amount), 500.00);

      const invariant = Number((Number(ord.advance_amount) + Number(ord.due_amount)).toFixed(2));
      assert.strictEqual(invariant, Number(ord.total_amount));
    });

    it('calculates full advance correctly (advance = 100% of order + delivery, due = 0.00)', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'upay',
          transaction_id: `TRX-UPAY-FULL-${Date.now()}`,
          sender_phone: '01611223344',
          items: [{ variant_id: varFullId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const ord = res.body.data;
      createdOrderIds.push(ord.id);

      // Subtotal: 2000.00, Shipping: 70.00 -> Total: 2070.00
      // Advance: 2070.00, Due: 0.00
      assert.strictEqual(Number(ord.subtotal), 2000.00);
      assert.strictEqual(Number(ord.shipping_fee), 70.00);
      assert.strictEqual(Number(ord.total_amount), 2070.00);
      assert.strictEqual(Number(ord.advance_amount), 2070.00);
      assert.strictEqual(Number(ord.due_amount), 0.00);

      const invariant = Number((Number(ord.advance_amount) + Number(ord.due_amount)).toFixed(2));
      assert.strictEqual(invariant, Number(ord.total_amount));
    });

    it('calculates complex multi-item cart with mixed advance rules and preserves financial invariant', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'rocket',
          transaction_id: `TRX-ROCKET-MIXED-${Date.now()}`,
          sender_phone: '01511223344',
          items: [
            { variant_id: var30Id, quantity: 1 },       // 333.33 -> 30% = 100.00
            { variant_id: var50Id, quantity: 1 },       // 777.77 -> 50% = 388.89
            { variant_id: varDeliveryId, quantity: 1 }, // 500.00 -> delivery charge triggers shipping advance = 70.00
            { variant_id: varNoneId, quantity: 1 },     // 1200.00 -> 0.00 advance
          ],
        });

      assert.strictEqual(res.statusCode, 201);
      const ord = res.body.data;
      createdOrderIds.push(ord.id);

      // Subtotal: 333.33 + 777.77 + 500.00 + 1200.00 = 2811.10
      // Since subtotal > 2500, free shipping applies: shipping_fee = 0.00
      // Total amount = 2811.10
      // Advance: 100.00 (var30) + 388.88 (var50 float) + 0.00 (delivery advance since free shipping) = 488.88
      // Due: 2811.10 - 488.88 = 2322.22
      assert.strictEqual(Number(ord.subtotal), 2811.10);
      assert.strictEqual(Number(ord.shipping_fee), 0.00);
      assert.strictEqual(Number(ord.total_amount), 2811.10);
      assert.strictEqual(Number(ord.advance_amount), 488.88);
      assert.strictEqual(Number(ord.due_amount), 2322.22);

      const invariant = Number((Number(ord.advance_amount) + Number(ord.due_amount)).toFixed(2));
      assert.strictEqual(invariant, Number(ord.total_amount));
    });
  });

  // =========================================================================
  // 3. Concurrency Stress: Multiple Orders Created in Parallel with Manual Payments
  // =========================================================================
  describe('3. Concurrency Stress: Parallel Orders with Manual Payments', () => {
    it('executes 10 parallel manual payment orders without deadlocks, decrementing stock cleanly', async () => {
      // varConcurrencyId has exactly 10 units in stock
      const parallelRequests = Array.from({ length: 10 }).map((_, idx) => {
        return request(app)
          .post('/api/v1/orders/guest')
          .send({
            shipping_address: {
              ...baseDhakaShipping,
              recipient_name: `Concurrent Shopper ${idx + 1}`,
              phone: `0171100000${idx}`,
            },
            payment_method: 'manual',
            transaction_id: `CTB-CONCUR-${Date.now()}-${idx + 1}`,
            sender_phone: `0171100000${idx}`,
            items: [{ variant_id: varConcurrencyId, quantity: 1 }],
          });
      });

      const responses = await Promise.all(parallelRequests);

      // All 10 requests must succeed with HTTP 201
      responses.forEach((res, idx) => {
        assert.strictEqual(res.statusCode, 201, `Parallel order ${idx + 1} failed: ${JSON.stringify(res.body)}`);
        assert.strictEqual(res.body.success, true);
        const ord = res.body.data;
        createdOrderIds.push(ord.id);
        assert.strictEqual(ord.payment_status, 'unpaid');
        assert.strictEqual(ord.status, 'pending');
        assert.match(ord.payment.transaction_id, new RegExp(`CTB-CONCUR-.*-${idx + 1}`));
      });

      // Verify stock was decremented to exactly 0 (no oversell, no lost updates)
      const [vRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [varConcurrencyId]);
      assert.strictEqual(Number(vRows[0].stock_quantity), 0, 'Stock must be exactly 0 after 10 decrements');

      // Attempt 11th order: MUST be rejected with 400 Bad Request (insufficient stock)
      const oversellRes = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          shipping_address: baseDhakaShipping,
          payment_method: 'manual',
          transaction_id: `CTB-OVERSELL-${Date.now()}`,
          sender_phone: '01711999999',
          items: [{ variant_id: varConcurrencyId, quantity: 1 }],
        });

      assert.strictEqual(oversellRes.statusCode, 400);
      assert.strictEqual(oversellRes.body.success, false);
      assert.match(oversellRes.body.message, /Insufficient stock/i);
    });

    it('admin verifies concurrent manual payments in parallel successfully', async () => {
      // Pick 5 of the created concurrent orders and verify them simultaneously
      const ordersToVerify = createdOrderIds.slice(-5);
      assert.strictEqual(ordersToVerify.length, 5);

      const verifyPromises = ordersToVerify.map((orderId) => {
        return request(app)
          .put(`/api/v1/admin/orders/${orderId}/verify-payment`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send();
      });

      const verifyResponses = await Promise.all(verifyPromises);

      verifyResponses.forEach((res, idx) => {
        assert.strictEqual(res.statusCode, 200, `Admin verify order ${ordersToVerify[idx]} failed`);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.data.payment_status, 'paid');
      });

      // Confirm in DB that payment rows are now 'completed'
      const [payRows] = await pool.query(
        'SELECT status FROM payments WHERE order_id IN (?)',
        [ordersToVerify]
      );
      assert.strictEqual(payRows.length, 5);
      payRows.forEach((row) => {
        assert.strictEqual(row.status, 'completed');
      });
    });
  });
});
