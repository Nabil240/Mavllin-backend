/**
 * Pricing Calculation Utility
 *
 * Provides pure financial calculation functions for:
 * 1. Cost-plus margin optimal price calculation:
 *    optimal_price = round(base_cost * (1 + max(0, margin_percentage) / 100), 2)
 * 2. Discount resolution for percentage, fixed amount, and none types with boundary clamping.
 * 3. Unified pricing overview model computing selling price, discounts, final sale price, profit, and margin.
 */

/**
 * Standard half-up financial rounding to 2 decimal places.
 * Handles floating-point inaccuracies (e.g. 1.005 -> 1.01).
 *
 * @param {number|string} amount
 * @returns {number}
 */
function roundCurrency(amount) {
  const num = Number(amount);
  if (isNaN(num)) return 0.0;
  const sign = num < 0 ? -1 : 1;
  return sign * (Math.round((Math.abs(num) + Number.EPSILON) * 100) / 100);
}

/**
 * Calculate optimal selling price based on cost-plus margin calculation.
 *
 * Formula:
 * optimal_price = round(base_cost * (1 + max(0, margin_percentage) / 100), 2)
 *
 * Returns 0.00 if baseCost <= 0 or invalid.
 *
 * @param {number|string} baseCost Base cost of goods / acquisition cost
 * @param {number|string} marginPercentage Desired markup / margin percentage
 * @param {object} [options] Optional configuration ({ formula: 'cost_plus' | 'gross_margin' })
 * @returns {number} Optimal recommended selling price
 */
function calculateOptimalPrice(baseCost, marginPercentage, options = {}) {
  const cost = Number(baseCost);
  if (isNaN(cost) || cost <= 0) {
    return 0.0;
  }

  const rawMargin = Number(marginPercentage);
  const margin = isNaN(rawMargin) ? 0 : Math.max(0, rawMargin);

  if (options && options.formula === 'gross_margin') {
    if (margin >= 100) {
      throw new Error('Gross margin percentage must be strictly less than 100%');
    }
    return roundCurrency(cost / (1.0 - margin / 100.0));
  }

  // Standard Cost-Plus Markup Model
  return roundCurrency(cost * (1.0 + margin / 100.0));
}

/**
 * Calculate discount amount and resulting final sale price.
 *
 * Supports discount types:
 * - 'percentage': discount_amount = round(selling_price * min(100, max(0, discount_value)) / 100, 2)
 *                 final_price = max(0.00, round(selling_price - discount_amount, 2))
 * - 'fixed':      discount_amount = min(selling_price, max(0, round(discount_value, 2)))
 *                 final_price = max(0.00, round(selling_price - discount_amount, 2))
 * - 'none':       discount_amount = 0.00, final_price = selling_price
 *
 * Clamps percentage discount to 0..100% and fixed discount to selling_price to guarantee non-negative final price.
 *
 * @param {number|string} sellingPrice The base selling price
 * @param {string} [discountType='none'] 'percentage' | 'fixed' | 'none'
 * @param {number|string} [discountValue=0] The discount rate (%) or fixed amount (BDT)
 * @returns {object} Breakdown of discount type, value, amount, final price, and savings
 */
function calculateDiscount(sellingPrice, discountType = 'none', discountValue = 0) {
  const rawPrice = Number(sellingPrice);
  const price = isNaN(rawPrice) ? 0 : Math.max(0, roundCurrency(rawPrice));

  const rawType = discountType ? String(discountType).trim().toLowerCase() : 'none';
  const type = ['percentage', 'percent'].includes(rawType)
    ? 'percentage'
    : rawType === 'fixed'
      ? 'fixed'
      : 'none';

  const rawVal = Number(discountValue);
  const val = isNaN(rawVal) ? 0 : Math.max(0, rawVal);

  let discountAmount = 0.0;
  let finalPrice = price;

  if (price === 0) {
    discountAmount = 0.0;
    finalPrice = 0.0;
  } else if (type === 'percentage') {
    const clampedPct = Math.min(100, val);
    discountAmount = roundCurrency(price * (clampedPct / 100.0));
    finalPrice = Math.max(0.0, roundCurrency(price - discountAmount));
  } else if (type === 'fixed') {
    const roundedVal = roundCurrency(val);
    discountAmount = Math.min(price, Math.max(0, roundedVal));
    finalPrice = Math.max(0.0, roundCurrency(price - discountAmount));
  } else {
    // type === 'none'
    discountAmount = 0.0;
    finalPrice = price;
  }

  const effectiveValue = type === 'none' ? 0.0 : roundCurrency(val);

  return {
    discount_type: type,
    discountType: type,
    discount_value: effectiveValue,
    discountValue: effectiveValue,
    discount_amount: discountAmount,
    discountAmount: discountAmount,
    final_price: finalPrice,
    finalPrice: finalPrice,
    savings: discountAmount,
  };
}

/**
 * Unified Pricing Overview Calculation.
 *
 * Computes optimal price, active selling price, discount deductions, final sale price,
 * net profit, and profit margin percentage.
 *
 * Accepts either a single options object or positional arguments:
 * calculatePricingOverview({ baseCost, marginPercentage, sellingPrice, discountType, discountValue })
 *
 * @param {object|number} optionsOrBaseCost Configuration object or base cost
 * @returns {object} Full pricing overview
 */
function calculatePricingOverview(optionsOrBaseCost = {}, ...args) {
  let params = {};
  if (typeof optionsOrBaseCost === 'number' || args.length > 0) {
    params = {
      baseCost: optionsOrBaseCost,
      marginPercentage: args[0],
      sellingPrice: args[1],
      discountType: args[2],
      discountValue: args[3],
    };
  } else if (typeof optionsOrBaseCost === 'object' && optionsOrBaseCost !== null) {
    params = optionsOrBaseCost;
  }

  const rawCost = params.baseCost !== undefined ? params.baseCost : params.base_cost;
  const costNum = Number(rawCost);
  const cost = isNaN(costNum) || costNum <= 0 ? 0.0 : roundCurrency(costNum);

  const rawMargin = params.marginPercentage !== undefined
    ? params.marginPercentage
    : (params.margin_percentage !== undefined
      ? params.margin_percentage
      : (params.profitMarginPercentage !== undefined
        ? params.profitMarginPercentage
        : params.profit_margin_percentage));
  const marginNum = Number(rawMargin);
  const margin = isNaN(marginNum) ? 0.0 : Math.max(0, roundCurrency(marginNum));

  const optimalPrice = calculateOptimalPrice(cost, margin);

  const rawSelling = params.sellingPrice !== undefined ? params.sellingPrice : params.selling_price;
  let activeSellingPrice;
  if (rawSelling !== undefined && rawSelling !== null && rawSelling !== '') {
    const parsedSelling = Number(rawSelling);
    activeSellingPrice = isNaN(parsedSelling) ? optimalPrice : Math.max(0, roundCurrency(parsedSelling));
  } else {
    activeSellingPrice = optimalPrice;
  }

  const rawType = params.discountType !== undefined ? params.discountType : params.discount_type;
  const rawDiscountVal = params.discountValue !== undefined ? params.discountValue : params.discount_value;

  const discountDetails = calculateDiscount(activeSellingPrice, rawType, rawDiscountVal);
  const finalPrice = discountDetails.final_price;
  const profit = roundCurrency(finalPrice - cost);
  const profitMargin = cost > 0 ? roundCurrency((profit / cost) * 100.0) : 0.0;

  return {
    base_cost: cost,
    baseCost: cost,
    margin_percentage: margin,
    marginPercentage: margin,
    optimal_price: optimalPrice,
    optimalPrice: optimalPrice,
    selling_price: activeSellingPrice,
    sellingPrice: activeSellingPrice,
    discount_type: discountDetails.discount_type,
    discountType: discountDetails.discountType,
    discount_value: discountDetails.discount_value,
    discountValue: discountDetails.discountValue,
    discount_amount: discountDetails.discount_amount,
    discountAmount: discountDetails.discountAmount,
    final_price: finalPrice,
    finalPrice: finalPrice,
    savings: discountDetails.savings,
    profit: profit,
    profit_margin: profitMargin,
    profitMargin: profitMargin,
    effective_margin_percentage: profitMargin,
  };
}

module.exports = {
  roundCurrency,
  calculateOptimalPrice,
  calculateDiscount,
  calculatePricingOverview,
};
