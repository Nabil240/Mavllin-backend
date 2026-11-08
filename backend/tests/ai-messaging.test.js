const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const aiMessagingService = require('../src/services/ai-messaging.service');

describe('Milestone 2: Mavllin AI Brain & Messaging Automation Engine (R4)', () => {
  // 1. Language Detection & Mirroring Tests
  describe('Language Detection', () => {
    it('Detects Bengali script accurately', () => {
      assert.equal(aiMessagingService.detectLanguage('পাঞ্জাবির সাইজ কত?'), 'bn');
      assert.equal(aiMessagingService.detectLanguage('ডেলিভারি চার্জ কত ঢাকায়?'), 'bn');
      assert.equal(aiMessagingService.detectLanguage('আসসালামু আলাইকুম, কেমন আছেন?'), 'bn');
    });

    it('Detects Romanized Bangla (Banglish) accurately', () => {
      assert.equal(aiMessagingService.detectLanguage('bhai panjabi er dam koto?'), 'banglish');
      assert.equal(aiMessagingService.detectLanguage('dhakar baire delivery koto din lagbe?'), 'banglish');
      assert.equal(aiMessagingService.detectLanguage('size 42 hobe apnader?'), 'banglish');
      assert.equal(aiMessagingService.detectLanguage('advance payment ki lagbe?'), 'banglish');
    });

    it('Detects English accurately', () => {
      assert.equal(aiMessagingService.detectLanguage('What are your delivery charges inside Dhaka?'), 'en');
      assert.equal(aiMessagingService.detectLanguage('Do you offer cash on delivery?'), 'en');
      assert.equal(aiMessagingService.detectLanguage('I want to check my order status.'), 'en');
    });
  });

  // 2. Intent Classification Tests
  describe('Intent Recognition & Entity Extraction', () => {
    it('Classifies GREETING intent', () => {
      const res = aiMessagingService.classifyIntent('Assalamu Alaikum');
      assert.equal(res.intent, 'GREETING');
      assert.ok(res.confidence >= 0.90);
    });

    it('Classifies SIZING_QUERY and extracts numeric size', () => {
      const res = aiMessagingService.classifyIntent('What size should I choose for chest 42?');
      assert.equal(res.intent, 'SIZING_QUERY');
      assert.equal(res.entities.sizeNumber, '42');
    });

    it('Classifies DELIVERY_CHARGE_INQUIRY and extracts region', () => {
      const inside = aiMessagingService.classifyIntent('How much is shipping inside Dhaka?');
      assert.equal(inside.intent, 'DELIVERY_CHARGE_INQUIRY');
      assert.equal(inside.entities.location, 'inside_dhaka');

      const outside = aiMessagingService.classifyIntent('ডেলিভারি চার্জ ঢাকার বাইরে কত?');
      assert.equal(outside.intent, 'DELIVERY_CHARGE_INQUIRY');
      assert.equal(outside.entities.location, 'outside_dhaka');
    });

    it('Classifies PAYMENT_INQUIRY and detects manual/COD options', () => {
      const res = aiMessagingService.classifyIntent('Do you accept bKash or Cash on Delivery?');
      assert.equal(res.intent, 'PAYMENT_INQUIRY');
    });

    it('Classifies PRICING_DISCOUNT_INQUIRY and catches haggling attempts', () => {
      const res = aiMessagingService.classifyIntent('Can I get a discount or bargain on the panjabi?');
      assert.equal(res.intent, 'PRICING_DISCOUNT_INQUIRY');
    });

    it('Classifies ORDER_STATUS_TRACKING and extracts order number', () => {
      const res = aiMessagingService.classifyIntent('Please track my order MAV-20261108-9841');
      assert.equal(res.intent, 'ORDER_STATUS_TRACKING');
      assert.equal(res.entities.orderNumber, 'MAV-20261108-9841');
    });

    it('Classifies RETURN_EXCHANGE_INQUIRY', () => {
      const res = aiMessagingService.classifyIntent('What is your exchange policy if size does not fit?');
      assert.equal(res.intent, 'RETURN_EXCHANGE_INQUIRY');
    });

    it('Classifies HUMAN_ESCALATION and flags handoffRequired', () => {
      const agentReq = aiMessagingService.classifyIntent('I want to speak with a human agent please');
      assert.equal(agentReq.intent, 'HUMAN_ESCALATION');
      assert.equal(agentReq.entities.handoff, true);

      const bespokeReq = aiMessagingService.classifyIntent('I need custom bespoke tailoring for my wedding');
      assert.equal(bespokeReq.intent, 'HUMAN_ESCALATION');

      const damageReq = aiMessagingService.classifyIntent('The parcel arrived torn and damaged');
      assert.equal(damageReq.intent, 'HUMAN_ESCALATION');
    });
  });

  // 3. Offline Deterministic Response Generation
  describe('Deterministic Response Generation', () => {
    it('Generates bilingual sizing response with Chest 38-46 charts', async () => {
      const resEn = await aiMessagingService.generateResponse({
        messageText: 'What are your panjabi size charts?',
      });
      assert.match(resEn.replyText, /38 \(S\)/);
      assert.match(resEn.replyText, /46 \(XXL\)/);
      assert.match(resEn.replyText, /2 inches/i);

      const resBn = await aiMessagingService.generateResponse({
        messageText: 'পাঞ্জাবির সাইজ চার্ট দিন',
      });
      assert.equal(resBn.detectedLanguage, 'bn');
      assert.match(resBn.replyText, /Size 38/);
      assert.match(resBn.replyText, /২ ইঞ্চি/);
    });

    it('Generates fixed pricing response with WELCOME10 coupon info', async () => {
      const res = await aiMessagingService.generateResponse({
        messageText: 'Can I get a discount or bargain on the panjabi?',
      });
      assert.match(res.replyText, /WELCOME10/);
      assert.match(res.replyText, /2,500/);
    });

    it('Generates nationwide delivery fees (Inside 70, Outside 130, Free over 2500)', async () => {
      const res = await aiMessagingService.generateResponse({
        messageText: 'What is your shipping cost?',
      });
      assert.match(res.replyText, /70/);
      assert.match(res.replyText, /130/);
      assert.match(res.replyText, /2,500/);
    });

    it('Generates 7-day return response under CRPA 2009', async () => {
      const res = await aiMessagingService.generateResponse({
        messageText: 'What is your return policy?',
      });
      assert.match(res.replyText, /7-day/i);
      assert.match(res.replyText, /Consumer Rights Protection Act 2009/);
    });

    it('Handles human escalation gracefully and flags handoffRequired', async () => {
      const res = await aiMessagingService.generateResponse({
        messageText: 'I need to speak to a real person right now',
      });
      assert.strictEqual(res.handoffRequired, true);
      assert.match(res.replyText, /human concierge team/i);
    });

    it('Handles Romanized Bangla (Banglish) mirroring', async () => {
      const res = await aiMessagingService.generateResponse({
        messageText: 'bhai panjabi er delivery charge koto?',
      });
      assert.equal(res.detectedLanguage, 'banglish');
      assert.match(res.replyText, /delivery/i);
    });
  });
});
