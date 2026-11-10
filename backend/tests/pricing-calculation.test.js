const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  roundCurrency,
  calculateOptimalPrice,
  calculateDiscount,
  calculatePricingOverview,
} = require('../src/utils/pricing.util');
const ProductController = require('../src/controllers/product.controller');

describe('Milestone M7-A: Backend Pricing Engine & Automated Test Suite', () => {
  // =========================================================================
  // 1. Currency Rounding Helper
  // =========================================================================
  describe('1. Currency Rounding (Half-Up Financial Rounding)', () => {
    it('rounds down when third decimal is less than 5', () => {
      assert.strictEqual(roundCurrency(12.344), 12.34);
    });

    it('rounds up when third decimal is greater than or equal to 5', () => {
      assert.strictEqual(roundCurrency(12.346), 12.35);
    });

    it('handles classic floating point edge case (1.005 -> 1.01)', () => {
      assert.strictEqual(roundCurrency(1.005), 1.01);
    });

    it('rounds negative numbers symmetrically', () => {
      assert.strictEqual(roundCurrency(-12.345), -12.35);
      assert.strictEqual(roundCurrency(-12.344), -12.34);
    });

    it('returns 0.00 for NaN or invalid inputs', () => {
      assert.strictEqual(roundCurrency('invalid'), 0.0);
      assert.strictEqual(roundCurrency(null), 0.0);
      assert.strictEqual(roundCurrency(undefined), 0.0);
    });
  });

  // =========================================================================
  // 2. Cost-Plus Optimal Price Calculation
  // =========================================================================
  describe('2. Cost-Plus Optimal Price Calculation', () => {
    it('BE-CP-01: calculates optimal price with standard integer cost and margin', () => {
      const price = calculateOptimalPrice(1000, 25);
      assert.strictEqual(price, 1250.0);
    });

    it('BE-CP-02: returns base cost when profit margin is 0% (breakeven)', () => {
      const price = calculateOptimalPrice(1500, 0);
      assert.strictEqual(price, 1500.0);
    });

    it('BE-CP-03: returns 0.00 when base cost is 0', () => {
      const price = calculateOptimalPrice(0, 40);
      assert.strictEqual(price, 0.0);
    });

    it('BE-CP-04: handles high margin percentage (150%)', () => {
      const price = calculateOptimalPrice(800, 150);
      assert.strictEqual(price, 2000.0);
    });

    it('BE-CP-05: handles extreme high margin percentage (500%)', () => {
      const price = calculateOptimalPrice(500, 500);
      assert.strictEqual(price, 3000.0);
    });

    it('BE-CP-06: handles decimal cost and decimal margin (149.95, 17.5%)', () => {
      // 149.95 * 1.175 = 176.19125 -> 176.19
      const price = calculateOptimalPrice(149.95, 17.5);
      assert.strictEqual(price, 176.19);
    });

    it('BE-CP-07: handles decimal cost and decimal margin (125.50, 33.33%)', () => {
      // 125.50 * 1.3333 = 167.32915 -> 167.33
      const price = calculateOptimalPrice(125.5, 33.33);
      assert.strictEqual(price, 167.33);
    });

    it('BE-CP-08: handles standard 20% margin (1000, 20%)', () => {
      const price = calculateOptimalPrice(1000, 20);
      assert.strictEqual(price, 1200.0);
    });

    it('BE-CP-09: handles standard 50% margin (500, 50%)', () => {
      const price = calculateOptimalPrice(500, 50);
      assert.strictEqual(price, 750.0);
    });

    it('BE-CP-10: handles keystone 100% markup (800, 100%)', () => {
      const price = calculateOptimalPrice(800, 100);
      assert.strictEqual(price, 1600.0);
    });

    it('BE-CP-11: handles high luxury 200% margin (400, 200%)', () => {
      const price = calculateOptimalPrice(400, 200);
      assert.strictEqual(price, 1200.0);
    });

    it('BE-CP-12: handles micro-cost boundary (0.50, 10%)', () => {
      const price = calculateOptimalPrice(0.5, 10);
      assert.strictEqual(price, 0.55);
    });

    it('BE-CP-13: returns 0.00 for negative base cost', () => {
      const price = calculateOptimalPrice(-100, 20);
      assert.strictEqual(price, 0.0);
    });

    it('BE-CP-14: clamps negative margin to 0% (returns base cost)', () => {
      const price = calculateOptimalPrice(500, -10);
      assert.strictEqual(price, 500.0);
    });

    it('BE-CP-15: handles non-numeric / NaN input safely', () => {
      assert.strictEqual(calculateOptimalPrice('invalid', null), 0.0);
      assert.strictEqual(calculateOptimalPrice(null, 25), 0.0);
      assert.strictEqual(calculateOptimalPrice(undefined, 25), 0.0);
      assert.strictEqual(calculateOptimalPrice(1000, 'invalid'), 1000.0);
    });

    it('BE-CP-16: parses string representations of numbers correctly', () => {
      const price = calculateOptimalPrice('200', '15');
      assert.strictEqual(price, 230.0);
    });

    it('BE-CP-17: supports optional gross margin formula model', () => {
      // Gross margin: Price = Cost / (1 - Margin/100)
      // 1000 / (1 - 0.20) = 1250.00
      const price = calculateOptimalPrice(1000, 20, { formula: 'gross_margin' });
      assert.strictEqual(price, 1250.0);
    });

    it('BE-CP-18: gross margin formula throws when margin is >= 100%', () => {
      assert.throws(
        () => calculateOptimalPrice(1000, 100, { formula: 'gross_margin' }),
        /Gross margin percentage must be strictly less than 100%/
      );
    });
  });

  // =========================================================================
  // 3. Discount Calculations
  // =========================================================================
  describe('3. Discount Calculations', () => {
    describe('Percentage Discounts', () => {
      it('BE-DC-01: handles 0% percentage discount (no discount)', () => {
        const res = calculateDiscount(2000, 'percentage', 0);
        assert.strictEqual(res.discount_type, 'percentage');
        assert.strictEqual(res.discount_amount, 0.0);
        assert.strictEqual(res.final_price, 2000.0);
        assert.strictEqual(res.savings, 0.0);
      });

      it('BE-DC-02: handles 15% percentage discount on 2000 BDT', () => {
        const res = calculateDiscount(2000, 'percentage', 15);
        assert.strictEqual(res.discount_amount, 300.0);
        assert.strictEqual(res.final_price, 1700.0);
      });

      it('BE-DC-03: handles standard 20% percentage discount on 2500 BDT', () => {
        const res = calculateDiscount(2500, 'percentage', 20);
        assert.strictEqual(res.discount_amount, 500.0);
        assert.strictEqual(res.final_price, 2000.0);
      });

      it('BE-DC-04: handles 50% percentage discount on 1000 BDT', () => {
        const res = calculateDiscount(1000, 'percentage', 50);
        assert.strictEqual(res.discount_amount, 500.0);
        assert.strictEqual(res.final_price, 500.0);
      });

      it('BE-DC-05: handles 100% full percentage discount (free product)', () => {
        const res = calculateDiscount(1800, 'percentage', 100);
        assert.strictEqual(res.discount_amount, 1800.0);
        assert.strictEqual(res.final_price, 0.0);
      });

      it('BE-DC-06: clamps percentage discount > 100% to 100% (120% -> 100%)', () => {
        const res = calculateDiscount(1000, 'percentage', 120);
        assert.strictEqual(res.discount_amount, 1000.0);
        assert.strictEqual(res.final_price, 0.0);
      });

      it('BE-DC-07: clamps percentage discount > 100% to 100% (150% -> 100%)', () => {
        const res = calculateDiscount(1000, 'percentage', 150);
        assert.strictEqual(res.discount_amount, 1000.0);
        assert.strictEqual(res.final_price, 0.0);
      });

      it('BE-DC-08: handles fractional percentage discount (12.5% on 1250 BDT)', () => {
        // 1250 * 0.125 = 156.25 -> final 1093.75
        const res = calculateDiscount(1250, 'percentage', 12.5);
        assert.strictEqual(res.discount_amount, 156.25);
        assert.strictEqual(res.final_price, 1093.75);
      });

      it('BE-DC-09: clamps negative percentage discount to 0%', () => {
        const res = calculateDiscount(2000, 'percentage', -15);
        assert.strictEqual(res.discount_amount, 0.0);
        assert.strictEqual(res.final_price, 2000.0);
      });
    });

    describe('Fixed Amount Discounts', () => {
      it('BE-DC-10: handles zero fixed discount', () => {
        const res = calculateDiscount(3000, 'fixed', 0);
        assert.strictEqual(res.discount_type, 'fixed');
        assert.strictEqual(res.discount_amount, 0.0);
        assert.strictEqual(res.final_price, 3000.0);
      });

      it('BE-DC-11: handles fixed discount less than selling price (450 off 2200)', () => {
        const res = calculateDiscount(2200, 'fixed', 450);
        assert.strictEqual(res.discount_amount, 450.0);
        assert.strictEqual(res.final_price, 1750.0);
      });

      it('BE-DC-12: handles fixed discount equal to selling price (1500 off 1500)', () => {
        const res = calculateDiscount(1500, 'fixed', 1500);
        assert.strictEqual(res.discount_amount, 1500.0);
        assert.strictEqual(res.final_price, 0.0);
      });

      it('BE-DC-13: clamps fixed discount exceeding selling price to selling price (1500 off 1000)', () => {
        const res = calculateDiscount(1000, 'fixed', 1500);
        assert.strictEqual(res.discount_amount, 1000.0);
        assert.strictEqual(res.final_price, 0.0);
      });

      it('BE-DC-14: handles decimal fixed discount (199.50 off 999.99)', () => {
        const res = calculateDiscount(999.99, 'fixed', 199.5);
        assert.strictEqual(res.discount_amount, 199.5);
        assert.strictEqual(res.final_price, 800.49);
      });

      it('BE-DC-15: clamps negative fixed discount to 0', () => {
        const res = calculateDiscount(1000, 'fixed', -100);
        assert.strictEqual(res.discount_amount, 0.0);
        assert.strictEqual(res.final_price, 1000.0);
      });
    });

    describe('No Discount & Edge Cases', () => {
      it('BE-DC-16: handles discount_type "none" regardless of discount_value', () => {
        const res = calculateDiscount(1800, 'none', 200);
        assert.strictEqual(res.discount_type, 'none');
        assert.strictEqual(res.discount_amount, 0.0);
        assert.strictEqual(res.final_price, 1800.0);
      });

      it('BE-DC-17: handles null / undefined discount_type defaulting to "none"', () => {
        const res1 = calculateDiscount(1500, null, 100);
        assert.strictEqual(res1.discount_type, 'none');
        assert.strictEqual(res1.final_price, 1500.0);

        const res2 = calculateDiscount(1500, undefined, 100);
        assert.strictEqual(res2.discount_type, 'none');
        assert.strictEqual(res2.final_price, 1500.0);
      });

      it('BE-DC-18: handles unknown discount_type defaulting to "none"', () => {
        const res = calculateDiscount(1500, 'coupon', 100);
        assert.strictEqual(res.discount_type, 'none');
        assert.strictEqual(res.final_price, 1500.0);
      });

      it('BE-DC-19: handles case insensitive discount type strings', () => {
        const resPct = calculateDiscount(1000, 'PERCENTAGE', 20);
        assert.strictEqual(resPct.discount_type, 'percentage');
        assert.strictEqual(resPct.final_price, 800.0);

        const resFixed = calculateDiscount(1000, ' Fixed ', 150);
        assert.strictEqual(resFixed.discount_type, 'fixed');
        assert.strictEqual(resFixed.final_price, 850.0);
      });

      it('BE-DC-20: handles zero selling price', () => {
        const res = calculateDiscount(0, 'percentage', 20);
        assert.strictEqual(res.discount_amount, 0.0);
        assert.strictEqual(res.final_price, 0.0);
      });

      it('BE-DC-21: handles negative selling price clamped to 0', () => {
        const res = calculateDiscount(-500, 'percentage', 20);
        assert.strictEqual(res.discount_amount, 0.0);
        assert.strictEqual(res.final_price, 0.0);
      });
    });
  });

  // =========================================================================
  // 4. Pricing Overview Calculations
  // =========================================================================
  describe('4. Pricing Overview Calculations', () => {
    it('BE-OV-01: calculates complete overview with cost, optimal price, selling price, and discount', () => {
      const overview = calculatePricingOverview({
        baseCost: 1000,
        marginPercentage: 25,
        sellingPrice: 1250,
        discountType: 'percentage',
        discountValue: 20,
      });

      assert.strictEqual(overview.base_cost, 1000.0);
      assert.strictEqual(overview.margin_percentage, 25.0);
      assert.strictEqual(overview.optimal_price, 1250.0);
      assert.strictEqual(overview.selling_price, 1250.0);
      assert.strictEqual(overview.discount_type, 'percentage');
      assert.strictEqual(overview.discount_value, 20.0);
      assert.strictEqual(overview.discount_amount, 250.0);
      assert.strictEqual(overview.final_price, 1000.0);
      assert.strictEqual(overview.savings, 250.0);
      assert.strictEqual(overview.profit, 0.0);
      assert.strictEqual(overview.profit_margin, 0.0);
    });

    it('BE-OV-02: defaults selling price to optimal price when sellingPrice is not specified', () => {
      const overview = calculatePricingOverview({
        baseCost: 1000,
        marginPercentage: 50,
        discountType: 'fixed',
        discountValue: 200,
      });

      assert.strictEqual(overview.optimal_price, 1500.0);
      assert.strictEqual(overview.selling_price, 1500.0); // automatically set to optimal_price
      assert.strictEqual(overview.discount_amount, 200.0);
      assert.strictEqual(overview.final_price, 1300.0);
      assert.strictEqual(overview.profit, 300.0); // 1300 - 1000
      assert.strictEqual(overview.profit_margin, 30.0); // (300 / 1000) * 100
    });

    it('BE-OV-03: handles overview with no discount', () => {
      const overview = calculatePricingOverview({
        baseCost: 1200,
        marginPercentage: 25,
      });

      assert.strictEqual(overview.optimal_price, 1500.0);
      assert.strictEqual(overview.selling_price, 1500.0);
      assert.strictEqual(overview.discount_type, 'none');
      assert.strictEqual(overview.discount_amount, 0.0);
      assert.strictEqual(overview.final_price, 1500.0);
      assert.strictEqual(overview.profit, 300.0);
      assert.strictEqual(overview.profit_margin, 25.0);
    });

    it('BE-OV-04: handles selling price different from recommended optimal price', () => {
      const overview = calculatePricingOverview({
        baseCost: 800,
        marginPercentage: 25, // optimal = 1000
        sellingPrice: 1400, // custom premium selling price
        discountType: 'percentage',
        discountValue: 10,
      });

      assert.strictEqual(overview.optimal_price, 1000.0);
      assert.strictEqual(overview.selling_price, 1400.0);
      assert.strictEqual(overview.discount_amount, 140.0);
      assert.strictEqual(overview.final_price, 1260.0);
      assert.strictEqual(overview.profit, 460.0); // 1260 - 800
      assert.strictEqual(overview.profit_margin, 57.5); // (460 / 800) * 100
    });

    it('BE-OV-05: handles 100% discount resulting in negative net profit', () => {
      const overview = calculatePricingOverview({
        baseCost: 500,
        marginPercentage: 50,
        sellingPrice: 750,
        discountType: 'percentage',
        discountValue: 100,
      });

      assert.strictEqual(overview.final_price, 0.0);
      assert.strictEqual(overview.profit, -500.0);
      assert.strictEqual(overview.profit_margin, -100.0);
    });

    it('BE-OV-06: supports positional arguments syntax', () => {
      const overview = calculatePricingOverview(1000, 20, 1200, 'fixed', 100);
      assert.strictEqual(overview.optimal_price, 1200.0);
      assert.strictEqual(overview.selling_price, 1200.0);
      assert.strictEqual(overview.discount_amount, 100.0);
      assert.strictEqual(overview.final_price, 1100.0);
      assert.strictEqual(overview.profit, 100.0);
      assert.strictEqual(overview.profit_margin, 10.0);
    });

    it('BE-OV-07: seamlessly supports both snake_case and camelCase parameters', () => {
      const snakeResult = calculatePricingOverview({
        base_cost: 600,
        margin_percentage: 50,
        selling_price: 900,
        discount_type: 'percentage',
        discount_value: 10,
      });

      const camelResult = calculatePricingOverview({
        baseCost: 600,
        marginPercentage: 50,
        sellingPrice: 900,
        discountType: 'percentage',
        discountValue: 10,
      });

      assert.deepStrictEqual(snakeResult, camelResult);
    });

    it('BE-OV-08: safely handles zero base cost without division by zero', () => {
      const overview = calculatePricingOverview({
        baseCost: 0,
        marginPercentage: 50,
        sellingPrice: 500,
      });

      assert.strictEqual(overview.base_cost, 0.0);
      assert.strictEqual(overview.optimal_price, 0.0);
      assert.strictEqual(overview.profit, 500.0);
      assert.strictEqual(overview.profit_margin, 0.0);
      assert.strictEqual(isNaN(overview.profit_margin), false);
    });
  });

  // =========================================================================
  // 5. Integration with resolveDiscountData & ProductController
  // =========================================================================
  describe('5. Integration with resolveDiscountData & ProductController', () => {
    it('BE-INT-01: resolveDiscountData calculates standard 20% discount on 2000 BDT', () => {
      const result = ProductController.resolveDiscountData(2000, 'percentage', 20, null);
      assert.strictEqual(result.discount_type, 'percentage');
      assert.strictEqual(result.discount_value, 20);
      assert.strictEqual(result.discount_price, 1600.0);
    });

    it('BE-INT-02: resolveDiscountData clamps percentage discount > 100% preventing negative price', () => {
      // Prior flaw: 1000 * (1 - 1.5) = -500.00
      // Clamped behavior: discount_price = 0.00
      const result = ProductController.resolveDiscountData(1000, 'percentage', 150, null);
      assert.strictEqual(result.discount_type, 'percentage');
      assert.strictEqual(result.discount_price, 0.0);
      assert.ok(result.discount_price >= 0, 'Discount price must never be negative');
    });

    it('BE-INT-03: resolveDiscountData calculates standard fixed discount', () => {
      const result = ProductController.resolveDiscountData(2000, 'fixed', 350, null);
      assert.strictEqual(result.discount_type, 'fixed');
      assert.strictEqual(result.discount_value, 350);
      assert.strictEqual(result.discount_price, 1650.0);
    });

    it('BE-INT-04: resolveDiscountData clamps fixed discount exceeding base price to 0.00', () => {
      const result = ProductController.resolveDiscountData(2000, 'fixed', 2500, null);
      assert.strictEqual(result.discount_type, 'fixed');
      assert.strictEqual(result.discount_price, 0.0);
      assert.ok(result.discount_price >= 0, 'Discount price must never be negative');
    });

    it('BE-INT-05: resolveDiscountData sets discount_price to null when discount_type is "none"', () => {
      const result = ProductController.resolveDiscountData(2000, 'none', 0, null);
      assert.strictEqual(result.discount_type, 'none');
      assert.strictEqual(result.discount_value, 0.0);
      assert.strictEqual(result.discount_price, null);
    });

    it('BE-INT-06: resolveDiscountData converts legacy discount_price to fixed discount when type is "none"', () => {
      // basePrice = 1000, discountPrice = 950 -> fixed discount of 50 BDT
      const result = ProductController.resolveDiscountData(1000, 'none', 0, 950);
      assert.strictEqual(result.discount_type, 'fixed');
      assert.strictEqual(result.discount_value, 50.0);
      assert.strictEqual(result.discount_price, 950);
    });

    it('BE-INT-07: ProductController.calculatePricing method responds with HTTP 200 overview data', () => {
      let responseStatus = null;
      let responseBody = null;

      const mockReq = {
        body: {
          base_cost: 1200.0,
          margin_percentage: 25.0,
          selling_price: 1500.0,
          discount_type: 'percentage',
          discount_value: 15.0,
        },
      };

      const mockRes = {
        status(code) {
          responseStatus = code;
          return this;
        },
        json(payload) {
          responseBody = payload;
          return this;
        },
      };

      ProductController.calculatePricing(mockReq, mockRes);

      assert.strictEqual(responseStatus, 200);
      assert.strictEqual(responseBody.success, true);
      assert.strictEqual(responseBody.data.base_cost, 1200.0);
      assert.strictEqual(responseBody.data.optimal_price, 1500.0);
      assert.strictEqual(responseBody.data.selling_price, 1500.0);
      assert.strictEqual(responseBody.data.discount_amount, 225.0);
      assert.strictEqual(responseBody.data.final_price, 1275.0);
      assert.strictEqual(responseBody.data.profit, 75.0);
    });
  });
});
