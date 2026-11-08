const CouponModel = require('../models/coupon.model');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { paginate } = require('../utils/helpers');

const CouponController = {
  async validate(req, res) {
    const { code, subtotal } = req.body;

    if (!code) {
      return sendError(res, { statusCode: 400, message: 'Coupon code is required' });
    }

    const coupon = await CouponModel.findByCode(code);
    if (!coupon) {
      return sendError(res, { statusCode: 404, message: 'Invalid coupon code' });
    }

    const result = CouponModel.calculateDiscount(coupon, subtotal || 0);
    if (!result.valid) {
      return sendError(res, { statusCode: 400, message: result.message });
    }

    return sendSuccess(res, {
      message: result.message,
      data: {
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: Number(coupon.discount_value),
        discount_amount: result.discount,
        coupon_id: coupon.id,
      },
    });
  },

  async getAll(req, res) {
    const { page = 1, limit = 20, search, isActive } = req.query;

    const total = await CouponModel.countAll({
      search,
      isActive: isActive !== undefined ? isActive === 'true' : null,
    });

    const pagination = paginate({ page, limit, total });

    const coupons = await CouponModel.findAll({
      offset: pagination.offset,
      limit: pagination.limit,
      search,
      isActive: isActive !== undefined ? isActive === 'true' : null,
    });

    return sendSuccess(res, {
      message: 'Coupons retrieved successfully',
      data: coupons,
      meta: pagination,
    });
  },

  async getOne(req, res) {
    const { id } = req.params;
    const coupon = await CouponModel.findById(id);

    if (!coupon) {
      return sendError(res, { statusCode: 404, message: 'Coupon not found' });
    }

    return sendSuccess(res, {
      message: 'Coupon retrieved',
      data: coupon,
    });
  },

  async create(req, res) {
    const { code, discount_type, discount_value, min_order_amount, usage_limit, expires_at, is_active } = req.body;

    const existing = await CouponModel.findByCode(code);
    if (existing) {
      return sendError(res, { statusCode: 409, message: 'Coupon code already exists' });
    }

    const coupon = await CouponModel.create({
      code,
      discount_type,
      discount_value: Number(discount_value),
      min_order_amount: min_order_amount ? Number(min_order_amount) : 0,
      usage_limit: usage_limit ? Number(usage_limit) : null,
      expires_at: expires_at || null,
      is_active: is_active !== undefined ? Number(is_active) : 1,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Coupon created successfully',
      data: coupon,
    });
  },

  async update(req, res) {
    const { id } = req.params;
    const coupon = await CouponModel.findById(id);

    if (!coupon) {
      return sendError(res, { statusCode: 404, message: 'Coupon not found' });
    }

    const updateData = { ...req.body };
    if (updateData.discount_value !== undefined) updateData.discount_value = Number(updateData.discount_value);
    if (updateData.min_order_amount !== undefined) updateData.min_order_amount = Number(updateData.min_order_amount);
    if (updateData.usage_limit !== undefined) {
      updateData.usage_limit = updateData.usage_limit ? Number(updateData.usage_limit) : null;
    }

    if (updateData.code && updateData.code.toUpperCase().trim() !== coupon.code) {
      const existing = await CouponModel.findByCode(updateData.code);
      if (existing && existing.id !== Number(id)) {
        return sendError(res, { statusCode: 409, message: 'Coupon code is already taken' });
      }
    }

    const updated = await CouponModel.update(id, updateData);

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Coupon updated successfully',
      data: updated,
    });
  },

  async delete(req, res) {
    const { id } = req.params;
    const success = await CouponModel.delete(id);

    if (!success) {
      return sendError(res, { statusCode: 404, message: 'Coupon not found or already deleted' });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Coupon deleted successfully',
    });
  },
};

module.exports = CouponController;
