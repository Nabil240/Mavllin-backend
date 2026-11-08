const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Milestone M-Core: Admin Order Full CRUD & Stock Recovery Tests', () => {
  let adminToken;
  let customerToken;
  let testProductId;
  let testVariantId;
  let crudUserId;
  const ts = Date.now();
  const testSku = `MAV-CRUD-${ts}-M`;

  before(async () => {
    adminToken = getAdminToken();

    // Create an isolated test customer user
    const [u] = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES (?, ?, ?, 'customer', 1)`,
      [`CRUD Cust ${ts}`, `crud-${ts}@mavllin.test`, '$2a$10$G5j0kx.aq9OUgm6zGGgN6.idU5GeNR56kYZdf45WFUqqE6UU70gwa']
    );
    crudUserId = u.insertId;
    customerToken = getCustomerToken({ id: crudUserId, email: `crud-${ts}@mavllin.test` });

    // Create a product with known stock quantity of 20
    const prodRes = await request(app)
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `CRUD Test Panjabi ${ts}`,
        short_description: 'Test garment for admin order deletion and inventory recovery',
        base_price: 3200.0,
        is_active: 1,
        variants: [
          {
            sku: testSku,
            size: 'M',
            color: 'Midnight Indigo',
            price: 3200.0,
            compare_at_price: 3800.0,
            stock_quantity: 20,
            is_active: 1,
          },
        ],
      });

    assert.strictEqual(prodRes.statusCode, 201);
    testProductId = prodRes.body.data.id;
    testVariantId = prodRes.body.data.variants[0].id;
  });

  after(async () => {
    // Clean up test product and user
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = ?', [testProductId]);
    }
    if (crudUserId) {
      await pool.query('DELETE FROM users WHERE id = ?', [crudUserId]);
    }
  });

  describe('1. Role-Based Access Control for Order Deletion', () => {
    it('rejects unauthenticated DELETE /api/v1/admin/orders/:id with 401 Unauthorized', async () => {
      const res = await request(app).delete('/api/v1/admin/orders/1');
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects customer role on DELETE /api/v1/admin/orders/:id with 403 Forbidden', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/orders/1')
        .set('Authorization', `Bearer ${customerToken}`);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('returns 404 when deleting a non-existent order ID', async () => {
      const res = await request(app)
        .delete('/api/v1/admin/orders/9999999')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.body.success, false);
    });
  });

  describe('2. Order Deletion with Atomic Inventory Stock Restoration', () => {
    it('deletes active pending order and restores variant stock_quantity atomically', async () => {
      // 1. Verify initial stock is 20
      const [initRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [testVariantId]);
      assert.strictEqual(initRows[0].stock_quantity, 20);

      // 2. Place a customer order purchasing 4 units
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Test Customer',
            phone: '+8801711000000',
            street_address: 'House 12, Road 5, Dhanmondi',
            city: 'Dhaka',
            postal_code: '1209',
          },
          payment_method: 'cash_on_delivery',
          items: [{ variant_id: testVariantId, quantity: 4 }],
        });

      assert.strictEqual(orderRes.statusCode, 201);
      const orderId = orderRes.body.data.id;
      const orderNumber = orderRes.body.data.order_number;
      assert.ok(orderNumber.startsWith('MAV-'));

      // 3. Verify stock was deducted from 20 to 16
      const [afterOrderRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [testVariantId]);
      assert.strictEqual(afterOrderRows[0].stock_quantity, 16);

      // 4. Admin deletes the order
      const deleteRes = await request(app)
        .delete(`/api/v1/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(deleteRes.statusCode, 200);
      assert.strictEqual(deleteRes.body.success, true);
      assert.strictEqual(deleteRes.body.message, 'Order deleted and inventory restored');

      // 5. Verify order is deleted from orders table
      const [checkOrder] = await pool.query('SELECT id FROM orders WHERE id = ?', [orderId]);
      assert.strictEqual(checkOrder.length, 0);

      // 6. Verify variant stock is restored back to 20
      const [restoredRows] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [testVariantId]);
      assert.strictEqual(restoredRows[0].stock_quantity, 20);
    });

    it('deletes a cancelled order without duplicate inventory restoration', async () => {
      // 1. Place an order for 2 units (stock 20 -> 18)
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shipping_address: {
            recipient_name: 'Test Customer',
            phone: '+8801711000000',
            street_address: 'House 12, Road 5, Dhanmondi',
            city: 'Dhaka',
            postal_code: '1209',
          },
          payment_method: 'cash_on_delivery',
          items: [{ variant_id: testVariantId, quantity: 2 }],
        });

      assert.strictEqual(orderRes.statusCode, 201);
      const orderId = orderRes.body.data.id;

      // Stock is 18
      const [stockDuringOrder] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [testVariantId]);
      assert.strictEqual(stockDuringOrder[0].stock_quantity, 18);

      // 2. Customer cancels order (stock restored 18 -> 20)
      const cancelRes = await request(app)
        .post(`/api/v1/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);

      assert.strictEqual(cancelRes.statusCode, 200);

      // Stock is now back to 20
      const [stockAfterCancel] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [testVariantId]);
      assert.strictEqual(stockAfterCancel[0].stock_quantity, 20);

      // 3. Admin deletes the cancelled order (must NOT double-restore stock)
      const deleteRes = await request(app)
        .delete(`/api/v1/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(deleteRes.statusCode, 200);

      // Stock must still be 20, not 22
      const [finalStock] = await pool.query('SELECT stock_quantity FROM product_variants WHERE id = ?', [testVariantId]);
      assert.strictEqual(finalStock[0].stock_quantity, 20);
    });
  });
});
