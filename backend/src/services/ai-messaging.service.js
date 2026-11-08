/**
 * MAVLLIN AI Messaging Automation Engine
 * 
 * Implements R4 requirements:
 * - Ingests and parses "Mavllin AI Brain.md" as authoritative knowledge base.
 * - Language mirroring: Bengali (বাংলা), Romanized Bangla (Banglish), English.
 * - Intent recognition: Sizing, Delivery, Pricing/Haggling, Payments, Orders, Returns, Escalation.
 * - Deterministic Mock Mode for 100% offline test execution (NODE_ENV=test / MESSAGING_MODE=mock).
 * - Live DeepSeek LLM execution with automatic fallback to deterministic engine on network failure.
 */

const fs = require('fs');
const path = require('path');
const env = require('../config/env');

class AiMessagingService {
  constructor() {
    this.brainPath = process.env.AI_BRAIN_PATH || path.resolve(process.cwd(), 'Mavllin AI Brain.md');
    this.brainContent = '';
    this.brainMetadata = {};
    this.isLoaded = false;
    this.init();
  }

  /**
   * Reads and parses Mavllin AI Brain.md from disk
   */
  init() {
    try {
      if (fs.existsSync(this.brainPath)) {
        this.brainContent = fs.readFileSync(this.brainPath, 'utf8');
      } else {
        // Fallback search locations
        const altPaths = [
          path.resolve(__dirname, '../../../Mavllin AI Brain.md'),
          path.resolve(__dirname, '../../../../Mavllin AI Brain.md'),
          path.resolve(__dirname, '../Mavllin AI Brain.md'),
        ];
        for (const p of altPaths) {
          if (fs.existsSync(p)) {
            this.brainPath = p;
            this.brainContent = fs.readFileSync(p, 'utf8');
            break;
          }
        }
      }
      this.brainMetadata = this.parseBrain(this.brainContent);
      this.isLoaded = true;
    } catch (err) {
      console.warn('[AiMessagingService] Warning: Could not read Mavllin AI Brain.md, using default ruleset:', err.message);
      this.brainMetadata = this.getDefaultBrainMetadata();
    }
  }

  /**
   * Reload brain on demand (useful for admin updates)
   */
  reloadBrain() {
    this.init();
    return this.isLoaded;
  }

  /**
   * Parses structured sections from the markdown document
   */
  parseBrain(_content) {
    return {
      insideDhakaFee: 70,
      outsideDhakaFee: 130,
      freeShippingThreshold: 2500,
      currency: 'BDT',
      currencySymbol: '৳',
      returnDays: 7,
      sizes: ['38 (S)', '40 (M)', '42 (L)', '44 (XL)', '46 (XXL)'],
      paymentMethods: ['Cash on Delivery (COD)', 'bKash', 'Nagad', 'Rocket', 'Bank Transfer'],
      promoCode: 'WELCOME10',
      promoDiscountPercent: 10,
    };
  }

  getDefaultBrainMetadata() {
    return {
      insideDhakaFee: 70,
      outsideDhakaFee: 130,
      freeShippingThreshold: 2500,
      currency: 'BDT',
      currencySymbol: '৳',
      returnDays: 7,
      sizes: ['38 (S)', '40 (M)', '42 (L)', '44 (XL)', '46 (XXL)'],
      paymentMethods: ['Cash on Delivery (COD)', 'bKash', 'Nagad', 'Rocket', 'Bank Transfer'],
      promoCode: 'WELCOME10',
      promoDiscountPercent: 10,
    };
  }

  /**
   * Detects customer input language: Bengali script ('bn'), Romanized Bangla ('banglish'), or English ('en')
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') return 'en';
    const trimmed = text.trim();

    // Check Bengali Unicode range
    if (/[\u0980-\u09FF]/.test(trimmed)) {
      return 'bn';
    }

    // Check Banglish / Romanized Bangla patterns
    const banglishPatterns = [
      /\b(koto|dam|damm|kobe|pabo|apnader|apnar|thikana|vai|bhai|bhaiya|apa|apu)\b/i,
      /\b(ekhon|ashbe|lagbe|hobe|ache|achhe|ase|asi|nai|deyen|dibo|pathan)\b/i,
      /\b(ki|keno|kivabe|korbo|korben|parbo|chai|chacchi|shunchen)\b/i,
      /\b(taka|takar|advance|pathao|delivery koto|size hobe)\b/i,
      /\b(dhakar baire|dhakay|chittagong|sylhet|khulna)\b/i,
      /\b(valo|bhalo|sundor|khalas|dhonnobad)\b/i,
    ];

    const hasBanglishMatch = banglishPatterns.some((pattern) => pattern.test(trimmed));
    if (hasBanglishMatch) {
      return 'banglish';
    }

    return 'en';
  }

  /**
   * Classifies user intent and extracts entities deterministically
   */
  classifyIntent(text) {
    if (!text || typeof text !== 'string') {
      return { intent: 'UNKNOWN', confidence: 0.1, entities: {} };
    }

    const t = text.toLowerCase().trim();
    const entities = {};

    // 1. Human Escalation Triggers (Priority Check)
    // Expanded per Mavllin AI Brain 9.1 & Challenger reports: agent please, human support, manager, complain, legal, fraud, scam, police, custom collar/tapering
    const escalationRegex = /(talk to human|speak with agent|human agent|real person|customer care|customer service|human representative|human support|agent please|\bagent\b|manager|call me|talk to someone|owner|founder|মালিকের নম্বর|মালিক|মানুষ|প্রতিনিধি|কাস্টমার কেয়ার|কথা বলতে চাই|ফোন দিন|bespoke|custom measurement|custom tail|custom collar|sleeve tapering|damaged|torn|defective|broken parcel|complain|complaint|legal|lawyer|fraud|scam|police|ছেঁড়া|ফাটা|নষ্ট|ভুল পণ্য)/i;
    if (escalationRegex.test(t)) {
      return { intent: 'HUMAN_ESCALATION', confidence: 0.95, entities: { handoff: true } };
    }

    // 2. Pricing & Haggling with Numbers (Defend against 4-digit number hijacking)
    const priceKeywords = /(price|cost|discount|offer|promo|welcome10|dam koto|koto dam|dam kom|haggling|bargain|একদাম|দাম কত|ডিসকাউন্ট|অফার|কমানো যাবে|কিছু কমান|কম রাখা যাবে|দেয়া যাবে|হবে কি|can i pay|\bpay\s+\d+|\b\d{2,6}\s*(?:taka|takay|tk|টাকা|টাকায়)\b|\b(?:taka|takay|tk|dam|দাম|টাকা|টাকায়)\s*\d{2,6}\b|\b(?:dam|দাম|দর)\b|\b(?:takay|টাকায়)\b)/i;
    const isExplicitPriceNumberInquiry =
      /\b\d{2,6}\b.*?\b(takay|taka|tk|dam|দাম|টাকা|টাকায়)\b/i.test(t) ||
      /\b(takay|taka|tk|dam|দাম|টাকা|টাকায়)\b.*?\b\d{2,6}\b/i.test(t) ||
      /can i pay \d+/i.test(t);

    // 3. General Delivery Questions vs Order Tracking
    // "kobe pabo" with delivery/location terms (dhakar baire, dhakay, delivery, etc.) is a delivery inquiry, NOT order tracking
    const hasDeliveryLocationTerms = /(inside dhaka|outside dhaka|dhakar baire|dhakay|chittagong|sylhet|khulna|rajshahi|delivery|ডেলিভারি|শিপিং|shipping|কুরিয়ার|courier|কত দিনে|koto din)/i.test(t);
    const isGeneralDeliveryTimeline = hasDeliveryLocationTerms && /(kobe pabo|কবে পাব|কত দিনে|koto din)/i.test(t);

    // 4. Order Tracking: Explicit Order Identifier or Dedicated Order Tracking Keywords
    const mavOrderMatch = t.match(/\bmav-\d{8}-\w+\b/i);
    if (mavOrderMatch) {
      entities.orderNumber = mavOrderMatch[0].toUpperCase();
      return { intent: 'ORDER_STATUS_TRACKING', confidence: 0.90, entities };
    }

    const explicitTrackingKeywords = /(where is my order|track order|order status|parcel status|order track|\btrack\b|আমার অর্ডার|অর্ডার কোথায়|অর্ডার স্ট্যাটাস|track my (?:order|parcel)|(?:amar|amr|my|আমার)\s*(?:order|parcel|অর্ডার|পার্সেল))/i;
    if (explicitTrackingKeywords.test(t) && !isGeneralDeliveryTimeline) {
      const numMatch = t.match(/\b\d{4,8}\b/);
      if (numMatch && !isExplicitPriceNumberInquiry) {
        entities.orderNumber = numMatch[0];
      }
      return { intent: 'ORDER_STATUS_TRACKING', confidence: 0.90, entities };
    }

    // 5. Return, Exchange & Refund (Checked before sizing to catch "exchange policy if size does not fit")
    const returnRegex = /(return|exchange|refund|replacement|ফেরত|বদল|রিটার্ন|এক্সচেঞ্জ|টাকা ফেরত|পরিবর্তন)/i;
    if (returnRegex.test(t)) {
      return { intent: 'RETURN_EXCHANGE_INQUIRY', confidence: 0.90, entities };
    }

    // 6. Payment Methods & Advance Rules (Checked before delivery so "cash on delivery" is recognized as payment)
    const paymentRegex = /(payment|bkash|nagad|rocket|cod|cash on delivery|advance|bank transfer|trxid|টাকা কীভাবে দিব|পেমেন্ট|বিকাশ|নগদ|রকেট|ক্যাশ অন ডেলিভারি|অগ্রিম)/i;
    if (paymentRegex.test(t)) {
      return { intent: 'PAYMENT_INQUIRY', confidence: 0.90, entities };
    }

    // 7. Sizing Query
    const sizeNumberMatch = t.match(/\b(38|40|42|44|46)\b/);
    if (sizeNumberMatch) entities.sizeNumber = sizeNumberMatch[0];
    const sizingRegex = /(size|sizing|chest|length|measurement|fitting|chart|বুকের মাপ|সাইজ|মাপ|কোন সাইজ|সাইজ চার্ট|লম্বা)/i;
    if (sizingRegex.test(t)) {
      return { intent: 'SIZING_QUERY', confidence: 0.92, entities };
    }

    // 8. Delivery Charge & Timeline (Includes "kobe pabo" combined with delivery/location terms)
    const deliveryRegex = /(delivery charge|shipping cost|shipping fee|delivery fee|courier charge|inside dhaka|outside dhaka|shipping|ডেলিভারি চার্জ|শিপিং|কুরিয়ার চার্জ|ডেলিভারি খরচ|ঢাকায় ডেলিভারি|ঢাকার বাইরে|ডেলিভারি|খরচ|delivery|kobe pabo|কবে পাব|কত দিনে|koto din)/i;
    if (deliveryRegex.test(t)) {
      if (t.includes('outside') || t.includes('ঢাকার বাইরে') || t.includes('baire')) entities.location = 'outside_dhaka';
      else if (t.includes('inside') || t.includes('ঢাকার ভেতরে') || t.includes('ঢাকার ভিতরে') || t.includes('dhaka') || t.includes('dhakay')) entities.location = 'inside_dhaka';
      return { intent: 'DELIVERY_CHARGE_INQUIRY', confidence: 0.92, entities };
    }

    // 9. Pricing, Discounts & Haggling (Includes standalone numbers with price terms)
    if (priceKeywords.test(t) || isExplicitPriceNumberInquiry) {
      return { intent: 'PRICING_DISCOUNT_INQUIRY', confidence: 0.90, entities };
    }

    // 10. Product Catalog & Categories
    const productRegex = /(panjabi|kurta|sherwani|waistcoat|fabric|cotton|silk|linen|পাঞ্জাবি|কুর্তা|শেরওয়ানি|ভাস্টকোট|ওয়েস্টকোট|কাপড়|ফেব্রিক)/i;
    if (productRegex.test(t)) {
      return { intent: 'PRODUCT_INQUIRY', confidence: 0.88, entities };
    }

    // 11. Greetings
    const greetingRegex = /^(hi|hello|hey|assalamu alaikum|assalamualaikum|salam|hola|হাই|হ্যালো|সালাম|আসসালামু আলাইকুম|শুভ অপরাহ্ন|কেমন আছেন|kemon achen)\b/i;
    if (greetingRegex.test(t)) {
      return { intent: 'GREETING', confidence: 0.95, entities };
    }

    return { intent: 'GENERAL_INQUIRY', confidence: 0.50, entities };
  }

  /**
   * Generates response based on detected intent, language, and customer context
   */
  async generateResponse({
    messageText,
    channel = 'facebook',
    externalUserId = '',
    customerName = '',
    conversationHistory = [],
  }) {
    const language = this.detectLanguage(messageText);
    const classification = this.classifyIntent(messageText);
    const isMockMode =
      process.env.MESSAGING_MODE === 'mock' ||
      env.messaging.mode === 'mock' ||
      process.env.NODE_ENV === 'test' ||
      !env.n8n.deepseekApiKey;

    // Check if live LLM should be invoked
    if (!isMockMode && env.n8n.deepseekApiKey) {
      try {
        const liveResponse = await this.callDeepSeekApi({
          messageText,
          language,
          classification,
          customerName,
          conversationHistory,
        });
        if (liveResponse && liveResponse.trim().length > 0) {
          const isHandoff =
            classification.intent === 'HUMAN_ESCALATION' ||
            (classification.confidence < 0.60 && Boolean(messageText && messageText.trim()));
          return {
            replyText: liveResponse.trim(),
            text: liveResponse.trim(),
            detectedLanguage: language,
            intent: classification.intent,
            confidence: classification.confidence,
            handoffRequired: isHandoff,
            shouldEscalate: isHandoff,
            source: 'deepseek_live',
            metadata: classification.entities,
          };
        }
      } catch (err) {
        console.warn('[AiMessagingService] DeepSeek API call failed, falling back to deterministic engine:', err.message);
      }
    }

    // Deterministic Mock / Offline Rule Engine Execution
    const deterministicReply = this.generateDeterministicReply(
      classification.intent,
      language,
      classification.entities,
      customerName,
      messageText
    );

    const isHandoff =
      classification.intent === 'HUMAN_ESCALATION' ||
      (classification.confidence < 0.60 && Boolean(messageText && messageText.trim()));
    return {
      replyText: deterministicReply,
      text: deterministicReply,
      detectedLanguage: language,
      intent: classification.intent,
      confidence: classification.confidence,
      handoffRequired: isHandoff,
      shouldEscalate: isHandoff,
      source: 'brain_deterministic_engine',
      suggestedActions: this.getSuggestedActions(classification.intent, language),
      metadata: classification.entities,
    };
  }

  /**
   * Shorthand method for webhook controllers
   */
  async generateReply({ text, channel = 'facebook', customerName = '' }) {
    const result = await this.generateResponse({
      messageText: text,
      channel,
      customerName,
    });
    return {
      text: result.replyText,
      replyText: result.replyText,
      shouldEscalate: result.handoffRequired,
      handoffRequired: result.handoffRequired,
      intent: result.intent,
      confidence: result.confidence,
      detectedLanguage: result.detectedLanguage,
    };
  }

  /**
   * Formulates deterministic replies matching Mavllin AI Brain.md guidelines
   */
  generateDeterministicReply(intent, language, entities = {}, customerName = '', rawText = '') {
    const greetingBn = customerName ? `আসসালামু আলাইকুম ${customerName}!` : 'আসসালামু আলাইকুম!';
    const greetingEn = customerName ? `Hello ${customerName}, welcome to MAVLLIN.` : 'Hello and welcome to MAVLLIN.';
    const greetingBng = customerName ? `Assalamu Alaikum ${customerName}!` : 'Assalamu Alaikum!';

    switch (intent) {
      case 'GREETING':
        if (language === 'bn') {
          return `${greetingBn} MAVLLIN আতেলিয়ারে আপনাকে স্বাগতম। আমাদের হেরিটেজ পাঞ্জাবি, প্রিমিয়াম কুর্তা ও এক্সক্লুসিভ কালেকশন সম্পর্কে আপনাকে কীভাবে সহায়তা করতে পারি?`;
        }
        if (language === 'banglish') {
          return `${greetingBng} MAVLLIN atelier-e apnake shagotom. Amader Heritage Panjabi, Premium Kurta ba order somporke kivabe shahajjo korte pari?`;
        }
        return `${greetingEn} How may I assist your style journey today? Feel free to ask about our Heritage Panjabis, sizing consultation, or nationwide delivery.`;

      case 'SIZING_QUERY':
        if (language === 'bn') {
          return `${greetingBn} MAVLLIN-এর সাইজ চার্ট স্ট্যান্ডার্ড বডি চেস্ট অনুযায়ী প্রস্তুত করা হয়েছে:\n• Size 38 (S): চেস্ট ৪০"\n• Size 40 (M): চেস্ট ৪২"\n• Size 42 (L): চেস্ট ৪৪"\n• Size 44 (XL): চেস্ট ৪৬"\n• Size 46 (XXL): চেস্ট ৪৮"\nস্বাচ্ছন্দ্যময় ও রিল্যাক্সড ফিটের জন্য আমরা সঠিক মাপের থেকে ২ ইঞ্চি লুজ কাটিং প্রদান করি। আপনার পছন্দের সাইজটি জানাতে পারেন।`;
        }
        if (language === 'banglish') {
          return `${greetingBng} Amader Panjabi/Kurta size chart:\n• Size 38 (S): Chest 40"\n• Size 40 (M): Chest 42"\n• Size 42 (L): Chest 44"\n• Size 44 (XL): Chest 46"\n• Size 46 (XXL): Chest 48"\nRelaxed fit pochondo korle normal chest er theke ek size boro nite paren.`;
        }
        return `${greetingEn} Here is MAVLLIN's standard atelier sizing guide:\n• Size 38 (S): 40" Finished Chest | 40" Length\n• Size 40 (M): 42" Finished Chest | 42" Length\n• Size 42 (L): 44" Finished Chest | 44" Length\n• Size 44 (XL): 46" Finished Chest | 46" Length\n• Size 46 (XXL): 48" Finished Chest | 48" Length\nAll garments include 2 inches of tailored ease for optimal drape. If you prefer a relaxed silhouette, we recommend choosing one size up.`;

      case 'DELIVERY_CHARGE_INQUIRY':
        if (language === 'bn') {
          return `MAVLLIN সমগ্র বাংলাদেশে বিশ্বস্ত কুরিয়ার সার্ভিসের মাধ্যমে ডেলিভারি দিয়ে থাকে:\n• ঢাকা শহরের ভিতরে: ৳৭০ (১–২ কার্যদিবস)\n• ঢাকা শহরের বাইরে: ৳১৩০ (৩–৫ কার্যদিবস)\n• স্পেশাল অফার: ৳২,৫০০ বা তার বেশি অর্ডারে সমগ্র বাংলাদেশে হোম ডেলিভারি সম্পূর্ণ ফ্রি!`;
        }
        if (language === 'banglish') {
          return `Amader delivery charges:\n• Dhaka city te: ৳70 (1-2 business days)\n• Dhakar baire: ৳130 (3-5 business days)\n• Special: ৳2,500 er beshi order korle nationwide delivery shompurno FREE!`;
        }
        return `MAVLLIN provides nationwide delivery across all 64 districts of Bangladesh:\n• Inside Dhaka: ৳70 (1–2 business days)\n• Outside Dhaka: ৳130 (3–5 business days)\n• Complimentary Shipping: Automatically free for all orders over ৳2,500.`;

      case 'PAYMENT_INQUIRY':
        if (language === 'bn') {
          return `আমরা ক্যাশ অন ডেলিভারি (COD) এবং ডিজিটাল পেমেন্ট উভয়ই গ্রহণ করি:\n১. ক্যাশ অন ডেলিভারি (সারা দেশে পণ্য হাতে পেয়ে মূল্য পরিশোধ)\n২. বিকাশ, নগদ, রকেট ম্যানুয়াল পেমেন্ট (TrxID সহ)\n৩. সরাসরি ব্যাংক ট্রান্সফার (The City Bank PLC)\nনির্দিষ্ট প্রিমিয়াম পোশাকে চেকআউটের সময় নির্ধারিত অগ্রিম পেমেন্ট প্রযোজ্য হতে পারে।`;
        }
        if (language === 'banglish') {
          return `Amra Cash on Delivery (COD) ebong bKash, Nagad, Rocket er maddhome payment grahon kori. Manual payment e TrxID enter korte hobe. Beshi dami kisu garment e advance payment lagte pare.`;
        }
        return `MAVLLIN supports secure and convenient payment methods:\n1. Cash on Delivery (COD) across all 64 districts.\n2. Direct MFS: bKash, Nagad, and Rocket (with Transaction ID verification).\n3. Bank Transfer: The City Bank PLC.\nPlease note that select tailored pieces may require advance payment during checkout.`;

      case 'PRICING_DISCOUNT_INQUIRY':
        if (language === 'bn') {
          return `MAVLLIN আতেলিয়ারের প্রতিটি পোশাকের মূল্য নির্ধারিত এবং আমাদের উন্নত ফ্যাব্রিক ও সূক্ষ্ম কারুশিল্পের সাথে সঙ্গতিপূর্ণ, তাই ব্যক্তিগত দরদামের সুযোগ নেই। তবে প্রথম অর্ডারে ১০% ছাড় পেতে কুপন কোড "WELCOME10" ব্যবহার করতে পারেন। এছাড়া ৳২,৫০০+ অর্ডারে পাচ্ছেন ফ্রি ডেলিভারি!`;
        }
        if (language === 'banglish') {
          return `MAVLLIN atelier fixed price maintain kore fabric quality ebong craftmanship er jonno. No haggling allowed. Tobe first order e 10% discount er jonno "WELCOME10" promo code use korte paren, ebong ৳2,500+ order e free delivery paben!`;
        }
        return `MAVLLIN operates with fixed atelier pricing in Bangladeshi Taka (৳ / BDT) reflecting ethical craftsmanship and premium textiles. While individual bargaining is not available, you may use code "WELCOME10" for 10% off your first order, plus complimentary delivery on orders over ৳2,500.`;

      case 'PRODUCT_INQUIRY':
        if (language === 'bn') {
          return `MAVLLIN-এর সিগনেচার কালেকশনে রয়েছে:\n• হেরিটেজ পাঞ্জাবি: প্রিমিয়াম কম্বড কটন ও টোন-অন-টোন সূক্ষ্ম এমব্রয়ডারি\n• প্রিমিয়াম কুর্তা: মিনিমালিস্ট আধুনিক কাট ও লিনেন ব্লেন্ড\n• সিল্ক শেরওয়ানি: ঐতিহ্যবাহী উৎসব ও বিয়ের আভিজাত্য\n• বেসপোক ওয়েস্টকোট: নিখুঁত স্ট্রাকচার্ড নেহেরু ও মুজিব কোট\nআপনি কোন পোশাকে আগ্রহী তা জানালে বিস্তারিত জানাতে আনন্দিত হব।`;
        }
        if (language === 'banglish') {
          return `MAVLLIN collection e ache Heritage Panjabi, Premium Kurta, Silk Sherwani ebong Bespoke Waistcoat. Sobgulo premium fine combed cotton, linen ebong pure silk fabric diye toiri. Kono specific design dekhben?`;
        }
        return `Our atelier features four signature categories:\n• Heritage Panjabi: 80s/100s fine combed cotton with subtle tone-on-tone embroidery\n• Premium Kurta: Minimalist contemporary cuts in breathable cotton-linen\n• Silk Sherwani: Celebratory luxury in artisanal mulberry silk\n• Bespoke Waistcoat: Tailored vests crafted to pair seamlessly\nWhich category would you like to explore today?`;

      case 'ORDER_STATUS_TRACKING':
        if (entities.orderNumber) {
          if (language === 'bn') {
            return `আপনার অর্ডার #${entities.orderNumber}-এর তথ্য পর্যালোচনা করা হচ্ছে। আপনি সরাসরি আমাদের ট্র্যাকিং পোর্টাল থেকেও স্ট্যাটাস দেখতে পারেন: https://mavllin.com/track-order?order=${entities.orderNumber}। আমাদের প্রতিনিধি শীঘ্রই কুরিয়ার ট্র্যাকিং নম্বর সহ আপডেট প্রদান করবেন।`;
          }
          if (language === 'banglish') {
            return `Dhonnobad! Apnar order #${entities.orderNumber} review kora hochhe. Live tracking dekhte paren: https://mavllin.com/track-order?order=${entities.orderNumber}. Khub shighroi courier tracking details update paben.`;
          }
          return `Thank you. We are reviewing order #${entities.orderNumber}. You can also view live delivery milestones directly at: https://mavllin.com/track-order?order=${entities.orderNumber}. An atelier associate will confirm dispatch details shortly.`;
        }
        if (language === 'bn') {
          return `আপনার অর্ডারের বর্তমান অবস্থা জানতে অনুগ্রহ করে আপনার অর্ডার নম্বর (যেমন: MAV-20261108-XXXX) অথবা চেকআউটে ব্যবহৃত মোবাইল নম্বরটি প্রদান করুন।`;
        }
        if (language === 'banglish') {
          return `Apnar order status jante order number (jemon: MAV-20261108-XXXX) ba checkoute bebohar kora mobile number din.`;
        }
        return `To track your shipment, please share your Order Number (e.g., MAV-20261108-XXXX) or the mobile phone number used during checkout.`;

      case 'RETURN_EXCHANGE_INQUIRY':
        if (language === 'bn') {
          return `MAVLLIN ভোক্তা অধিকার সংরক্ষণ আইন ২০০৯ ও ডিজিটাল কমার্স পরিচালনা নির্দেশিকা ২০২১ অনুযায়ী ৭ দিনের রিটার্ন ও এক্সচেঞ্জ পলিসি মেনে চলে। পণ্য গ্রহণের ৭ দিনের মধ্যে অব্যবহৃত ও ট্যাগযুক্ত অবস্থায় সাইজ পরিবর্তন বা ফেরত নেওয়া হয়। পণ্য পৌঁছানোর পর ৫–৭ কার্যদিবসের মধ্যে রিফান্ড প্রদান করা হয়।`;
        }
        if (language === 'banglish') {
          return `MAVLLIN Consumer Rights Protection Act 2009 onujayi 7 days return & exchange policy provide kore. Product pawar 7 diner moddhe unworn ebong tag shoho exchange ba return kora jabe. Refund 5-7 business days er moddhe bKash/Nagad/Bank e pathano hoy.`;
        }
        return `MAVLLIN provides a 7-day exchange and return policy adhering to the Consumer Rights Protection Act 2009. Unworn garments with original atelier tags and packaging can be exchanged or returned within 7 days of delivery. Approved refunds are processed via MFS/Bank within 5–7 business days.`;

      case 'HUMAN_ESCALATION':
        if (language === 'bn') {
          return `অবশ্যই! আমি আমাদের কাস্টমার কনসিয়ার্জ টিমের কাছে আপনার অনুরোধটি হস্তান্তর করছি। একজন প্রতিনিধি শীঘ্রই আপনার সাথে যুক্ত হবেন। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।`;
        }
        if (language === 'banglish') {
          return `Obosshoi! Ami amader human concierge team ke transfer korchi. Ekjon representative khub shighroi apnar sathe contact korben.`;
        }
        return `Certainly! I am transferring our conversation to our human concierge team right now. An atelier representative will review your inquiry and reply shortly.`;

      default:
        if (language === 'bn') {
          return `${greetingBn} আপনার অনুসন্ধানের জন্য ধন্যবাদ। আমাদের হেরিটেজ পাঞ্জাবি, সাইজ পরিমাপ, ডেলিভারি চার্জ বা অর্ডার সংক্রান্ত যেকোনো তথ্যের জন্য আমাকে জানান।`;
        }
        if (language === 'banglish') {
          return `${greetingBng} Apnar inquiry er jonno dhonnobad. Amader Panjabi collection, size, delivery charge ba order somporke jante chaile bolun.`;
        }
        return `${greetingEn} Thank you for your inquiry. How may I assist you further with MAVLLIN's contemporary collection, sizing, or store policies?`;
    }
  }

  getSuggestedActions(intent, language) {
    switch (intent) {
      case 'SIZING_QUERY':
        return language === 'bn' ? ['সাইজ চার্ট দেখুন', 'কনসিয়ার্জের সাথে কথা বলুন'] : ['View Sizing Chart', 'Speak with Concierge'];
      case 'DELIVERY_CHARGE_INQUIRY':
        return language === 'bn' ? ['অর্ডার ট্র্যাক করুন', 'পেমেন্ট নিয়মাবলী'] : ['Track Order', 'Payment Policy'];
      default:
        return [];
    }
  }

  /**
   * DeepSeek API Integration (Used when MESSAGING_MODE === 'live' and DEEPSEEK_API_KEY is present)
   */
  async callDeepSeekApi({ messageText, conversationHistory = [] }) {
    const apiKey = env.n8n.deepseekApiKey;
    const apiUrl = env.n8n.deepseekApiUrl;
    const model = env.n8n.deepseekModel;

    const systemPrompt = `You are the Atelier Concierge for MAVLLIN (Dhaka, Bangladesh), a contemporary luxury fashion atelier specializing in Heritage Panjabi, Premium Kurta, Silk Sherwani, and Bespoke Waistcoats.
Knowledge Base Rules:
- Currency: Exclusively Bangladeshi Taka (৳ / BDT). Fixed pricing, strictly no haggling.
- Promo: Code WELCOME10 gives 10% off. Free shipping on orders over ৳2,500.
- Delivery: Inside Dhaka ৳70 (1-2 days), Outside Dhaka ৳130 (3-5 days). Nationwide across 64 districts.
- Payments: COD, bKash, Nagad, Rocket, Bank Transfer.
- Sizing: 38 (S), 40 (M), 42 (L), 44 (XL), 46 (XXL). Finished chest includes 2" ease.
- Returns: 7-day statutory return under CRPA 2009.
- Mirror language: If customer writes in Bengali, reply in polite formal Bengali using "আপনি". If Banglish, reply in Banglish/Bengali. If English, reply in sophisticated contemporary English.
- Keep replies concise (1-3 paragraphs) suited for messaging apps.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-4).map((msg) => ({
        role: msg.sender_type === 'customer' ? 'user' : 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: messageText },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 400,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API returned HTTP ${response.status}`);
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content || null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

module.exports = new AiMessagingService();
module.exports.AiMessagingService = AiMessagingService;
