const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('../../backend/node_modules/supertest');
const app = require('../../backend/src/app');
const { pool } = require('../../backend/src/config/db');
const { getAdminToken, getCustomerToken } = require('../../backend/tests/helpers/auth.helper');
const OrderController = require('../../backend/src/controllers/order.controller');
const OrderModel = require('../../backend/src/models/order.model');
const SettingModel = require('../../backend/src/models/setting.model');
const CouponModel = require('../../backend/src/models/coupon.model');

describe('CHALLENGER-MAVL-1: Regional Delivery Calculations, Financial Invariants & Settings Synchronization', () => {
  let adminToken;
  let customerToken;
  const createdTestOrderIds = [];

  const STANDARD_SETTINGS = {
    delivery_charge_inside_dhaka: 70.0,
    delivery_charge_outside_dhaka: 130.0,
    free_shipping_threshold: 2500.0,
    currency: 'BDT',
    currency_symbol: '৳',
    estimated_days_inside_dhaka: '1-2 days',
    estimated_days_outside_dhaka: '3-5 days',
  };

  before(async () => {
    adminToken = getAdminToken();
    customerToken = getCustomerToken();

    // Ensure standard settings defaults are active
    await request(app)
      .put('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(STANDARD_SETTINGS);
  });

  after(async () => {
    // 1. Clean up any orders created during testing using OrderModel.delete to restore variant inventory
    if (createdTestOrderIds.length > 0) {
      for (const orderId of createdTestOrderIds) {
        await OrderModel.delete(orderId).catch(() => {});
      }
    }

    // 2. Restore standard settings defaults
    await request(app)
      .put('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(STANDARD_SETTINGS);
  });

  // ============================================================================
  // MISSION ITEM 1: calculateShippingFee boundary, case matching & district tests
  // ============================================================================
  describe('Mission 1: calculateShippingFee Boundary & Parsing Logic', () => {
    describe('1.1 Free Shipping Boundary Values around ৳2,500.00', () => {
      it('charges Inside Dhaka fee (৳70.00) at ৳2,499.99 (boundary below threshold)', async () => {
        const fee = await OrderController.calculateShippingFee(2499.99, { city: 'Dhaka' });
        assert.strictEqual(fee, 70.0);
      });

      it('charges Outside Dhaka fee (৳130.00) at ৳2,499.99 (boundary below threshold)', async () => {
        const fee = await OrderController.calculateShippingFee(2499.99, { city: 'Chattogram' });
        assert.strictEqual(fee, 130.0);
      });

      it('applies Free Shipping (৳0.00) at exact threshold ৳2,500.00 for Dhaka', async () => {
        const fee = await OrderController.calculateShippingFee(2500.00, { city: 'Dhaka' });
        assert.strictEqual(fee, 0.0);
      });

      it('applies Free Shipping (৳0.00) at exact threshold ৳2,500.00 for Outside Dhaka (Chattogram)', async () => {
        const fee = await OrderController.calculateShippingFee(2500.00, { city: 'Chattogram' });
        assert.strictEqual(fee, 0.0);
      });

      it('applies Free Shipping (৳0.00) at ৳2,500.01 (boundary above threshold)', async () => {
        const feeDhaka = await OrderController.calculateShippingFee(2500.01, { city: 'Dhaka' });
        const feeOutside = await OrderController.calculateShippingFee(2500.01, { city: 'Sylhet' });
        assert.strictEqual(feeDhaka, 0.0);
        assert.strictEqual(feeOutside, 0.0);
      });

      it('charges standard fee when subtotal is 0.00 (empty cart)', async () => {
        const feeDhaka = await OrderController.calculateShippingFee(0.00, { city: 'Dhaka' });
        const feeOutside = await OrderController.calculateShippingFee(0.00, { city: 'Rajshahi' });
        assert.strictEqual(feeDhaka, 70.0);
        assert.strictEqual(feeOutside, 130.0);
      });

      it('charges standard fee gracefully without crash when subtotal is negative', async () => {
        const fee = await OrderController.calculateShippingFee(-50.00, { city: 'Dhaka' });
        assert.strictEqual(fee, 70.0);
      });
    });

    describe('1.2 Dhaka Case Matching Variations & Multi-Field Identification', () => {
      const dhakaCityVariations = [
        'Dhaka',
        'dhaka',
        'DHAKA',
        'Dhaka City',
        'Dhaka Metro',
        '  Dhaka  ',
        'dHaKa',
        'Dhaka North',
        'Dhaka South',
      ];

      for (const variant of dhakaCityVariations) {
        it(`recognizes city="${variant}" as inside Dhaka (৳70.00)`, async () => {
          const fee = await OrderController.calculateShippingFee(1000, { city: variant });
          assert.strictEqual(fee, 70.0);
        });
      }

      it('recognizes district="Dhaka" when city is a neighborhood name (e.g. Mirpur)', async () => {
        const fee = await OrderController.calculateShippingFee(1000, {
          city: 'Mirpur',
          district: 'Dhaka',
        });
        assert.strictEqual(fee, 70.0);
      });

      it('recognizes area="Dhaka" when city is a neighborhood name (e.g. Uttara)', async () => {
        const fee = await OrderController.calculateShippingFee(1000, {
          city: 'Uttara',
          area: 'Dhaka',
        });
        assert.strictEqual(fee, 70.0);
      });

      it('recognizes division="Dhaka" when city is another town in the division', async () => {
        const fee = await OrderController.calculateShippingFee(1000, {
          city: 'Gulshan',
          division: 'Dhaka',
        });
        assert.strictEqual(fee, 70.0);
      });

      it('recognizes state="Dhaka" as division fallback', async () => {
        const fee = await OrderController.calculateShippingFee(1000, {
          city: 'Banani',
          state: 'Dhaka',
        });
        assert.strictEqual(fee, 70.0);
      });

      it('recognizes region_code="inside_dhaka"', async () => {
        const fee = await OrderController.calculateShippingFee(1000, {
          city: 'Unknown Area',
          region_code: 'inside_dhaka',
        });
        assert.strictEqual(fee, 70.0);
      });

      it('recognizes region_code="INSIDE_DHAKA" case-insensitively', async () => {
        const fee = await OrderController.calculateShippingFee(1000, {
          city: 'Unknown Area',
          region_code: 'INSIDE_DHAKA',
        });
        assert.strictEqual(fee, 70.0);
      });
    });

    describe('1.3 Nationwide Non-Dhaka Districts across Bangladesh Divisions (৳130.00)', () => {
      const sampleDistricts = [
        { division: 'Chattogram', city: 'Chattogram' },
        { division: 'Chattogram', city: "Cox's Bazar" },
        { division: 'Chattogram', city: 'Cumilla' },
        { division: 'Sylhet', city: 'Sylhet' },
        { division: 'Sylhet', city: 'Moulvibazar' },
        { division: 'Rajshahi', city: 'Rajshahi' },
        { division: 'Rajshahi', city: 'Bogura' },
        { division: 'Khulna', city: 'Khulna' },
        { division: 'Khulna', city: 'Jashore' },
        { division: 'Barishal', city: 'Barishal' },
        { division: 'Barishal', city: 'Patuakhali' },
        { division: 'Rangpur', city: 'Rangpur' },
        { division: 'Rangpur', city: 'Dinajpur' },
        { division: 'Mymensingh', city: 'Mymensingh' },
        { division: 'Mymensingh', city: 'Jamalpur' },
      ];

      for (const item of sampleDistricts) {
        it(`charges Outside Dhaka fee (৳130.00) for ${item.city} (${item.division} Division)`, async () => {
          const fee = await OrderController.calculateShippingFee(1500, {
            city: item.city,
            district: item.city,
            division: item.division,
          });
          assert.strictEqual(fee, 130.0);
        });
      }
    });

    describe('1.4 Empty, Malformed, and Boundary Inputs Fallback Robustness', () => {
      it('falls back to Outside Dhaka rate (৳130.00) without unhandled exception when shippingAddress is null', async () => {
        const fee = await OrderController.calculateShippingFee(1000, null);
        assert.strictEqual(fee, 130.0);
        assert.ok(!isNaN(fee));
      });

      it('falls back to Outside Dhaka rate (৳130.00) when shippingAddress is undefined', async () => {
        const fee = await OrderController.calculateShippingFee(1000, undefined);
        assert.strictEqual(fee, 130.0);
        assert.ok(!isNaN(fee));
      });

      it('falls back to Outside Dhaka rate (৳130.00) when shippingAddress is empty object {}', async () => {
        const fee = await OrderController.calculateShippingFee(1000, {});
        assert.strictEqual(fee, 130.0);
      });

      it('falls back to Outside Dhaka rate (৳130.00) when city is empty string or whitespaces', async () => {
        const fee1 = await OrderController.calculateShippingFee(1000, { city: '' });
        const fee2 = await OrderController.calculateShippingFee(1000, { city: '   ' });
        assert.strictEqual(fee1, 130.0);
        assert.strictEqual(fee2, 130.0);
      });

      it('falls back gracefully when address properties are numbers or booleans', async () => {
        const fee = await OrderController.calculateShippingFee(1000, { city: 12345, district: true });
        assert.strictEqual(fee, 130.0);
      });

      it('falls back gracefully when shippingAddress is a non-object primitive (string or number)', async () => {
        const feeStr = await OrderController.calculateShippingFee(1000, 'Dhaka');
        const feeNum = await OrderController.calculateShippingFee(1000, 42);
        assert.strictEqual(feeStr, 130.0);
        assert.strictEqual(feeNum, 130.0);
      });
    });
  });

  // ============================================================================
  // MISSION ITEM 2: Dynamic Settings Mutation & Synchronous Customer Checkout
  // ============================================================================
  describe('Mission 2: Dynamic Delivery Settings Mutation & Synchronous Propagation', () => {
    const MUTATED_SETTINGS = {
      delivery_charge_inside_dhaka: 95.0,
      delivery_charge_outside_dhaka: 185.0,
      free_shipping_threshold: 4000.0,
    };

    it('mutates delivery settings via PUT /api/v1/admin/settings to unusual positive amounts (95, 185, 4000)', async () => {
      const putRes = await request(app)
        .put('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(MUTATED_SETTINGS);

      assert.strictEqual(putRes.statusCode, 200);
      assert.strictEqual(putRes.body.success, true);
      assert.strictEqual(Number(putRes.body.data.delivery_charge_inside_dhaka), 95.0);
      assert.strictEqual(Number(putRes.body.data.delivery_charge_outside_dhaka), 185.0);
      assert.strictEqual(Number(putRes.body.data.free_shipping_threshold), 4000.0);
    });

    it('verifies GET /api/v1/delivery-charges immediately reflects mutated rates (95, 185, 4000)', async () => {
      const getRes = await request(app).get('/api/v1/delivery-charges');
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual(getRes.body.success, true);
      const data = getRes.body.data;
      assert.strictEqual(Number(data.inside_dhaka_fee), 95.0);
      assert.strictEqual(Number(data.outside_dhaka_fee), 185.0);
      assert.strictEqual(Number(data.free_shipping_threshold), 4000.0);
    });

    it('subsequent customer order placement for Dhaka charges updated fee ৳95.00', async () => {
      // Variant 2 is 1250 BDT, qty 1 = subtotal 1250.00
      const orderRes = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: 'challenger_guest1@mavllin.test',
          payment_provider: 'cod',
          shipping_address: {
            recipient_name: 'Test Customer Dhaka',
            phone: '01711000001',
            street_address: 'House 1, Road 2, Dhanmondi',
            city: 'Dhaka',
            postal_code: '1205',
          },
          items: [{ variant_id: 2, quantity: 1 }],
        });

      assert.strictEqual(orderRes.statusCode, 201);
      assert.strictEqual(orderRes.body.success, true);
      const order = orderRes.body.data;
      createdTestOrderIds.push(order.id);

      assert.strictEqual(Number(order.subtotal), 1250.00);
      assert.strictEqual(Number(order.shipping_fee), 95.00);
      assert.strictEqual(Number(order.total_amount), 1345.00);
      assert.strictEqual(order.payment_method, 'cash_on_delivery');
    });

    it('subsequent customer order placement for Chattogram charges updated fee ৳185.00', async () => {
      const orderRes = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: 'challenger_guest2@mavllin.test',
          payment_provider: 'cod',
          shipping_address: {
            recipient_name: 'Test Customer Chattogram',
            phone: '01811000002',
            street_address: 'GEC Circle, Nasirabad',
            city: 'Chattogram',
            postal_code: '4000',
          },
          items: [{ variant_id: 2, quantity: 1 }],
        });

      assert.strictEqual(orderRes.statusCode, 201);
      assert.strictEqual(orderRes.body.success, true);
      const order = orderRes.body.data;
      createdTestOrderIds.push(order.id);

      assert.strictEqual(Number(order.subtotal), 1250.00);
      assert.strictEqual(Number(order.shipping_fee), 185.00);
      assert.strictEqual(Number(order.total_amount), 1435.00);
    });

    it('orders between old threshold (৳2,500) and new threshold (৳4,000) are charged shipping', async () => {
      // 3 units of Variant 2 = 3 * 1250 = 3750.00 (which is > 2500, but < 4000)
      const orderRes = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: 'challenger_guest3@mavllin.test',
          payment_provider: 'cod',
          shipping_address: {
            recipient_name: 'Test Customer Mid Range',
            phone: '01911000003',
            street_address: 'House 5, Road 3, Gulshan',
            city: 'Dhaka',
            postal_code: '1212',
          },
          items: [{ variant_id: 2, quantity: 3 }],
        });

      assert.strictEqual(orderRes.statusCode, 201);
      const order = orderRes.body.data;
      createdTestOrderIds.push(order.id);

      assert.strictEqual(Number(order.subtotal), 3750.00);
      assert.strictEqual(Number(order.shipping_fee), 95.00);
      assert.strictEqual(Number(order.total_amount), 3845.00);
    });

    it('orders >= new threshold (৳4,000) qualify for Free Shipping (৳0.00)', async () => {
      // 4 units of Variant 2 = 4 * 1250 = 5000.00 (>= 4000)
      const orderRes = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: 'challenger_guest4@mavllin.test',
          payment_provider: 'cod',
          shipping_address: {
            recipient_name: 'Test Customer Bulk',
            phone: '01611000004',
            street_address: 'Zindabazar Point',
            city: 'Sylhet',
            postal_code: '3100',
          },
          items: [{ variant_id: 2, quantity: 4 }],
        });

      assert.strictEqual(orderRes.statusCode, 201);
      const order = orderRes.body.data;
      createdTestOrderIds.push(order.id);

      assert.strictEqual(Number(order.subtotal), 5000.00);
      assert.strictEqual(Number(order.shipping_fee), 0.00);
      assert.strictEqual(Number(order.total_amount), 5000.00);
    });

    it('restores standard defaults (৳70 inside, ৳130 outside, ৳2,500 threshold) cleanly', async () => {
      const putRes = await request(app)
        .put('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(STANDARD_SETTINGS);

      assert.strictEqual(putRes.statusCode, 200);

      const getRes = await request(app).get('/api/v1/delivery-charges');
      assert.strictEqual(getRes.statusCode, 200);
      assert.strictEqual(Number(getRes.body.data.inside_dhaka_fee), 70.0);
      assert.strictEqual(Number(getRes.body.data.outside_dhaka_fee), 130.0);
      assert.strictEqual(Number(getRes.body.data.free_shipping_threshold), 2500.0);
    });

    it('subsequent order after restore uses restored ৳70 Inside Dhaka rate', async () => {
      const orderRes = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: 'challenger_guest5@mavllin.test',
          payment_provider: 'cod',
          shipping_address: {
            recipient_name: 'Restored Test Customer',
            phone: '01711000005',
            street_address: 'House 9, Road 4, Banani',
            city: 'Dhaka',
            postal_code: '1213',
          },
          items: [{ variant_id: 2, quantity: 1 }],
        });

      assert.strictEqual(orderRes.statusCode, 201);
      const order = orderRes.body.data;
      createdTestOrderIds.push(order.id);

      assert.strictEqual(Number(order.subtotal), 1250.00);
      assert.strictEqual(Number(order.shipping_fee), 70.00);
      assert.strictEqual(Number(order.total_amount), 1320.00);
    });
  });

  // ============================================================================
  // MISSION ITEM 3: BDT Financial Invariants, Zero Negative/NaN, COD & Coupons
  // ============================================================================
  describe('Mission 3: BDT Financial Invariants, Non-Negative/Non-NaN, COD & Coupon Calculations', () => {
    describe('3.1 Zero Negative Prices and Zero NaN Financial Invariants', () => {
      it('verifies no negative base_price or discount_price in products table', async () => {
        const [negProds] = await pool.query(
          'SELECT COUNT(*) AS count FROM products WHERE base_price < 0 OR (discount_price IS NOT NULL AND discount_price < 0)'
        );
        assert.strictEqual(Number(negProds[0].count), 0);
      });

      it('verifies no negative price or compare_at_price in product_variants table', async () => {
        const [negVariants] = await pool.query(
          'SELECT COUNT(*) AS count FROM product_variants WHERE price < 0 OR (compare_at_price IS NOT NULL AND compare_at_price < 0)'
        );
        assert.strictEqual(Number(negVariants[0].count), 0);
      });

      it('verifies no negative financial amounts in orders table', async () => {
        const [negOrders] = await pool.query(
          'SELECT COUNT(*) AS count FROM orders WHERE subtotal < 0 OR shipping_fee < 0 OR discount_amount < 0 OR total_amount < 0'
        );
        assert.strictEqual(Number(negOrders[0].count), 0);
      });

      it('verifies no NaN values across all persisted orders', async () => {
        const [orders] = await pool.query(
          'SELECT id, subtotal, shipping_fee, discount_amount, total_amount FROM orders'
        );
        for (const o of orders) {
          assert.strictEqual(isNaN(Number(o.subtotal)), false, `Order ${o.id} has NaN subtotal`);
          assert.strictEqual(isNaN(Number(o.shipping_fee)), false, `Order ${o.id} has NaN shipping_fee`);
          assert.strictEqual(isNaN(Number(o.discount_amount)), false, `Order ${o.id} has NaN discount_amount`);
          assert.strictEqual(isNaN(Number(o.total_amount)), false, `Order ${o.id} has NaN total_amount`);
        }
      });
    });

    describe('3.2 Cash on Delivery (COD) Invariant: total === subtotal - discount + shippingFee', () => {
      it('verifies mathematical invariant across all orders in database', async () => {
        const [orders] = await pool.query('SELECT * FROM orders');
        for (const ord of orders) {
          const sub = Number(ord.subtotal);
          const disc = Number(ord.discount_amount || 0);
          const ship = Number(ord.shipping_fee || 0);
          const actualTotal = Number(ord.total_amount);
          const expectedTotal = parseFloat(Math.max(0, sub - disc + ship).toFixed(2));

          assert.strictEqual(
            actualTotal,
            expectedTotal,
            `Order ${ord.order_number} invariant broken: actual=${actualTotal}, expected=${expectedTotal} (sub=${sub}, disc=${disc}, ship=${ship})`
          );
        }
      });

      it('verifies COD order creation marks payment as unpaid and pending in payments table', async () => {
        const orderRes = await request(app)
          .post('/api/v1/orders/guest')
          .send({
            guest_email: 'cod_invariant@mavllin.test',
            payment_provider: 'cod',
            shipping_address: {
              recipient_name: 'COD Verification Customer',
              phone: '01711999999',
              street_address: 'House 10, Road 5, Dhanmondi',
              city: 'Dhaka',
              postal_code: '1209',
            },
            items: [{ variant_id: 2, quantity: 1 }],
          });

        assert.strictEqual(orderRes.statusCode, 201);
        const order = orderRes.body.data;
        createdTestOrderIds.push(order.id);

        assert.strictEqual(order.payment_method, 'cash_on_delivery');
        assert.strictEqual(order.payment_status, 'unpaid');
        assert.strictEqual(order.status, 'pending');

        const [payments] = await pool.query('SELECT * FROM payments WHERE order_id = ?', [order.id]);
        assert.strictEqual(payments.length, 1);
        assert.strictEqual(payments[0].provider, 'cod');
        assert.strictEqual(payments[0].status, 'pending');
        assert.strictEqual(Number(payments[0].amount), Number(order.total_amount));
      });
    });

    describe('3.3 Coupon Calculation & BDT Discount Assertions', () => {
      it('validates WELCOME10 gives exactly 10% discount when subtotal >= ৳1,500', async () => {
        const res = await request(app)
          .post('/api/v1/coupons/validate')
          .send({ code: 'WELCOME10', subtotal: 2000.00 });

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(Number(res.body.data.discount_amount), 200.00);
      });

      it('rejects WELCOME10 when subtotal < ৳1,500 with 400 Bad Request', async () => {
        const res = await request(app)
          .post('/api/v1/coupons/validate')
          .send({ code: 'WELCOME10', subtotal: 1499.99 });

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.message.includes('1500'));
      });

      it('validates FASHION20 gives exactly 20% discount when subtotal >= ৳4,000', async () => {
        const res = await request(app)
          .post('/api/v1/coupons/validate')
          .send({ code: 'FASHION20', subtotal: 5000.00 });

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(Number(res.body.data.discount_amount), 1000.00);
      });

      it('rejects FASHION20 when subtotal < ৳4,000 with 400 Bad Request', async () => {
        const res = await request(app)
          .post('/api/v1/coupons/validate')
          .send({ code: 'FASHION20', subtotal: 3999.99 });

        assert.strictEqual(res.statusCode, 400);
        assert.strictEqual(res.body.success, false);
        assert.ok(res.body.message.includes('4000'));
      });

      it('validates case-insensitivity of coupon code input ("welcome10" vs "WELCOME10")', async () => {
        const res = await request(app)
          .post('/api/v1/coupons/validate')
          .send({ code: 'welcome10', subtotal: 2000.00 });

        assert.strictEqual(res.statusCode, 200);
        assert.strictEqual(Number(res.body.data.discount_amount), 200.00);
      });

      it('returns 404 for non-existent coupon code', async () => {
        const res = await request(app)
          .post('/api/v1/coupons/validate')
          .send({ code: 'INVALID_COUPON_XYZ', subtotal: 5000.00 });

        assert.strictEqual(res.statusCode, 404);
        assert.strictEqual(res.body.success, false);
      });

      it('places customer order with WELCOME10 coupon applied, verifying full financial invariant', async () => {
        // Variant 46 is Signature Honeycomb Pique Polo = 1650.00 (meets >= 1500 threshold)
        // Subtotal = 1650.00
        // Discount 10% = 165.00
        // Shipping Inside Dhaka = 70.00 (since 1650 < 2500)
        // Total = 1650 - 165 + 70 = 1555.00
        const orderRes = await request(app)
          .post('/api/v1/orders/guest')
          .send({
            guest_email: 'coupon_checkout@mavllin.test',
            coupon_code: 'WELCOME10',
            payment_provider: 'cod',
            shipping_address: {
              recipient_name: 'Coupon Test Customer',
              phone: '01711888888',
              street_address: 'House 4, Road 7, Banani',
              city: 'Dhaka',
              postal_code: '1213',
            },
            items: [{ variant_id: 46, quantity: 1 }],
          });

        assert.strictEqual(orderRes.statusCode, 201);
        const order = orderRes.body.data;
        createdTestOrderIds.push(order.id);

        assert.strictEqual(Number(order.subtotal), 1650.00);
        assert.strictEqual(Number(order.discount_amount), 165.00);
        assert.strictEqual(Number(order.shipping_fee), 70.00);
        assert.strictEqual(Number(order.total_amount), 1555.00);

        // Verify invariant: total_amount === subtotal - discount_amount + shipping_fee
        const sub = Number(order.subtotal);
        const disc = Number(order.discount_amount);
        const ship = Number(order.shipping_fee);
        assert.strictEqual(
          Number(order.total_amount),
          parseFloat((sub - disc + ship).toFixed(2))
        );
      });

      it('places order with WELCOME10 above free shipping threshold (৳2,500)', async () => {
        // Variant 10: Heavyweight Hoodie = 2850.00 (>= 2500)
        // Subtotal = 2850.00
        // Discount 10% = 285.00
        // Shipping fee = 0.00 (subtotal >= 2500)
        // Total = 2850 - 285 + 0 = 2565.00
        const orderRes = await request(app)
          .post('/api/v1/orders/guest')
          .send({
            guest_email: 'coupon_freeship@mavllin.test',
            coupon_code: 'WELCOME10',
            payment_provider: 'cod',
            shipping_address: {
              recipient_name: 'Coupon FreeShip Customer',
              phone: '01711777777',
              street_address: 'Nasirabad Housing Society',
              city: 'Chattogram',
              postal_code: '4000',
            },
            items: [{ variant_id: 10, quantity: 1 }],
          });

        assert.strictEqual(orderRes.statusCode, 201);
        const order = orderRes.body.data;
        createdTestOrderIds.push(order.id);

        assert.strictEqual(Number(order.subtotal), 2850.00);
        assert.strictEqual(Number(order.discount_amount), 285.00);
        assert.strictEqual(Number(order.shipping_fee), 0.00);
        assert.strictEqual(Number(order.total_amount), 2565.00);
      });
    });
  });
});
