/**
 * tests/e2e/mavllin-journey.test.js
 * 
 * Master E2E Automated Verification Test Suite for MAVLLIN Platform:
 * 1. Health check returns service 'mavllin-api' and database connected.
 * 2. Public delivery charges endpoint returns BDT currency, ৳70 inside Dhaka, ৳130 outside Dhaka, ৳2,500 threshold.
 * 3. Customer catalog browsing: products and variants have BDT integer prices and 'MAV-' SKUs.
 * 4. Customer checkout with Cash on Delivery in BDT:
 *    - Dhaka delivery receives ৳70 shipping fee and accurate order total.
 *    - Outside Dhaka (Chattogram / Sylhet / Rajshahi) receives ৳130 shipping fee.
 *    - Subtotal >= ৳2,500 receives ৳0.00 free shipping.
 *    - Order number prefix 'MAV-' and status 'pending'.
 * 5. Admin delivery charge update:
 *    - Admin logs in with admin@mavllin.com.
 *    - Updates delivery charges via PUT /api/v1/admin/settings (৳80 inside, ৳150 outside, ৳3,000 threshold).
 *    - Subsequent GET /api/v1/delivery-charges immediately reflects updated fees.
 *    - Subsequent customer checkout dynamically calculates using updated fee (৳80).
 *    - Admin restores settings back to standard defaults (70 / 130 / 2500).
 * 6. Admin Order CRUD & Inventory Reconciliation:
 *    - Note stock quantity of variant before order.
 *    - Customer places order for 2 units -> stock decreases by 2.
 *    - Admin deletes order via DELETE /api/v1/admin/orders/:id.
 *    - Order is deleted (returns 404 on get) and variant stock is atomically restored.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('../../backend/node_modules/mysql2/promise');
const env = require('../../backend/src/config/env');
const { ApiClient } = require('./helpers/api-client');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const client = new ApiClient(BASE_URL);

describe('MAVLLIN Master End-to-End Production Verification Suite', () => {
  let dbConn;
  let inProcessServer = null;

  const timestamp = Date.now();
  const testCustomerEmail = `e2e_mavllin_${timestamp}@mavllin.test`;
  const testCustomerPassword = 'Customer@123';
  const adminEmail = 'admin@mavllin.com';
  const adminPassword = 'Admin@123';

  let customerToken = null;
  let customerId = null;
  let adminToken = null;
  let testVariant = null;
  let createdOrderIds = [];

  before(async () => {
    // 1. Establish direct MySQL database connection for invariant auditing
    dbConn = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
    });

    // 2. Ensure target API server is responding; spin up in-process server if not
    let serverResponding = false;
    try {
      const probe = await fetch(`${BASE_URL}/api/v1/health`, { signal: AbortSignal.timeout(2500) });
      if (probe.ok) {
        serverResponding = true;
      }
    } catch (_err) {
      serverResponding = false;
    }

    if (!serverResponding) {
      const app = require('../../backend/src/app');
      const url = new URL(BASE_URL);
      const port = Number(url.port) || 5000;
      await new Promise((resolve, reject) => {
        inProcessServer = app.listen(port, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }

    // 3. Ensure store_settings defaults are active before running tests
    await dbConn.query(`
      INSERT INTO store_settings (setting_key, setting_value)
      VALUES
        ('delivery_charge_inside_dhaka', '70.00'),
        ('delivery_charge_outside_dhaka', '130.00'),
        ('free_shipping_threshold', '2500.00'),
        ('currency', 'BDT'),
        ('currency_symbol', '৳'),
        ('estimated_days_inside_dhaka', '1-2 days'),
        ('estimated_days_outside_dhaka', '3-5 days')
      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
    `);

    // 4. Ensure admin@mavllin.com exists in DB
    await dbConn.query(`
      INSERT INTO users (full_name, email, password_hash, phone, role, is_active)
      VALUES ('Store Admin', 'admin@mavllin.com', '$2a$10$aegSxTb6QD7JzcmRciQAgOMPFCjf9ZKVTienViKPWlaOZ4MHEn7o2', '+8801711000001', 'admin', 1)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role), is_active = 1
    `);

    // 5. Select a canonical MAVLLIN test variant with sufficient stock
    const [variantRows] = await dbConn.query(`
      SELECT pv.id, pv.product_id, pv.sku, pv.price, pv.stock_quantity, p.name AS product_name
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      WHERE pv.sku LIKE 'MAV-%' AND pv.stock_quantity >= 10 AND p.is_active = 1 AND pv.is_active = 1
      ORDER BY pv.id ASC
      LIMIT 1
    `);
    assert.ok(variantRows.length > 0, 'Must find at least one active MAVLLIN variant with stock >= 10');
    testVariant = variantRows[0];
  });

  after(async () => {
    // Clean up created orders
    if (createdOrderIds.length > 0) {
      for (const orderId of createdOrderIds) {
        try {
          await dbConn.query('DELETE FROM payments WHERE order_id = ?', [orderId]);
          await dbConn.query('DELETE FROM order_status_history WHERE order_id = ?', [orderId]);
          await dbConn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
          await dbConn.query('DELETE FROM inventory_movements WHERE reference_order_id = ?', [orderId]);
          await dbConn.query('DELETE FROM orders WHERE id = ?', [orderId]);
        } catch (_e) {
          // Ignore teardown errors
        }
      }
    }

    // Clean up test customer
    if (customerId) {
      try {
        await dbConn.query('DELETE FROM cart_items WHERE user_id = ?', [customerId]);
        await dbConn.query('DELETE FROM orders WHERE user_id = ?', [customerId]);
        await dbConn.query('DELETE FROM users WHERE id = ?', [customerId]);
      } catch (_e) {
        // Ignore teardown errors
      }
    }

    // Reset store settings to canonical defaults
    try {
      await dbConn.query(`
        UPDATE store_settings
        SET setting_value = CASE setting_key
          WHEN 'delivery_charge_inside_dhaka' THEN '70.00'
          WHEN 'delivery_charge_outside_dhaka' THEN '130.00'
          WHEN 'free_shipping_threshold' THEN '2500.00'
          WHEN 'currency' THEN 'BDT'
          WHEN 'currency_symbol' THEN '৳'
          ELSE setting_value
        END
        WHERE setting_key IN ('delivery_charge_inside_dhaka', 'delivery_charge_outside_dhaka', 'free_shipping_threshold', 'currency', 'currency_symbol')
      `);
    } catch (_e) {
      // Ignore teardown errors
    }

    if (inProcessServer) {
      await new Promise((resolve) => inProcessServer.close(resolve));
    }

    if (dbConn) {
      await dbConn.end();
    }
  });

  // ============================================================================
  // Requirement 1: Health Check
  // ============================================================================
  describe('Phase 1: API Service Health & Database Verification', () => {
    it('returns service: "mavllin-api" and database connected on GET /api/v1/health', async () => {
      const res = await client.get('/api/v1/health');
      assert.equal(res.status, 200, `Expected 200 OK from health check, got ${res.status}`);
      assert.ok(res.body, 'Response body must not be empty');
      assert.equal(res.body.status, 'ok', 'Overall health status must be "ok"');
      assert.equal(res.body.service, 'mavllin-api', 'Service identity must be "mavllin-api"');
      assert.ok(res.body.database, 'Health check must include database status');
      assert.equal(res.body.database.status, 'connected', 'Database status must be "connected"');
    });
  });

  // ============================================================================
  // Requirement 2: Public Delivery Charges in BDT
  // ============================================================================
  describe('Phase 2: Public BDT Delivery Charges API (GET /api/v1/delivery-charges)', () => {
    it('returns BDT currency, ৳70 inside Dhaka, ৳130 outside Dhaka, and ৳2,500 threshold', async () => {
      const res = await client.get('/api/v1/delivery-charges');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.data, 'Data object must be present');

      const data = res.body.data;
      assert.equal(data.currency, 'BDT', 'Store currency must be BDT');
      assert.equal(data.currency_symbol, '৳', 'Currency symbol must be ৳');
      assert.equal(Number(data.inside_dhaka_fee), 70.0, 'Inside Dhaka delivery fee must be ৳70');
      assert.equal(Number(data.outside_dhaka_fee), 130.0, 'Outside Dhaka delivery fee must be ৳130');
      assert.equal(Number(data.free_shipping_threshold), 2500.0, 'Free shipping threshold must be ৳2,500');
      assert.equal(data.estimated_days_inside_dhaka, '1-2 days');
      assert.equal(data.estimated_days_outside_dhaka, '3-5 days');
    });
  });

  // ============================================================================
  // Requirement 3: Customer Catalog Browsing & BDT Integrity
  // ============================================================================
  describe('Phase 3: Catalog Browsing & BDT Integer Pricing Verification', () => {
    it('returns products and variants with BDT prices and MAV- SKUs', async () => {
      const res = await client.get('/api/v1/products');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data), 'Products data must be an array');
      assert.ok(res.body.data.length > 0, 'Catalog must contain products');

      const mavProducts = res.body.data.filter((p) => p.sku && p.sku.startsWith('MAV-'));
      assert.ok(mavProducts.length > 0, 'Catalog must contain MAVLLIN products');

      for (const prod of mavProducts) {
        assert.ok(prod.name, 'Product must have a name');
        assert.ok(
          prod.sku.startsWith('MAV-'),
          `Product SKU "${prod.sku}" must start with MAV-`
        );
        const priceNum = Number(prod.price || prod.base_price);
        assert.ok(!isNaN(priceNum) && priceNum > 0, `Product price must be a positive number: ${prod.price}`);

        if (Array.isArray(prod.variants) && prod.variants.length > 0) {
          for (const variant of prod.variants) {
            assert.ok(
              variant.sku.startsWith('MAV-'),
              `Variant SKU "${variant.sku}" must start with MAV-`
            );
            const varPrice = Number(variant.price);
            assert.ok(!isNaN(varPrice) && varPrice > 0, `Variant price must be positive: ${variant.price}`);
            assert.ok(Number(variant.stock_quantity) >= 0, 'Variant stock must be non-negative');
          }
        }
      }
    });
  });

  // ============================================================================
  // Requirement 4: Customer Checkout with Cash on Delivery in BDT
  // ============================================================================
  describe('Phase 4: Customer COD Checkout with Regional Shipping Fees in BDT', () => {
    before(async () => {
      // Register or login customer
      const regRes = await client.post('/api/v1/auth/register', {
        full_name: 'MAVLLIN Test Customer',
        email: testCustomerEmail,
        password: testCustomerPassword,
        phone: '+8801711000002',
      });

      if (regRes.status === 201) {
        customerToken = regRes.body.data.token;
        customerId = regRes.body.data.user.id;
      } else {
        const loginRes = await client.post('/api/v1/auth/login', {
          email: testCustomerEmail,
          password: testCustomerPassword,
        });
        assert.equal(loginRes.status, 200, 'Customer login failed');
        customerToken = loginRes.body.data.token;
        customerId = loginRes.body.data.user.id;
      }
      assert.ok(customerToken, 'Customer token must be available for checkout');
    });

    it('calculates ৳70 shipping fee for Inside Dhaka address (Subtotal < ৳2,500)', async () => {
      const unitPrice = Number(testVariant.price);
      const qty = 1;
      const subtotal = unitPrice * qty;

      const orderPayload = {
        items: [{ variant_id: testVariant.id, quantity: qty }],
        payment_method: 'cash_on_delivery',
        shipping_address: {
          recipient_name: 'MAVLLIN Banani Resident',
          phone: '+8801711000002',
          street_address: 'House 14, Road 11, Banani',
          city: 'Dhaka',
          district: 'Dhaka',
          division: 'Dhaka Division',
          postal_code: '1213',
        },
      };

      const res = await client.post('/api/v1/orders', orderPayload, { token: customerToken });
      assert.equal(res.status, 201, `Order placement failed: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.ok(order.order_number.startsWith('MAV-'), `Order number "${order.order_number}" must start with MAV-`);
      assert.equal(order.status, 'pending');
      assert.equal(order.payment_method, 'cash_on_delivery');
      assert.equal(Number(order.subtotal), subtotal);
      assert.equal(Number(order.shipping_fee), 70.0, 'Inside Dhaka shipping fee must be ৳70.00');
      assert.equal(Number(order.total_amount), subtotal + 70.0, 'Total must equal subtotal + ৳70');
    });

    it('calculates ৳130 shipping fee for Outside Dhaka address (Chattogram / Sylhet / Rajshahi)', async () => {
      const unitPrice = Number(testVariant.price);
      const qty = 1;
      const subtotal = unitPrice * qty;

      const orderPayload = {
        items: [{ variant_id: testVariant.id, quantity: qty }],
        payment_method: 'cash_on_delivery',
        shipping_address: {
          recipient_name: 'MAVLLIN Chattogram Resident',
          phone: '+8801819223344',
          street_address: 'Agrabad Commercial Area, Tower 3',
          city: 'Chattogram',
          district: 'Chattogram',
          division: 'Chattogram Division',
          postal_code: '4100',
        },
      };

      const res = await client.post('/api/v1/orders', orderPayload, { token: customerToken });
      assert.equal(res.status, 201, `Order placement failed: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.ok(order.order_number.startsWith('MAV-'));
      assert.equal(order.status, 'pending');
      assert.equal(order.payment_method, 'cash_on_delivery');
      assert.equal(Number(order.subtotal), subtotal);
      assert.equal(Number(order.shipping_fee), 130.0, 'Outside Dhaka shipping fee must be ৳130.00');
      assert.equal(Number(order.total_amount), subtotal + 130.0, 'Total must equal subtotal + ৳130');
    });

    it('applies ৳0.00 free shipping when order subtotal >= ৳2,500 threshold', async () => {
      const unitPrice = Number(testVariant.price);
      const qtyNeeded = Math.ceil(2500.0 / unitPrice);
      const expectedSubtotal = unitPrice * qtyNeeded;
      assert.ok(expectedSubtotal >= 2500.0);

      const orderPayload = {
        items: [{ variant_id: testVariant.id, quantity: qtyNeeded }],
        payment_method: 'cash_on_delivery',
        shipping_address: {
          recipient_name: 'MAVLLIN Sylhet Patron',
          phone: '+8801711223344',
          street_address: 'Zindabazar Point',
          city: 'Sylhet',
          district: 'Sylhet',
          division: 'Sylhet Division',
          postal_code: '3100',
        },
      };

      const res = await client.post('/api/v1/orders', orderPayload, { token: customerToken });
      assert.equal(res.status, 201, `Order placement failed: ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, true);
      const order = res.body.data;
      createdOrderIds.push(order.id);

      assert.ok(order.order_number.startsWith('MAV-'));
      assert.equal(order.status, 'pending');
      assert.equal(Number(order.subtotal), expectedSubtotal);
      assert.equal(Number(order.shipping_fee), 0.0, 'Free shipping fee must be ৳0.00');
      assert.equal(Number(order.total_amount), expectedSubtotal, 'Total amount must equal subtotal when shipping is free');
    });
  });

  // ============================================================================
  // Requirement 5: Admin Delivery Charge Update & Immediate Reflection
  // ============================================================================
  describe('Phase 5: Admin Delivery Charge Mutation & Dynamic Checkout Synchronization', () => {
    it('allows admin@mavllin.com to log in and mutate regional delivery charges', async () => {
      // 1. Admin login with credentials
      const loginRes = await client.post('/api/v1/auth/login', {
        email: adminEmail,
        password: adminPassword,
      });
      assert.equal(loginRes.status, 200, `Admin login failed: ${JSON.stringify(loginRes.body)}`);
      assert.equal(loginRes.body.success, true);
      assert.equal(loginRes.body.data.user.role, 'admin');
      adminToken = loginRes.body.data.token;
      assert.ok(adminToken, 'Admin token must be present');

      // 2. Admin updates delivery settings via PUT /api/v1/admin/settings
      const updateRes = await client.put(
        '/api/v1/admin/settings',
        {
          delivery_charge_inside_dhaka: 80.0,
          delivery_charge_outside_dhaka: 150.0,
          free_shipping_threshold: 3000.0,
        },
        { token: adminToken }
      );
      assert.equal(updateRes.status, 200, `Settings update failed: ${JSON.stringify(updateRes.body)}`);
      assert.equal(updateRes.body.success, true);

      // 3. Verify public endpoint immediately reflects updated fees
      const publicRes = await client.get('/api/v1/delivery-charges');
      assert.equal(publicRes.status, 200);
      assert.equal(Number(publicRes.body.data.inside_dhaka_fee), 80.0, 'Public fee inside Dhaka must update to ৳80');
      assert.equal(Number(publicRes.body.data.outside_dhaka_fee), 150.0, 'Public fee outside Dhaka must update to ৳150');
      assert.equal(Number(publicRes.body.data.free_shipping_threshold), 3000.0, 'Public threshold must update to ৳3,000');

      // 4. Verify customer checkout dynamically uses the updated fee (৳80 for Dhaka)
      const unitPrice = Number(testVariant.price);
      const subtotal = unitPrice * 1;
      const orderPayload = {
        items: [{ variant_id: testVariant.id, quantity: 1 }],
        payment_method: 'cash_on_delivery',
        shipping_address: {
          recipient_name: 'MAVLLIN Dynamic Sync Test',
          phone: '+8801711000002',
          street_address: 'Gulshan 2 Avenue',
          city: 'Dhaka',
          district: 'Dhaka',
          postal_code: '1212',
        },
      };

      const orderRes = await client.post('/api/v1/orders', orderPayload, { token: customerToken });
      assert.equal(orderRes.status, 201, `Order placement failed: ${JSON.stringify(orderRes.body)}`);
      const order = orderRes.body.data;
      createdOrderIds.push(order.id);

      assert.equal(Number(order.shipping_fee), 80.0, 'Checkout must dynamically use updated ৳80 inside Dhaka fee');
      assert.equal(Number(order.total_amount), subtotal + 80.0, 'Order total must include mutated ৳80 fee');

      // 5. Restore settings back to standard defaults (70 / 130 / 2500)
      const restoreRes = await client.put(
        '/api/v1/admin/settings',
        {
          delivery_charge_inside_dhaka: 70.0,
          delivery_charge_outside_dhaka: 130.0,
          free_shipping_threshold: 2500.0,
        },
        { token: adminToken }
      );
      assert.equal(restoreRes.status, 200);

      // Verify restored in public endpoint
      const restoredPublicRes = await client.get('/api/v1/delivery-charges');
      assert.equal(Number(restoredPublicRes.body.data.inside_dhaka_fee), 70.0);
      assert.equal(Number(restoredPublicRes.body.data.outside_dhaka_fee), 130.0);
      assert.equal(Number(restoredPublicRes.body.data.free_shipping_threshold), 2500.0);
    });
  });

  // ============================================================================
  // Requirement 6: Admin Order CRUD & Inventory Reconciliation
  // ============================================================================
  describe('Phase 6: Admin Order CRUD & Atomic Inventory Stock Restoration', () => {
    it('decrements stock on order creation and atomically restores stock upon admin order deletion', async () => {
      // 1. Query initial stock of test variant directly from database
      const [initRows] = await dbConn.query(
        'SELECT id, stock_quantity FROM product_variants WHERE id = ?',
        [testVariant.id]
      );
      assert.ok(initRows.length > 0, 'Test variant must exist in DB');
      const initialStock = Number(initRows[0].stock_quantity);
      assert.ok(initialStock >= 2, `Initial stock must be >= 2 for test, found: ${initialStock}`);

      // 2. Customer places order for 2 units
      const orderQty = 2;
      const orderPayload = {
        items: [{ variant_id: testVariant.id, quantity: orderQty }],
        payment_method: 'cash_on_delivery',
        shipping_address: {
          recipient_name: 'MAVLLIN Inventory Test',
          phone: '+8801711000002',
          street_address: 'House 5, Road 2, Dhanmondi',
          city: 'Dhaka',
          district: 'Dhaka',
          postal_code: '1209',
        },
      };

      const orderRes = await client.post('/api/v1/orders', orderPayload, { token: customerToken });
      assert.equal(orderRes.status, 201, `Order placement failed: ${JSON.stringify(orderRes.body)}`);
      const targetOrderId = orderRes.body.data.id;
      assert.ok(targetOrderId, 'Created order must have an id');

      // 3. Verify variant stock decreased by 2
      const [deductedRows] = await dbConn.query(
        'SELECT stock_quantity FROM product_variants WHERE id = ?',
        [testVariant.id]
      );
      const stockAfterOrder = Number(deductedRows[0].stock_quantity);
      assert.equal(
        stockAfterOrder,
        initialStock - orderQty,
        `Stock must decrement by ${orderQty} (expected ${initialStock - orderQty}, found ${stockAfterOrder})`
      );

      // 4. Admin deletes order via DELETE /api/v1/admin/orders/:id
      const deleteRes = await client.delete(`/api/v1/admin/orders/${targetOrderId}`, {
        token: adminToken,
      });
      assert.equal(deleteRes.status, 200, `Admin delete order failed: ${JSON.stringify(deleteRes.body)}`);
      assert.equal(deleteRes.body.success, true);
      assert.equal(deleteRes.body.message, 'Order deleted and inventory restored');

      // 5. Verify order is deleted: GET /api/v1/orders/:id returns 404
      const getRes = await client.get(`/api/v1/orders/${targetOrderId}`, {
        token: adminToken,
      });
      assert.equal(getRes.status, 404, 'Deleted order must return 404 Not Found');

      // 6. Verify variant stock is atomically restored back to initial stock
      const [restoredRows] = await dbConn.query(
        'SELECT stock_quantity FROM product_variants WHERE id = ?',
        [testVariant.id]
      );
      const stockAfterDelete = Number(restoredRows[0].stock_quantity);
      assert.equal(
        stockAfterDelete,
        initialStock,
        `Variant stock must be atomically restored to ${initialStock}, found: ${stockAfterDelete}`
      );
    });
  });

  // ============================================================================
  // Phase 7: Manual Payment Gateway, Product Discount, Advance Payment & Status Lifecycle (R2, R3, R6, R7, R8, R9, R10)
  // ============================================================================
  describe('Phase 7: Manual Payment Gateway, Discounts, Advance Payment, Promo Popup & Lifecycle Emails (R2-R10)', () => {
    it('supports manual payment transaction ID verification, promotional popup settings, and payment/order status transitions', async () => {
      // 1. Verify promotional popup configuration in public delivery-charges endpoint (R9)
      const popupUpdateRes = await client.put(
        '/api/v1/admin/settings',
        {
          promo_popup_enabled: true,
          promo_popup_title: 'E2E ATELIER OFFER',
          promo_popup_subtitle: '20% off heritage panjabis',
          promo_popup_discount_code: 'MAVE2E20',
          promo_popup_target_link: '/products?category=panjabi',
        },
        { token: adminToken }
      );
      assert.equal(popupUpdateRes.status, 200);

      const publicSettingsRes = await client.get('/api/v1/delivery-charges');
      assert.equal(publicSettingsRes.status, 200);
      assert.ok(publicSettingsRes.body.data.promo_popup, 'promo_popup config must be exposed on GET /api/v1/delivery-charges');
      assert.equal(publicSettingsRes.body.data.promo_popup.enabled, true);
      assert.equal(publicSettingsRes.body.data.promo_popup.title, 'E2E ATELIER OFFER');
      assert.equal(publicSettingsRes.body.data.promo_popup.target_link, '/products?category=panjabi');

      // 2. Place a manual payment order (bKash) requiring transaction_id (R2, R5, R7, R8)
      const trxId = `TRX${Date.now().toString().slice(-7)}`;
      const manualOrderRes = await client.post(
        '/api/v1/orders',
        {
          items: [{ variant_id: testVariant.id, quantity: 1 }],
          payment_method: 'bkash',
          transaction_id: trxId,
          shipping_address: {
            recipient_name: 'MAVLLIN Manual Payment Buyer',
            phone: '+8801711000002',
            street_address: 'House 22, Road 7, Uttara',
            city: 'Dhaka',
            district: 'Dhaka',
            postal_code: '1230',
          },
        },
        { token: customerToken }
      );
      assert.equal(manualOrderRes.status, 201, `Manual payment order failed: ${JSON.stringify(manualOrderRes.body)}`);
      const manualOrder = manualOrderRes.body.data;
      createdOrderIds.push(manualOrder.id);
      assert.equal(manualOrder.transaction_id, trxId, 'Order must persist manual payment transaction_id');

      // 3. Admin verifies transaction ID via PATCH /api/v1/admin/orders/:id/verify-payment (R2)
      const verifyRes = await client.patch(
        `/api/v1/admin/orders/${manualOrder.id}/verify-payment`,
        {
          verified: true,
          verification_notes: 'E2E bKash ledger cross-checked',
        },
        { token: adminToken }
      );
      assert.equal(verifyRes.status, 200, `Transaction verification failed: ${JSON.stringify(verifyRes.body)}`);
      assert.equal(verifyRes.body.data.payment_status, 'paid');

      // 4. Admin updates payment status to "done" and order status to "confirmed" -> "dispatch" (R10)
      const payDoneRes = await client.put(
        `/api/v1/admin/orders/${manualOrder.id}/payment-status`,
        { payment_status: 'done' },
        { token: adminToken }
      );
      assert.equal(payDoneRes.status, 200);
      assert.equal(payDoneRes.body.data.payment_status, 'paid');

      const confirmRes = await client.put(
        `/api/v1/admin/orders/${manualOrder.id}/status`,
        { status: 'confirmed', notes: 'E2E order confirmed' },
        { token: adminToken }
      );
      assert.equal(confirmRes.status, 200);
      assert.equal(confirmRes.body.data.status, 'confirmed');

      const dispatchRes = await client.put(
        `/api/v1/admin/orders/${manualOrder.id}/status`,
        { status: 'dispatch', notes: 'Dispatched via courier' },
        { token: adminToken }
      );
      assert.equal(dispatchRes.status, 200);
      assert.equal(dispatchRes.body.data.status, 'shipped');
    });
  });

  // ============================================================================
  // Phase 8: Unified Messaging Platform & AI Brain Automation (R4)
  // ============================================================================
  describe('Phase 8: Unified Facebook & WhatsApp Messaging with AI Automation (R4)', () => {
    it('processes inbound WhatsApp/Facebook webhooks, generates AI auto-reply, and lists unified conversations for Admin', async () => {
      const senderPhone = `+8801799${Date.now().toString().slice(-6)}`;
      const webhookRes = await client.post('/api/v1/messaging/webhook/whatsapp', {
        external_sender_id: senderPhone,
        customer_name: 'E2E WhatsApp Shopper',
        customer_phone: senderPhone,
        text: 'Inside Dhaka delivery charge koto?',
      });
      assert.equal(webhookRes.status, 200, `Messaging webhook failed: ${JSON.stringify(webhookRes.body)}`);
      assert.equal(webhookRes.body.status, 'EVENT_RECEIVED');
      assert.equal(webhookRes.body.count, 1);

      // Wait briefly for asynchronous webhook ingestion + AI auto-reply
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Admin retrieves unified conversations
      const convListRes = await client.get('/api/v1/admin/messaging/conversations', {
        token: adminToken,
        query: { search: senderPhone },
      });
      assert.equal(convListRes.status, 200);
      assert.ok(Array.isArray(convListRes.body.data), 'Conversations list must be an array');
      assert.ok(convListRes.body.data.length > 0, 'Unified inbox must contain the newly created conversation');

      const conv = convListRes.body.data[0];
      const msgListRes = await client.get(`/api/v1/admin/messaging/conversations/${conv.id}/messages`, {
        token: adminToken,
      });
      assert.equal(msgListRes.status, 200);
      assert.ok(Array.isArray(msgListRes.body.data));
      assert.ok(msgListRes.body.data.some((m) => m.sender_type === 'ai'), 'AI Brain must generate an automated reply');

      // Clean up test conversation
      await dbConn.query('DELETE FROM messaging_messages WHERE conversation_id = ?', [conv.id]);
      await dbConn.query('DELETE FROM messaging_conversations WHERE id = ?', [conv.id]);
    });
  });
});
