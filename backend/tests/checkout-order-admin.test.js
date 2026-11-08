const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');
const { requireAuth, requireAdmin } = require('../src/middlewares/auth.middleware');

describe('Milestone 3: Checkout, Customer Orders, Admin Order Management & Inventory', () => {
  let adminToken;
  let customerToken;
  let customer2Token;
  let testProductId;
  let variantSmallId;
  let variantLargeId;
  let placedOrderId;
  let placedOrderNumber;
  let guestOrderId;
  const ts = Date.now();
  let m3UserId;
  let m3OtherUserId;
  const skuSmall = `ECO-M3-S-${ts}`;
  const skuLarge = `ECO-M3-L-${ts}`;

  before(async () => {
    // Create isolated customer users for this suite to avoid concurrent cart mutations
    const [u1] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, "customer", 1)',
      [`M3 Cust ${ts}`, `m3-cust-${ts}@projecteco.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    m3UserId = u1.insertId;

    const [u2] = await pool.query(
      'INSERT INTO users (full_name, email, password_hash, role, is_active) VALUES (?, ?, ?, "customer", 1)',
      [`M3 Other ${ts}`, `m3-other-${ts}@projecteco.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    m3OtherUserId = u2.insertId;

    adminToken = getAdminToken({ id: 1, email: 'admin@projecteco.local', role: 'admin' });
    customerToken = getCustomerToken({ id: m3UserId, email: `m3-cust-${ts}@projecteco.test`, role: 'customer' });
    customer2Token = getCustomerToken({ id: m3OtherUserId, email: `m3-other-${ts}@projecteco.test`, role: 'customer' });

    // Create a product with 2 variants for checkout testing
    const createRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Milestone 3 Oxford Shirt ${ts}`,
        short_description: 'Pure cotton button-down shirt',
        base_price: 39.99,
        is_active: 1,
        variants: [
          {
            sku: skuSmall,
            size: 'S',
            color: 'Sky Blue',
            price: 39.99,
            compare_at_price: 49.99,
            stock_quantity: 5,
            is_active: 1,
          },
          {
            sku: skuLarge,
            size: 'L',
            color: 'Sky Blue',
            price: 42.99,
            compare_at_price: 52.99,
            stock_quantity: 2,
            is_active: 1,
          },
        ],
      });

    assert.equal(createRes.statusCode, 201);
    testProductId = createRes.body.data.id;
    const variants = createRes.body.data.variants;
    const varSmall = variants.find((v) => v.sku === skuSmall);
    const varLarge = variants.find((v) => v.sku === skuLarge);
    variantSmallId = varSmall.id;
    variantLargeId = varLarge.id;
  });

  after(async () => {
    // Clean up test orders first due to fk_orders_user ON DELETE RESTRICT
    if (placedOrderId || guestOrderId) {
      await pool.query('DELETE FROM orders WHERE id IN (?, ?)', [placedOrderId || 0, guestOrderId || 0]);
    }
    if (m3UserId) {
      await pool.query('DELETE FROM orders WHERE user_id IN (?, ?)', [m3UserId, m3OtherUserId]);
      await pool.query('DELETE FROM users WHERE id IN (?, ?)', [m3UserId, m3OtherUserId]);
    }
    // Clean up test product and cascade variants
    if (testProductId) {
      await request(app)
        .delete(`/api/v1/products/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  });

  describe('1. Auth Middleware Aliases', () => {
    it('Exports requireAuth and requireAdmin aliases', () => {
      assert.equal(typeof requireAuth, 'function');
      assert.equal(typeof requireAdmin, 'function');
    });
  });

  describe('2. POST /api/v1/checkout/orders (COD Checkout, Stock Deduction & Rollback)', () => {
    it('Successfully places authenticated COD order via /api/v1/checkout/orders', async () => {
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Jane Customer',
            phone: '+8801711000002',
            street_address: 'House 14, Road 11, Banani',
            city: 'Dhaka',
            postal_code: '1213',
            country: 'Bangladesh',
          },
          payment_method: 'cash_on_delivery',
          notes: 'Please call on arrival',
          items: [{ variant_id: variantSmallId, quantity: 2 }],
        });

      assert.equal(res.statusCode, 201, `Failed to place order: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, true);
      const order = res.body.data;
      assert.ok(order.id);
      assert.ok(order.order_number);
      assert.equal(order.user_id, m3UserId);
      assert.equal(order.payment_method, 'cash_on_delivery');
      assert.equal(order.status, 'pending');
      assert.equal(order.payment_status, 'unpaid');
      assert.equal(order.notes, 'Please call on arrival');

      placedOrderId = order.id;
      placedOrderNumber = order.order_number;

      // Verify line items include size, color, subtotal
      assert.ok(Array.isArray(order.items));
      assert.equal(order.items.length, 1);
      const item = order.items[0];
      assert.equal(item.variant_id, variantSmallId);
      assert.equal(item.size, 'S');
      assert.equal(item.color, 'Sky Blue');
      assert.equal(Number(item.quantity), 2);
      assert.equal(Number(item.unit_price), 39.99);
      assert.equal(Number(item.subtotal), 79.98);

      // Verify variant stock was decremented from 5 to 3
      const [vRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantSmallId]);
      assert.equal(Number(vRows[0].stock_quantity), 3);

      // Verify inventory_movements record exists
      const [mRows] = await pool.query(
        'SELECT * FROM inventory_movements WHERE variant_id = ? AND reference_order_id = ?',
        [variantSmallId, placedOrderId]
      );
      assert.equal(mRows.length, 1);
      assert.equal(mRows[0].quantity_delta, -2);
      assert.equal(mRows[0].before_quantity, 5);
      assert.equal(mRows[0].after_quantity, 3);
      assert.equal(mRows[0].reason, 'order_placed');
    });

    it('Successfully places guest COD order via alias /api/v1/checkout', async () => {
      const res = await request(app)
        .post('/api/v1/checkout')
        .send({
          guest_email: 'guest.m3@example.com',
          shipping_address: {
            recipient_name: 'Guest Shopper',
            phone: '+8801899112233',
            street_address: '77 Mohakhali Commercial Area',
            city: 'Dhaka',
            postal_code: '1212',
            country: 'Bangladesh',
          },
          payment_method: 'cash_on_delivery',
          items: [{ variant_id: variantSmallId, quantity: 1 }],
        });

      assert.equal(res.statusCode, 201);
      assert.equal(res.body.success, true);
      const order = res.body.data;
      assert.equal(order.user_id, null);
      assert.equal(order.guest_email, 'guest.m3@example.com');
      assert.equal(order.payment_method, 'cash_on_delivery');
      guestOrderId = order.id;

      // Stock should now be 2
      const [vRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantSmallId]);
      assert.equal(Number(vRows[0].stock_quantity), 2);
    });

    it('Rolls back transaction and rejects checkout when variant stock is insufficient', async () => {
      // Current stock for variantLargeId is 2; try to purchase 5
      const res = await request(app)
        .post('/api/v1/checkout/orders')
        .send({
          guest_email: 'oversell@example.com',
          shipping_address: {
            recipient_name: 'Oversell Tester',
            phone: '+8801900112233',
            street_address: 'Dhanmondi 32',
            city: 'Dhaka',
            postal_code: '1209',
          },
          items: [{ variant_id: variantLargeId, quantity: 5 }],
        });

      assert.equal(res.statusCode, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /insufficient stock/i);

      // Verify stock was NOT decremented
      const [vRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantLargeId]);
      assert.equal(Number(vRows[0].stock_quantity), 2);

      // Verify no order was inserted for this attempt
      const [oRows] = await pool.query('SELECT * FROM orders WHERE guest_email = "oversell@example.com"');
      assert.equal(oRows.length, 0);
    });
  });

  describe('3. GET /api/v1/orders (Customer Order History & Ownership Enforcement)', () => {
    it('Rejects unauthenticated GET /api/v1/orders with 401', async () => {
      const res = await request(app).get('/api/v1/orders');
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.success, false);
    });

    it('GET /api/v1/orders returns customer own order history with pagination and items', async () => {
      const res = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.meta);
      assert.ok(res.body.meta.total >= 1);

      // Find our placed order in customer's order history
      const found = res.body.data.find((o) => o.id === placedOrderId);
      assert.ok(found, 'Placed order should appear in customer order list');
      assert.equal(found.payment_method, 'cash_on_delivery');
      assert.ok(Array.isArray(found.items));
      assert.equal(found.items[0].size, 'S');
      assert.equal(found.items[0].color, 'Sky Blue');
      assert.equal(Number(found.items[0].subtotal), 79.98);
    });

    it('GET /api/v1/orders?status=pending filters customer orders by status', async () => {
      const res = await request(app)
        .get('/api/v1/orders?status=pending')
        .set('Authorization', `Bearer ${customerToken}`);

      assert.equal(res.statusCode, 200);
      assert.ok(res.body.data.every((o) => o.status === 'pending'));
    });

    it('GET /api/v1/orders/:id returns order detail with line items and variant snapshot', async () => {
      const res = await request(app)
        .get(`/api/v1/orders/${placedOrderId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.id, placedOrderId);
      assert.equal(res.body.data.order_number, placedOrderNumber);
      assert.ok(Array.isArray(res.body.data.items));
      assert.equal(res.body.data.items[0].size, 'S');
      assert.equal(res.body.data.items[0].color, 'Sky Blue');
    });

    it('GET /api/v1/orders/:id denies access with 403 when customer tries to view another user order', async () => {
      // User 4 attempts to view User 2's placedOrderId
      const res = await request(app)
        .get(`/api/v1/orders/${placedOrderId}`)
        .set('Authorization', `Bearer ${customer2Token}`);

      assert.equal(res.statusCode, 403);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /access denied/i);
    });

    it('POST /api/v1/orders/:id/cancel allows customer to cancel pending order and restores stock', async () => {
      // Stock before cancellation is 2
      const [beforeRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantSmallId]);
      assert.equal(Number(beforeRows[0].stock_quantity), 2);

      const res = await request(app)
        .post(`/api/v1/orders/${placedOrderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ cancellation_reason: 'Changed my mind' });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.status, 'cancelled');

      // Stock should be restored from 2 back to 4 (+2 restored)
      const [afterRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantSmallId]);
      assert.equal(Number(afterRows[0].stock_quantity), 4);

      // Verify inventory_movements record for order_cancelled
      const [mRows] = await pool.query(
        'SELECT * FROM inventory_movements WHERE variant_id = ? AND reason = "order_cancelled" AND reference_order_id = ?',
        [variantSmallId, placedOrderId]
      );
      assert.equal(mRows.length, 1);
      assert.equal(mRows[0].quantity_delta, 2);
    });
  });

  describe('4. Admin Authorization & Order Management', () => {
    it('Rejects unauthenticated GET /api/v1/admin/orders with 401', async () => {
      const res = await request(app).get('/api/v1/admin/orders');
      assert.equal(res.statusCode, 401);
    });

    it('Rejects customer role on GET /api/v1/admin/orders with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${customerToken}`);

      assert.equal(res.statusCode, 403);
      assert.match(res.body.message, /insufficient permissions/i);
    });

    it('GET /api/v1/admin/orders returns all orders with status/date filters for admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.meta);

      // Test with status filter
      const pendingRes = await request(app)
        .get('/api/v1/admin/orders?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(pendingRes.statusCode, 200);
      assert.ok(pendingRes.body.data.every((o) => o.status === 'pending'));

      // Test with date filter
      const dateRes = await request(app)
        .get('/api/v1/admin/orders?startDate=2020-01-01')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.equal(dateRes.statusCode, 200);
      assert.ok(Array.isArray(dateRes.body.data));
    });

    it('Rejects customer role on PUT /api/v1/admin/orders/:id/status with 403', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${guestOrderId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'confirmed' });

      assert.equal(res.statusCode, 403);
    });

    it('PUT /api/v1/admin/orders/:id/status updates status pending -> confirmed -> shipped -> delivered', async () => {
      // 1. pending -> confirmed
      const res1 = await request(app)
        .put(`/api/v1/admin/orders/${guestOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed', note: 'Order verified by admin' });
      assert.equal(res1.statusCode, 200);
      assert.equal(res1.body.data.status, 'confirmed');

      // 2. confirmed -> shipped
      const res2 = await request(app)
        .put(`/api/v1/admin/orders/${guestOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'shipped',
          courier_name: 'Pathao Express',
          tracking_number: 'PTH-M3-999',
        });
      assert.equal(res2.statusCode, 200);
      assert.equal(res2.body.data.status, 'shipped');

      // 3. shipped -> delivered (COD auto-marks payment paid)
      const res3 = await request(app)
        .put(`/api/v1/admin/orders/${guestOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'delivered', note: 'Delivered to recipient' });
      assert.equal(res3.statusCode, 200);
      assert.equal(res3.body.data.status, 'delivered');
      assert.equal(res3.body.data.payment_status, 'paid');
    });
  });

  describe('5. Admin Inventory Management & Low-Stock Badges', () => {
    it('Rejects non-admin access to GET /api/v1/admin/inventory with 401/403', async () => {
      const unauth = await request(app).get('/api/v1/admin/inventory');
      assert.equal(unauth.statusCode, 401);

      const cust = await request(app)
        .get('/api/v1/admin/inventory')
        .set('Authorization', `Bearer ${customerToken}`);
      assert.equal(cust.statusCode, 403);
    });

    it('GET /api/v1/admin/inventory returns variants with low-stock badges', async () => {
      const res = await request(app)
        .get('/api/v1/admin/inventory')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length > 0);

      // Verify every variant item has low-stock badge metadata
      const first = res.body.data[0];
      assert.ok('stock_badge' in first);
      assert.ok('is_low_stock' in first);
      assert.ok('is_out_of_stock' in first);
      assert.ok('badge_label' in first);
      assert.ok(['in_stock', 'low_stock', 'out_of_stock'].includes(first.stock_badge));
    });

    it('Rejects non-admin on POST /api/v1/admin/inventory/adjust with 403', async () => {
      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          variant_id: variantLargeId,
          quantity_delta: 10,
          reason: 'restock',
          note: 'Unauthorized restock attempt',
        });

      assert.equal(res.statusCode, 403);
    });

    it('POST /api/v1/admin/inventory/adjust adjusts stock and logs inventory_movements', async () => {
      // Initial stock for variantLargeId is 2
      const res = await request(app)
        .post('/api/v1/admin/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variant_id: variantLargeId,
          quantity_delta: 8,
          reason: 'restock',
          note: 'Shipment batch M3-RECV-42 received',
        });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.data.variant_id, variantLargeId);
      assert.equal(res.body.data.stock_quantity, 10);
      assert.equal(res.body.data.before_quantity, 2);
      assert.equal(res.body.data.after_quantity, 10);

      // Verify movement audit log in DB
      const [mRows] = await pool.query(
        'SELECT * FROM inventory_movements WHERE variant_id = ? AND reason = "restock" ORDER BY id DESC LIMIT 1',
        [variantLargeId]
      );
      assert.equal(mRows.length, 1);
      assert.equal(mRows[0].quantity_delta, 8);
      assert.equal(mRows[0].before_quantity, 2);
      assert.equal(mRows[0].after_quantity, 10);
      assert.match(mRows[0].note, /Shipment batch M3-RECV-42/);
    });
  });
});
