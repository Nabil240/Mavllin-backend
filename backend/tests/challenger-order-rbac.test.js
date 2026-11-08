const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Empirical Challenger: Order Lifecycle, Stock Restoration & RBAC Security Boundaries', () => {
  let adminToken;
  let customerToken;
  let testProductId;
  let variantIdA;
  let variantIdB;
  let testUserId;
  const ts = Date.now();
  const skuA = `CHAL-${ts}-A`;
  const skuB = `CHAL-${ts}-B`;

  before(async () => {
    adminToken = getAdminToken();

    // Create isolated test customer user
    const [u] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'customer', 1)`,
      [`Challenger User ${ts}`, `challenger-${ts}@mavllin.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    testUserId = u.insertId;
    customerToken = getCustomerToken({ id: testUserId, email: `challenger-${ts}@mavllin.test` });

    // Create a product with two variants, each with 50 units
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Challenger Stress Product ${ts}`,
        short_description: 'Adversarial stress-testing product for stock integrity',
        base_price: 2500.0,
        is_active: 1,
        variants: [
          {
            sku: skuA,
            size: 'L',
            color: 'Obsidian Black',
            price: 2500.0,
            stock_quantity: 50,
            is_active: 1,
          },
          {
            sku: skuB,
            size: 'XL',
            color: 'Ivory White',
            price: 2600.0,
            stock_quantity: 50,
            is_active: 1,
          },
        ],
      });

    assert.strictEqual(prodRes.statusCode, 201, 'Product creation failed');
    testProductId = prodRes.body.data.id;
    variantIdA = prodRes.body.data.variants.find((v) => v.sku === skuA).id;
    variantIdB = prodRes.body.data.variants.find((v) => v.sku === skuB).id;
  });

  after(async () => {
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    }
    if (testUserId) {
      await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
    }
  });

  // Helper to place standard order
  async function placeOrder(items) {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        shipping_address: {
          recipient_name: 'Challenger Subject',
          phone: '+8801712345678',
          street_address: 'Road 11, Banani',
          city: 'Dhaka',
          postal_code: '1213',
        },
        payment_method: 'cash_on_delivery',
        items,
      });
    return res;
  }

  describe('1. Challenge Order Deletion & Stock Restoration Integrity', () => {
    it('places an order for multiple units of a variant and verifies stock deduction in MySQL', async () => {
      const orderRes = await placeOrder([{ variant_id: variantIdA, quantity: 5 }]);
      assert.strictEqual(orderRes.statusCode, 201);
      const orderId = orderRes.body.data.id;

      const [stockRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdA]);
      assert.strictEqual(stockRows[0].stock_quantity, 45, 'Stock should decrease from 50 to 45');

      // Admin deletes the order
      const delRes = await request(app)
        .delete(`/api/v1/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(delRes.statusCode, 200);
      assert.strictEqual(delRes.body.success, true);
      assert.strictEqual(delRes.body.message, 'Order deleted and inventory restored');

      // Verify order row is completely removed
      const [orderCheck] = await pool.query('SELECT id FROM orders WHERE id = ?', [orderId]);
      assert.strictEqual(orderCheck.length, 0, 'Order row must be purged from database');

      // Verify stock is restored back to 50
      const [restoredStockRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdA]);
      assert.strictEqual(restoredStockRows[0].stock_quantity, 50, 'Stock must be restored to 50');
    });

    it('returns 404 when deleting a non-existent order or re-deleting an already deleted order', async () => {
      // 1. Random non-existent ID
      const notFoundRes = await request(app)
        .delete('/api/v1/admin/orders/8888888')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(notFoundRes.statusCode, 404);
      assert.strictEqual(notFoundRes.body.success, false);
      assert.strictEqual(notFoundRes.body.message, 'Order not found');

      // 2. Place, delete, then attempt re-deletion
      const orderRes = await placeOrder([{ variant_id: variantIdA, quantity: 2 }]);
      const orderId = orderRes.body.data.id;

      const firstDel = await request(app)
        .delete(`/api/v1/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(firstDel.statusCode, 200);

      const secondDel = await request(app)
        .delete(`/api/v1/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(secondDel.statusCode, 404);
      assert.strictEqual(secondDel.body.success, false);
    });

    it('deleting an already cancelled order does NOT restore stock twice', async () => {
      // Stock starts at 50
      const [startStock] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdA]);
      assert.strictEqual(startStock[0].stock_quantity, 50);

      // Place order for 7 units (50 -> 43)
      const orderRes = await placeOrder([{ variant_id: variantIdA, quantity: 7 }]);
      assert.strictEqual(orderRes.statusCode, 201);
      const orderId = orderRes.body.data.id;

      const [stockMid] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdA]);
      assert.strictEqual(stockMid[0].stock_quantity, 43);

      // Customer cancels order (43 -> restored to 50)
      const cancelRes = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);
      assert.strictEqual(cancelRes.statusCode, 200);

      const [stockAfterCancel] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdA]);
      assert.strictEqual(stockAfterCancel[0].stock_quantity, 50);

      // Admin deletes the cancelled order
      const delRes = await request(app)
        .delete(`/api/v1/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(delRes.statusCode, 200);

      // Stock MUST still be 50, NOT 57!
      const [stockAfterDelete] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdA]);
      assert.strictEqual(stockAfterDelete[0].stock_quantity, 50, 'Duplicate restoration must be prevented');
    });

    it('deleting a delivered order does NOT restore stock (items already in customer possession)', async () => {
      // Place order for 3 units of variant B (50 -> 47)
      const orderRes = await placeOrder([{ variant_id: variantIdB, quantity: 3 }]);
      assert.strictEqual(orderRes.statusCode, 201);
      const orderId = orderRes.body.data.id;

      const [stockMid] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdB]);
      assert.strictEqual(stockMid[0].stock_quantity, 47);

      // Transition order status to delivered: pending -> confirmed -> processing -> shipped -> delivered
      await request(app).put(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'confirmed' });
      await request(app).put(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'processing' });
      await request(app).put(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'shipped' });
      const delivRes = await request(app).put(`/api/v1/admin/orders/${orderId}/status`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'delivered' });
      assert.strictEqual(delivRes.statusCode, 200);

      // Admin deletes the delivered order
      const delRes = await request(app)
        .delete(`/api/v1/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(delRes.statusCode, 200);

      // Stock MUST remain 47, NOT restored to 50
      const [finalStock] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdB]);
      assert.strictEqual(finalStock[0].stock_quantity, 47, 'Delivered order deletion must not restock delivered goods');

      // Reset stock of variant B back to 50 for subsequent tests
      await pool.query('UPDATE product_variants SET stock_quantity = 50 WHERE id = ?', [variantIdB]);
    });

    it('atomically restores multiple variants when a multi-item order is deleted', async () => {
      // Variant A = 50, Variant B = 50
      // Place order: Variant A x 4, Variant B x 6
      const orderRes = await placeOrder([
        { variant_id: variantIdA, quantity: 4 },
        { variant_id: variantIdB, quantity: 6 },
      ]);
      assert.strictEqual(orderRes.statusCode, 201);
      const orderId = orderRes.body.data.id;

      const [stockA_mid] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdA]);
      const [stockB_mid] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdB]);
      assert.strictEqual(stockA_mid[0].stock_quantity, 46);
      assert.strictEqual(stockB_mid[0].stock_quantity, 44);

      // Delete order
      const delRes = await request(app)
        .delete(`/api/v1/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(delRes.statusCode, 200);

      // Verify both variants restored to 50
      const [stockA_end] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdA]);
      const [stockB_end] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdB]);
      assert.strictEqual(stockA_end[0].stock_quantity, 50);
      assert.strictEqual(stockB_end[0].stock_quantity, 50);
    });

    it('handles race conditions: concurrent delete requests for same order result in 1 success and 1 404', async () => {
      const orderRes = await placeOrder([{ variant_id: variantIdA, quantity: 3 }]);
      const orderId = orderRes.body.data.id;

      // Fire 2 concurrent deletes
      const [del1, del2] = await Promise.all([
        request(app).delete(`/api/v1/admin/orders/${orderId}`).set('Authorization', `Bearer ${adminToken}`),
        request(app).delete(`/api/v1/admin/orders/${orderId}`).set('Authorization', `Bearer ${adminToken}`),
      ]);

      const statuses = [del1.statusCode, del2.statusCode].sort();
      assert.deepStrictEqual(statuses, [200, 404], 'One concurrent delete must succeed (200) and one must 404');

      // Variant stock must be exactly 50 (restored once)
      const [stockRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [variantIdA]);
      assert.strictEqual(stockRows[0].stock_quantity, 50);
    });
  });

  describe('2. Challenge RBAC and Security Boundaries', () => {
    describe('DELETE /api/v1/admin/orders/:id RBAC', () => {
      it('rejects unauthenticated request with 401 Unauthorized', async () => {
        const res = await request(app).delete('/api/v1/admin/orders/123');
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.message, 'Authentication required');
      });

      it('rejects malformed token with 401 Unauthorized', async () => {
        const res = await request(app)
          .delete('/api/v1/admin/orders/123')
          .set('Authorization', 'Bearer invalid-garbage-token');
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.message, 'Invalid or expired token');
      });

      it('rejects customer role with 403 Forbidden', async () => {
        const res = await request(app)
          .delete('/api/v1/admin/orders/123')
          .set('Authorization', `Bearer ${customerToken}`);
        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.message, 'Access denied: insufficient permissions');
      });

      it('rejects non-integer order ID parameter with 422 Unprocessable Entity', async () => {
        const res = await request(app)
          .delete('/api/v1/admin/orders/not-a-number')
          .set('Authorization', `Bearer ${adminToken}`);
        assert.strictEqual(res.statusCode, 422);
        assert.strictEqual(res.body.success, false);
      });
    });

    describe('PUT /api/v1/admin/settings RBAC', () => {
      it('rejects unauthenticated PUT /api/v1/admin/settings with 401 Unauthorized', async () => {
        const res = await request(app)
          .put('/api/v1/admin/settings')
          .send({ delivery_charge_inside_dhaka: 70 });
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.message, 'Authentication required');
      });

      it('rejects malformed token on PUT /api/v1/admin/settings with 401 Unauthorized', async () => {
        const res = await request(app)
          .put('/api/v1/admin/settings')
          .set('Authorization', 'Bearer bad.token.here')
          .send({ delivery_charge_inside_dhaka: 70 });
        assert.strictEqual(res.statusCode, 401);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.message, 'Invalid or expired token');
      });

      it('rejects customer role on PUT /api/v1/admin/settings with 403 Forbidden', async () => {
        const res = await request(app)
          .put('/api/v1/admin/settings')
          .set('Authorization', `Bearer ${customerToken}`)
          .send({ delivery_charge_inside_dhaka: 70 });
        assert.strictEqual(res.statusCode, 403);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.message, 'Access denied: insufficient permissions');
      });

      it('allows authorized admin to modify settings with 200 OK', async () => {
        const res = await request(app)
          .put('/api/v1/admin/settings')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            delivery_charge_inside_dhaka: 70.0,
            delivery_charge_outside_dhaka: 130.0,
            free_shipping_threshold: 2500.0,
          });
        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(Number(res.body.data.delivery_charge_inside_dhaka), 70.0);
      });
    });
  });
});
