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

    // Unless the coupon is given universal permission (is_universal === 1), authentication is strictly required
    if (!coupon.is_universal && (!req.user || !req.user.id)) {
      return sendError(res, {
        statusCode: 401,
        message: 'Authentication required to apply coupon discounts. Please log in or create an account.',
      });
    }

    let memberAssignment = null;
    if (!coupon.is_universal) {
      const memberCount = await CouponModel.getMemberCount(coupon.id);
      if (memberCount > 0) {
        memberAssignment = await CouponModel.getMemberUsage(coupon.id, req.user.id);
        if (!memberAssignment) {
          return sendError(res, {
            statusCode: 403,
            message: 'This coupon is restricted to specific eligible members.',
          });
        }

        if (memberAssignment.usage_limit !== null && memberAssignment.used_count >= memberAssignment.usage_limit) {
          return sendError(res, {
            statusCode: 400,
            message: 'You have reached your usage limit for this coupon.',
          });
        }
      } else if (req.user && req.user.id) {
        memberAssignment = await CouponModel.getMemberUsage(coupon.id, req.user.id);
      }
    } else if (req.user && req.user.id) {
      memberAssignment = await CouponModel.getMemberUsage(coupon.id, req.user.id);
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
        is_universal: Boolean(coupon.is_universal),
        member_usage: memberAssignment ? {
          usage_limit: memberAssignment.usage_limit,
          used_count: memberAssignment.used_count,
          remaining_uses: memberAssignment.remaining_uses,
        } : null,
        member_usage_limit: memberAssignment ? memberAssignment.usage_limit : null,
        member_used_count: memberAssignment ? memberAssignment.used_count : null,
        member_remaining_uses: memberAssignment ? memberAssignment.remaining_uses : null,
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

  async getAnalytics(req, res) {
    const analytics = await CouponModel.getAnalytics();
    return sendSuccess(res, {
      message: 'Coupon analytics retrieved successfully',
      data: analytics,
    });
  },

  async getMemberUsage(req, res) {
    const { search, couponCode, limit = 50, offset = 0 } = req.query;
    const ledger = await CouponModel.getMemberUsageLedger({
      search,
      couponCode,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
    });
    return sendSuccess(res, {
      message: 'Member coupon redemptions retrieved successfully',
      data: ledger.redemptions,
      meta: {
        total: ledger.total,
        limit: ledger.limit,
        offset: ledger.offset,
      },
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
    const { code, discount_type, discount_value, min_order_amount, usage_limit, expires_at, is_active, is_universal } = req.body;

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
      is_universal: is_universal !== undefined ? Number(is_universal) : 0,
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
    if (updateData.is_universal !== undefined) {
      updateData.is_universal = Number(updateData.is_universal) ? 1 : 0;
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

  async getMembers(req, res) {
    const { id } = req.params;
    const coupon = await CouponModel.findById(id);
    if (!coupon) {
      return sendError(res, { statusCode: 404, message: 'Coupon not found' });
    }

    const members = await CouponModel.getMembers(id);
    return sendSuccess(res, {
      message: 'Coupon members retrieved successfully',
      data: members,
    });
  },

  async addMember(req, res) {
    const { id } = req.params;
    const coupon = await CouponModel.findById(id);
    if (!coupon) {
      return sendError(res, { statusCode: 404, message: 'Coupon not found' });
    }

    const { user_id, userId, email, usage_limit, usageLimit } = req.body;
    const effectiveLimit = usage_limit || usageLimit || 1;

    try {
      let member;
      if (email) {
        member = await CouponModel.addMemberByEmail(id, { email, usage_limit: effectiveLimit });
      } else if (user_id || userId) {
        member = await CouponModel.addMember(id, { userId: user_id || userId, usage_limit: effectiveLimit });
      } else {
        return sendError(res, {
          statusCode: 400,
          message: 'User ID or email is required to assign member',
        });
      }

      return sendSuccess(res, {
        statusCode: 201,
        message: 'Member assigned to coupon whitelist successfully',
        data: member,
      });
    } catch (err) {
      return sendError(res, {
        statusCode: err.statusCode || 400,
        message: err.message || 'Failed to assign member to coupon whitelist',
      });
    }
  },

  async updateMemberLimit(req, res) {
    const { id, userId } = req.params;
    const coupon = await CouponModel.findById(id);
    if (!coupon) {
      return sendError(res, { statusCode: 404, message: 'Coupon not found' });
    }

    const { usage_limit, usageLimit } = req.body;
    const effectiveLimit = usage_limit !== undefined ? usage_limit : usageLimit;

    if (effectiveLimit === undefined || effectiveLimit === null) {
      return sendError(res, {
        statusCode: 400,
        message: 'usage_limit is required',
      });
    }

    try {
      const updated = await CouponModel.updateMemberLimit(id, userId, effectiveLimit);
      return sendSuccess(res, {
        statusCode: 200,
        message: 'Member usage limit updated successfully',
        data: updated,
      });
    } catch (err) {
      return sendError(res, {
        statusCode: err.statusCode || 400,
        message: err.message || 'Failed to update member usage limit',
      });
    }
  },

  async removeMember(req, res) {
    const { id, userId } = req.params;
    const coupon = await CouponModel.findById(id);
    if (!coupon) {
      return sendError(res, { statusCode: 404, message: 'Coupon not found' });
    }

    const removed = await CouponModel.removeMember(id, userId);
    if (!removed) {
      return sendError(res, {
        statusCode: 404,
        message: 'Member is not on the coupon whitelist',
      });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Member removed from coupon whitelist successfully',
    });
  },
};

module.exports = CouponController;
