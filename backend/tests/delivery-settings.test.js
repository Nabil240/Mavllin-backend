const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');
const OrderController = require('../src/controllers/order.controller');

describe('Milestone M-Core: Delivery Charges & Store Settings APIs', () => {
  let adminToken;
  let customerToken;

  before(async () => {
    adminToken = getAdminToken();
    customerToken = getCustomerToken();

    // Ensure initial BDT settings are present
    await request(app)
      .put('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        delivery_charge_inside_dhaka: 70.0,
        delivery_charge_outside_dhaka: 130.0,
        free_shipping_threshold: 2500.0,
        currency: 'BDT',
        currency_symbol: '৳',
        estimated_days_inside_dhaka: '1-2 days',
        estimated_days_outside_dhaka: '3-5 days',
      });
  });

  after(async () => {
    // Reset back to standard MAVLLIN BDT defaults after tests
    await request(app)
      .put('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        delivery_charge_inside_dhaka: 70.0,
        delivery_charge_outside_dhaka: 130.0,
        free_shipping_threshold: 2500.0,
        currency: 'BDT',
        currency_symbol: '৳',
        estimated_days_inside_dhaka: '1-2 days',
        estimated_days_outside_dhaka: '3-5 days',
      });
  });

  describe('1. Public Delivery Charges Endpoint (GET /api/v1/delivery-charges)', () => {
    it('returns 200 with BDT currency and default shipping rates without authentication', async () => {
      const res = await request(app).get('/api/v1/delivery-charges');

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.data);

      const data = res.body.data;
      assert.strictEqual(data.currency, 'BDT');
      assert.strictEqual(data.currency_symbol, '৳');
      assert.strictEqual(Number(data.inside_dhaka_fee), 70.0);
      assert.strictEqual(Number(data.outside_dhaka_fee), 130.0);
      assert.strictEqual(Number(data.free_shipping_threshold), 2500.0);
      assert.strictEqual(data.estimated_days_inside_dhaka, '1-2 days');
      assert.strictEqual(data.estimated_days_outside_dhaka, '3-5 days');
    });
  });

  describe('2. Admin Settings Security & Retrieval (GET /api/v1/admin/settings)', () => {
    it('rejects unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/v1/admin/settings');
      assert.strictEqual(res.statusCode, 401);
      assert.strictEqual(res.body.success, false);
    });

    it('rejects customer role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${customerToken}`);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.body.success, false);
    });

    it('returns full store settings including BDT delivery rates for authenticated admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      const settings = res.body.data;
      assert.strictEqual(settings.site_name, 'MAVLLIN');
      assert.strictEqual(settings.currency, 'BDT');
      assert.strictEqual(settings.currency_symbol, '৳');
      assert.strictEqual(Number(settings.delivery_charge_inside_dhaka), 70.0);
      assert.strictEqual(Number(settings.delivery_charge_outside_dhaka), 130.0);
      assert.strictEqual(Number(settings.free_shipping_threshold), 2500.0);
    });
  });

  describe('3. Admin Settings Modification & Dynamic Synchronization (PUT /api/v1/admin/settings)', () => {
    it('rejects unauthenticated PUT with 401', async () => {
      const res = await request(app)
        .put('/api/v1/admin/settings')
        .send({ delivery_charge_inside_dhaka: 85.0 });
      assert.strictEqual(res.statusCode, 401);
    });

    it('rejects customer role on PUT with 403', async () => {
      const res = await request(app)
        .put('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ delivery_charge_inside_dhaka: 85.0 });
      assert.strictEqual(res.statusCode, 403);
    });

    it('allows admin to update delivery charges and verifies immediate public reflection', async () => {
      const updateRes = await request(app)
        .put('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          delivery_charge_inside_dhaka: 80.0,
          delivery_charge_outside_dhaka: 150.0,
          free_shipping_threshold: 3000.0,
        });

      assert.strictEqual(updateRes.statusCode, 200);
      assert.strictEqual(updateRes.body.success, true);
      assert.strictEqual(Number(updateRes.body.data.delivery_charge_inside_dhaka), 80.0);
      assert.strictEqual(Number(updateRes.body.data.delivery_charge_outside_dhaka), 150.0);
      assert.strictEqual(Number(updateRes.body.data.free_shipping_threshold), 3000.0);

      // Verify public GET /api/v1/delivery-charges immediately reflects updated rates
      const publicRes = await request(app).get('/api/v1/delivery-charges');
      assert.strictEqual(publicRes.statusCode, 200);
      assert.strictEqual(Number(publicRes.body.data.inside_dhaka_fee), 80.0);
      assert.strictEqual(Number(publicRes.body.data.outside_dhaka_fee), 150.0);
      assert.strictEqual(Number(publicRes.body.data.free_shipping_threshold), 3000.0);
    });
  });

  describe('4. Dynamic Shipping Fee Calculation Logic in Order Controller', () => {
    it('calculates 0 BDT shipping fee when subtotal meets or exceeds free shipping threshold (3000)', async () => {
      const fee = await OrderController.calculateShippingFee(3200, {
        city: 'Dhaka',
      });
      assert.strictEqual(fee, 0.0);
    });

    it('applies inside Dhaka rate (80) when subtotal is below threshold and city is Dhaka', async () => {
      const fee = await OrderController.calculateShippingFee(1500, {
        city: 'Dhaka',
      });
      assert.strictEqual(fee, 80.0);
    });

    it('applies inside Dhaka rate (80) case-insensitively when city is "DHAKA"', async () => {
      const fee = await OrderController.calculateShippingFee(1200, {
        city: 'DHAKA',
      });
      assert.strictEqual(fee, 80.0);
    });

    it('applies inside Dhaka rate (80) when district contains Dhaka', async () => {
      const fee = await OrderController.calculateShippingFee(1200, {
        city: 'Mirpur',
        district: 'Dhaka',
      });
      assert.strictEqual(fee, 80.0);
    });

    it('applies inside Dhaka rate (80) when division contains Dhaka', async () => {
      const fee = await OrderController.calculateShippingFee(1200, {
        city: 'Gulshan',
        division: 'Dhaka Division',
      });
      assert.strictEqual(fee, 80.0);
    });

    it('applies outside Dhaka rate (150) when destination is outside Dhaka', async () => {
      const fee = await OrderController.calculateShippingFee(1200, {
        city: 'Chattogram',
        district: 'Chattogram',
        division: 'Chattogram Division',
      });
      assert.strictEqual(fee, 150.0);
    });

    it('applies outside Dhaka rate (150) for Sylhet address', async () => {
      const fee = await OrderController.calculateShippingFee(2400, {
        city: 'Sylhet',
        district: 'Sylhet',
      });
      assert.strictEqual(fee, 150.0);
    });
  });
});
