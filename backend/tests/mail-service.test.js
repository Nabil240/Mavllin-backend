const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const mailService = require('../src/services/mail.service');
const { getAdminToken, getCustomerToken } = require('./helpers/auth.helper');

describe('Milestone 3: Mail Service (R7 Order Confirmation & R10 Payment/Order Status Emails)', () => {
  let adminToken;
  let customerToken;
  let testVariantId;

  before(async () => {
    adminToken = getAdminToken();
    customerToken = getCustomerToken();

    const [variants] = await pool.query(
      'SELECT id, product_id FROM product_variants WHERE is_active = 1 AND stock_quantity >= 10 LIMIT 1'
    );
    assert.ok(variants.length > 0, 'At least one active stocked variant must exist');
    testVariantId = variants[0].id;
    await pool.query('UPDATE product_variants SET stock_quantity = 50 WHERE id = ?', [testVariantId]);
  });

  beforeEach(() => {
    mailService.clearSentEmails();
  });

  describe('1. Order Placement Confirmation Emails (R7)', () => {
    it('sends an order confirmation email automatically when an authenticated customer places an order', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          payment_method: 'cash_on_delivery',
          shipping_address: {
            recipient_name: 'Rahim Ahmed',
            email: 'rahim.order@mavllin.com',
            phone: '01711223344',
            street_address: 'House 12, Road 5, Dhanmondi',
            city: 'Dhaka',
            postal_code: '1209',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;
      assert.ok(order.order_number);

      const emails = mailService.getSentEmails();
      assert.strictEqual(emails.length, 1);
      const email = emails[0];
      assert.strictEqual(email.type, 'order_confirmation');
      assert.strictEqual(email.orderNumber, order.order_number);
      assert.ok(email.subject.includes(order.order_number));
      assert.ok(email.html.includes(order.order_number));
      assert.ok(email.html.includes('৳'));
    });

    it('sends an order confirmation email with manual payment TrxID on guest checkout', async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: 'guest.buyer@example.com',
          payment_method: 'manual',
          transaction_id: 'TRX-MAIL-998877',
          sender_phone: '01819001122',
          shipping_address: {
            recipient_name: 'Nadia Islam',
            phone: '01819001122',
            street_address: 'Agrabad C/A',
            city: 'Chattogram',
            postal_code: '4100',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });

      assert.strictEqual(res.statusCode, 201);
      const order = res.body.data;

      const emails = mailService.getSentEmails();
      assert.strictEqual(emails.length, 1);
      const email = emails[0];
      assert.strictEqual(email.type, 'order_confirmation');
      assert.strictEqual(email.to, 'guest.buyer@example.com');
      assert.ok(email.html.includes('TRX-MAIL-998877'));
    });
  });

  describe('2. Payment Status Update Notification Emails (R10)', () => {
    let targetOrderId;
    let targetOrderNumber;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: 'paystatus.client@example.com',
          payment_method: 'manual',
          transaction_id: 'TRX-VERIFY-7711',
          shipping_address: {
            recipient_name: 'Karim Chowdhury',
            phone: '01711889900',
            street_address: 'Banani Road 11',
            city: 'Dhaka',
            postal_code: '1213',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });
      assert.strictEqual(res.statusCode, 201);
      targetOrderId = res.body.data.id;
      targetOrderNumber = res.body.data.order_number;
      mailService.clearSentEmails();
    });

    it('sends payment confirmation email when payment status is updated to "done"', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${targetOrderId}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'done', note: 'Verified bKash TrxID' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.payment_status, 'paid');

      const emails = mailService.getSentEmails();
      assert.strictEqual(emails.length, 1);
      assert.strictEqual(emails[0].type, 'payment_status');
      assert.strictEqual(emails[0].to, 'paystatus.client@example.com');
      assert.strictEqual(emails[0].orderNumber, targetOrderNumber);
      assert.strictEqual(emails[0].metadata.isPaymentSuccessful, true);
      assert.ok(emails[0].subject.includes('Payment Confirmation'));
    });

    it('sends payment confirmation email when payment status is updated to "payment successful"', async () => {
      const res = await request(app)
        .put(`/api/v1/orders/${targetOrderId}/payment-status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payment_status: 'payment successful' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.payment_status, 'paid');

      const emails = mailService.getSentEmails();
      assert.strictEqual(emails.length, 1);
      assert.strictEqual(emails[0].type, 'payment_status');
      assert.strictEqual(emails[0].metadata.isPaymentSuccessful, true);
    });

    it('sends payment confirmation email when admin calls verify-payment endpoint', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/orders/${targetOrderId}/verify-payment`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Cross-checked manual payment TrxID' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.data.payment_status, 'paid');

      const emails = mailService.getSentEmails();
      assert.strictEqual(emails.length, 1);
      assert.strictEqual(emails[0].type, 'payment_status');
      assert.strictEqual(emails[0].paymentStatus, 'paid');
    });
  });

  describe('3. Order Status Transition Notification Emails (R10)', () => {
    it('sends customer notification emails for confirmed, dispatch, shipped, and delivered status changes', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: 'lifecycle.client@example.com',
          payment_method: 'cash_on_delivery',
          shipping_address: {
            recipient_name: 'Tariq Hasan',
            phone: '01711334455',
            street_address: 'Gulshan 2',
            city: 'Dhaka',
            postal_code: '1212',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });
      assert.strictEqual(createRes.statusCode, 201);
      const orderId = createRes.body.data.id;
      mailService.clearSentEmails();

      // 1. Confirmed
      const resConfirmed = await request(app)
        .put(`/api/v1/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' });
      assert.strictEqual(resConfirmed.statusCode, 200);

      // 2. Dispatch (maps to shipped from confirmed, with displayStatus 'dispatch')
      const resDispatch = await request(app)
        .put(`/api/v1/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'dispatch',
          courier_name: 'Pathao Courier',
          tracking_number: 'PTH-2026-8899',
        });
      assert.strictEqual(resDispatch.statusCode, 200);

      // 3. Delivered
      const resDelivered = await request(app)
        .put(`/api/v1/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'delivered' });
      assert.strictEqual(resDelivered.statusCode, 200);

      const statusEmails = mailService.getSentEmails().filter((e) => e.type === 'order_status');
      assert.strictEqual(statusEmails.length, 3);
      assert.strictEqual(statusEmails[0].status, 'confirmed');
      assert.strictEqual(statusEmails[1].status, 'dispatch');
      assert.ok(statusEmails[1].html.includes('Pathao Courier'));
      assert.ok(statusEmails[1].html.includes('PTH-2026-8899'));
      assert.strictEqual(statusEmails[2].status, 'delivered');
    });

    it('sends an order cancellation email when an order is cancelled', async () => {
      const createRes = await request(app)
        .post('/api/v1/orders/guest')
        .send({
          guest_email: 'cancel.client@example.com',
          payment_method: 'cash_on_delivery',
          shipping_address: {
            recipient_name: 'Farhana Akter',
            phone: '01911223344',
            street_address: 'Uttara Sector 7',
            city: 'Dhaka',
            postal_code: '1230',
          },
          items: [{ variant_id: testVariantId, quantity: 1 }],
        });
      assert.strictEqual(createRes.statusCode, 201);
      const orderId = createRes.body.data.id;
      mailService.clearSentEmails();

      const cancelRes = await request(app)
        .put(`/api/v1/admin/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'cancelled', cancellation_reason: 'Customer requested size change' });
      assert.strictEqual(cancelRes.statusCode, 200);

      const emails = mailService.getSentEmails();
      assert.strictEqual(emails.length, 1);
      assert.strictEqual(emails[0].type, 'order_status');
      assert.strictEqual(emails[0].status, 'cancelled');
    });
  });

  describe('4. Promotional Popup Settings in Public Delivery Charges Endpoint (R9)', () => {
    it('exposes promo_popup configuration on GET /api/v1/delivery-charges and allows admin customization', async () => {
      const getRes = await request(app).get('/api/v1/delivery-charges');
      assert.strictEqual(getRes.statusCode, 200);
      assert.ok(getRes.body.data.promo_popup);
      assert.strictEqual(typeof getRes.body.data.promo_popup.title, 'string');
      assert.strictEqual(typeof getRes.body.data.promo_popup.target_link, 'string');

      const updateRes = await request(app)
        .put('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          promo_popup_title: 'EID COLLECTION — 15% OFF',
          promo_popup_target_link: '/catalog?categorySlug=mens-panjabi',
        });
      assert.strictEqual(updateRes.statusCode, 200);

      const verifyRes = await request(app).get('/api/v1/delivery-charges');
      assert.strictEqual(verifyRes.body.data.promo_popup.title, 'EID COLLECTION — 15% OFF');
      assert.strictEqual(verifyRes.body.data.promo_popup.target_link, '/catalog?categorySlug=mens-panjabi');
    });
  });
});
