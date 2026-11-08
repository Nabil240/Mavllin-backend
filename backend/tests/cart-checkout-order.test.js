const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Variant Cart, COD Checkout, Order Lifecycle & Admin Operations', () => {
  let adminToken;
  let customerToken;
  let testProductId;
  let variantMId;
  let variantLId;
  let customerOrderId;
  let customerOrderNumber;
  let guestOrderId;
  let guestOrderNumber;
  const ts = Date.now();
  const skuM = `ECO-CHECKOUT-${ts}-M`;
  const skuL = `ECO-CHECKOUT-${ts}-L`;

  before(async () => {
    adminToken = getAdminToken();
    customerToken = getCustomerToken();

    // Clear customer cart before starting
    await request(app)
      .delete('/api/v1/cart')
      .set('Authorization', `Bearer ${customerToken}`);

    // Create a test product with two variants
    const res = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Checkout Linen Jacket ${ts}`,
        short_description: 'Breathable linen jacket for checkout verification',
        base_price: 45.0,
        is_active: 1,
        variants: [
          {
            sku: skuM,
            size: 'M',
            color: 'Olive',
            price: 45.0,
            compare_at_price: 55.0,
            stock_quantity: 10,
            is_active: 1,
          },
          {
            sku: skuL,
            size: 'L',
            color: 'Olive',
            price: 48.0,
            compare_at_price: 58.0,
            stock_quantity: 6,
            is_active: 1,
          },
        ],
      });

    assert.strictEqual(res.statusCode, 201);
    testProductId = res.body.data.id;
    variantMId = res.body.data.variants.find((v) => v.size === 'M').id;
    variantLId = res.body.data.variants.find((v) => v.size === 'L').id;
  });

  after(async () => {
    // Clean up test orders and product
    if (customerOrderId) {
      await pool.query('DELETE FROM inventory_movements WHERE reference_order_id = ?', [customerOrderId]);
      await pool.query('DELETE FROM orders WHERE id = ?', [customerOrderId]);
    }
    if (guestOrderId) {
      await pool.query('DELETE FROM inventory_movements WHERE reference_order_id = ?', [guestOrderId]);
      await pool.query('DELETE FROM orders WHERE id = ?', [guestOrderId]);
    }
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    }
  });

  describe('1. Banners, Search & Parent Category Filtering', () => {
    it('GET /api/v1/banners returns active promotional banners', async () => {
      const res = await request(app).get('/api/v1/banners');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
    });

    it('GET /api/v1/search?q=Linen returns matching products with hydrated images and variants', async () => {
      const res = await request(app).get('/api/v1/search?q=Linen');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length > 0);
      assert.ok(Array.isArray(res.body.data[0].variants));
      assert.ok(Array.isArray(res.body.data[0].images));
    });
  });

  describe('2. Variant-Aware Shopping Cart & Guest Merge', () => {
    it('POST /api/v1/cart adds variant to cart and returns variant details', async () => {
      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          variant_id: variantMId,
          quantity: 2,
        });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.items.length, 1);
      const item = res.body.data.items[0];
      assert.strictEqual(item.variant_id, variantMId);
      assert.strictEqual(item.variant_sku, skuM);
      assert.strictEqual(item.size, 'M');
      assert.strictEqual(item.color, 'Olive');
      assert.strictEqual(item.quantity, 2);
      assert.strictEqual(item.unit_price, 45);
      assert.strictEqual(item.line_total, 90);
      assert.strictEqual(res.body.data.summary.subtotal, 90);
    });

    it('POST /api/v1/cart rejects quantity exceeding variant stock_quantity with 400', async () => {
      const res = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          variant_id: variantMId,
          quantity: 9, // 2 already in cart + 9 = 11 > 10 available
        });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.ok(res.body.message.includes('available in stock'));
    });

    it('PUT /api/v1/cart/:id updates variant quantity in cart', async () => {
      const res = await request(app)
        .put(`/api/v1/cart/${variantMId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 3 });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.items[0].quantity, 3);
      assert.strictEqual(res.body.data.summary.subtotal, 135);
    });

    it('POST /api/v1/cart/merge merges guest cart items capped at available stock', async () => {
      const res = await request(app)
        .post('/api/v1/cart/merge')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          items: [
            { variant_id: variantLId, quantity: 2 },
          ],
        });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.items.length, 2);
      assert.strictEqual(res.body.data.summary.total_items, 5); // 3 of M + 2 of L
      assert.strictEqual(res.body.data.summary.subtotal, 231); // 135 + 96
    });
  });

  describe('3. Authenticated & Guest COD Checkout + Atomic Stock Deduction', () => {
    it('POST /api/v1/orders places COD order from cart, deducts variant stock, logs movement & clears cart', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Nabil Customer',
            phone: '+8801711223344',
            street_address: 'House 12, Road 5, Dhanmondi',
            area: 'Dhanmondi',
            city: 'Dhaka',
            postal_code: '1209',
            country: 'Bangladesh',
          },
          payment_provider: 'cod',
          notes: 'Deliver before 5pm',
        });

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.body.success, true);

      const order = res.body.data;
      customerOrderId = order.id;
      customerOrderNumber = order.order_number;

      assert.strictEqual(order.status, 'pending');
      assert.strictEqual(order.payment_status, 'unpaid');
      assert.strictEqual(Number(order.subtotal), 231);
      assert.strictEqual(Number(order.shipping_fee), 70); // Inside Dhaka BDT ৳70 (under ৳2500)
      assert.strictEqual(Number(order.total_amount), 301);
      assert.strictEqual(order.items.length, 2);
      assert.ok(order.items.some((i) => i.variant_sku === skuM && i.variant_size === 'M' && i.quantity === 3));
      assert.ok(order.items.some((i) => i.variant_sku === skuL && i.variant_size === 'L' && i.quantity === 2));
      assert.ok(Array.isArray(order.status_history));
      assert.strictEqual(order.status_history.length, 1);

      // Verify variant stock was deducted (M: 10 -> 7, L: 6 -> 4)
      const [vRows] = await pool.query('SELECT id, stock_quantity FROM product_variants WHERE id IN (?, ?)', [
        variantMId,
        variantLId,
      ]);
      const stockMap = Object.fromEntries(vRows.map((r) => [r.id, r.stock_quantity]));
      assert.strictEqual(stockMap[variantMId], 7);
      assert.strictEqual(stockMap[variantLId], 4);

      // Verify cart was emptied
      const cartRes = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${customerToken}`);
      assert.strictEqual(cartRes.body.data.items.length, 0);
    });

    it('POST /api/v1/orders/guest places a guest COD order with Dhaka shipping fee (৳70 under ৳2500)', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: 'guest.buyer@example.com',
          shipping_address: {
            recipient_name: 'Guest Shopper',
            phone: '+8801811223344',
            street_address: 'Banani Road 11',
            city: 'Dhaka',
            postal_code: '1213',
          },
          payment_provider: 'cod',
          items: [{ variant_id: variantLId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      guestOrderId = order.id;
      guestOrderNumber = order.order_number;

      assert.strictEqual(order.user_id, null);
      assert.strictEqual(order.guest_email, 'guest.buyer@example.com');
      assert.strictEqual(Number(order.subtotal), 48);
      assert.strictEqual(Number(order.shipping_fee), 70); // Inside Dhaka BDT ৳70
      assert.strictEqual(Number(order.total_amount), 118);

      // Verify L stock deducted from 4 to 3
      const [vRow] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantLId]);
      assert.strictEqual(vRow[0].stock_quantity, 3);
    });
  });

  describe('4. Order Tracking, Status Transitions & Cancellation with Stock Restoration', () => {
    it('GET /api/v1/orders/track/:orderNumber returns public tracking info for guest order', async () => {
      const res = await request(app).get(`/api/v1/orders/track/${guestOrderNumber}`);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.order_number, guestOrderNumber);
      assert.strictEqual(res.body.data.status, 'pending');
    });

    it('PUT /api/v1/orders/:id/status transitions guest order pending -> confirmed -> shipped -> delivered', async () => {
      const res1 = await request(app)
        .put(`/api/v1/orders/${guestOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed', note: 'Verified by phone' });
      assert.strictEqual(res1.statusCode, 200);
      assert.strictEqual(res1.body.data.status, 'confirmed');

      const res2 = await request(app)
        .put(`/api/v1/orders/${guestOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped', courier_name: 'Pathao Courier', tracking_number: 'PTH-998877' });
      assert.strictEqual(res2.statusCode, 200);
      assert.strictEqual(res2.body.data.status, 'shipped');
      assert.strictEqual(res2.body.data.courier_name, 'Pathao Courier');

      const res3 = await request(app)
        .put(`/api/v1/orders/${guestOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'delivered' });
      assert.strictEqual(res3.statusCode, 200);
      assert.strictEqual(res3.body.data.status, 'delivered');
      assert.strictEqual(res3.body.data.payment_status, 'paid');
    });

    it('PUT /api/v1/orders/:id/status rejects invalid transition from terminal delivered status with 400', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${guestOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled' });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
    });

    it('POST /api/v1/orders/:id/cancel cancels pending customer order and restores variant stock atomically', async () => {
      const res = await request(app)
        .post(`/api/v1/orders/${customerOrderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'Changed my mind on size' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.status, 'cancelled');
      assert.strictEqual(res.body.data.cancellation_reason, 'Changed my mind on size');

      // Stock of M should be restored from 7 back to 10; L from 3 back to 5 (since guest bought 1)
      const [vRows] = await pool.query('SELECT id, stock_quantity FROM product_variants WHERE id IN (?, ?)', [
        variantMId,
        variantLId,
      ]);
      const stockMap = Object.fromEntries(vRows.map((r) => [r.id, r.stock_quantity]));
      assert.strictEqual(stockMap[variantMId], 10);
      assert.strictEqual(stockMap[variantLId], 5);

      // Verify order_cancelled movement was recorded
      const [movs] = await pool.query(
        "SELECT * FROM inventory_movements WHERE reference_order_id = ? AND reason = 'order_cancelled'",
        [customerOrderId]
      );
      assert.strictEqual(movs.length, 2);
    });
  });

  describe('5. Admin Dashboard, Inventory Adjustments & Sales Report', () => {
    it('GET /api/v1/admin/dashboard returns 200 with variant-aware low_stock_products', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.stats);
      assert.ok(Array.isArray(res.body.data.low_stock_products));
      assert.ok(Array.isArray(res.body.data.recent_orders));
    });

    it('GET /api/v1/admin/inventory returns paginated variant inventory', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/inventory?search=${skuM}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.some((v) => v.sku === skuM));
    });

    it('POST /api/v1/admin/inventory/adjustments adjusts variant stock and logs movement with note', async () => {
      const res = await request(app)
        .post('/api/v1/admin/inventory/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variant_id: variantLId,
          quantity_delta: 4,
          reason: 'restock',
          note: 'Supplier restock batch #42',
        });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.beforeQty, 5);
      assert.strictEqual(res.body.data.afterQty, 9);

      const movRes = await request(app)
        .get(`/api/v1/admin/inventory/movements?variantId=${variantLId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(movRes.statusCode, 200);
      assert.ok(movRes.body.data.some((m) => m.note === 'Supplier restock batch #42' && m.reason === 'restock'));
    });

    it('GET /api/v1/admin/reports/sales returns 200 with sales breakdown', async () => {
      const res = await request(app)
        .get('/api/v1/admin/reports/sales')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data.summary);
      assert.ok(Array.isArray(res.body.data.orders_by_status));
      assert.ok(Array.isArray(res.body.data.payments_by_provider));
    });
  });

  describe('6. Auth Forgot Password, Reset Password & Logout', () => {
    it('POST /api/v1/auth/forgot-password & /reset-password & /logout work end-to-end', async () => {
      const [users] = await pool.query('SELECT email FROM users WHERE role = "customer" LIMIT 1');
      const testEmail = users[0].email;

      const forgotRes = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testEmail });

      assert.strictEqual(forgotRes.statusCode, 200);
      assert.ok(forgotRes.body.data.reset_token);

      const resetRes = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          token: forgotRes.body.data.reset_token,
          newPassword: 'Customer@123',
        });

      assert.strictEqual(resetRes.statusCode, 200);

      const logoutRes = await request(app).post('/api/v1/auth/logout');
      assert.strictEqual(logoutRes.statusCode, 200);
    });
  });
});
