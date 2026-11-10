const bcrypt = require('bcryptjs');
const DashboardModel = require('../models/dashboard.model');
const UserModel = require('../models/user.model');
const ProductModel = require('../models/product.model');
const OrderModel = require('../models/order.model');
const ReviewModel = require('../models/review.model');
const SettingModel = require('../models/setting.model');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { paginate, sanitizeUser } = require('../utils/helpers');

const AdminController = {
  async getDashboard(req, res) {
    const [overview, recentOrders, topProducts, monthlyRevenue, lowStock] = await Promise.all([
      DashboardModel.getOverviewStats(),
      DashboardModel.getRecentOrders(6),
      DashboardModel.getTopProducts(5),
      DashboardModel.getMonthlyRevenue(),
      DashboardModel.getLowStockProducts(5),
    ]);

    return sendSuccess(res, {
      message: 'Dashboard data retrieved successfully',
      data: {
        stats: {
          total_orders: Number(overview.total_orders || 0),
          total_revenue: parseFloat(Number(overview.total_revenue || 0).toFixed(2)),
          gross_revenue: parseFloat(Number(overview.gross_revenue || 0).toFixed(2)),
          total_products: Number(overview.total_products || 0),
          total_variants: Number(overview.total_variants || 0),
          total_customers: Number(overview.total_customers || 0),
          low_stock_count: Number(overview.low_stock_count || 0),
          out_of_stock_count: Number(overview.out_of_stock_count || 0),
          pending_orders: Number(overview.pending_orders || 0),
          total_investment: parseFloat(Number(overview.total_investment || 0).toFixed(2)),
          realized_profit: parseFloat(Number(overview.realized_profit || 0).toFixed(2)),
          investment_amount: parseFloat(Number(overview.total_investment || 0).toFixed(2)),
          profit: parseFloat(Number(overview.realized_profit || 0).toFixed(2)),
        },
        recent_orders: recentOrders,
        top_products: topProducts,
        monthly_revenue: monthlyRevenue,
        low_stock_products: lowStock,
        low_stock_variants: lowStock,
      },
    });
  },

  async getInventory(req, res) {
    const { page = 1, limit = 25, search = null, stockStatus = 'all' } = req.query;
    const offset = (Math.max(1, Number(page) || 1) - 1) * Math.max(1, Number(limit) || 25);

    const { total, items } = await DashboardModel.getInventoryVariants({
      offset,
      limit: Math.max(1, Number(limit) || 25),
      search,
      stockStatus,
    });

    const itemsWithBadges = items.map((item) => {
      const stock = Number(item.stock_quantity || 0);
      let stock_badge = 'in_stock';
      let badge_label = 'In Stock';
      let badge_color = 'success';

      if (stock === 0) {
        stock_badge = 'out_of_stock';
        badge_label = 'Out of Stock';
        badge_color = 'danger';
      } else if (stock <= 5) {
        stock_badge = 'low_stock';
        badge_label = 'Low Stock';
        badge_color = 'warning';
      }

      return {
        ...item,
        is_low_stock: stock > 0 && stock <= 5,
        is_out_of_stock: stock === 0,
        stock_badge,
        badge_label,
        badge_color,
      };
    });

    const pagination = paginate({ page, limit, total });

    return sendSuccess(res, {
      message: 'Inventory retrieved successfully',
      data: itemsWithBadges,
      meta: pagination,
    });
  },

  async getInventoryMovements(req, res) {
    const { variantId, reason, limit = 50 } = req.query;
    const movements = await DashboardModel.getInventoryMovements({
      variantId,
      reason,
      limit,
    });

    return sendSuccess(res, {
      message: 'Inventory movements retrieved successfully',
      data: movements,
    });
  },

  async adjustInventory(req, res) {
    const variantId = Number(req.body.variant_id || req.body.variantId);
    const delta = Number(req.body.quantity_delta !== undefined ? req.body.quantity_delta : req.body.delta);
    const reason = req.body.reason || 'manual_adjustment';
    const note = (req.body.note || '').trim();

    if (!variantId || isNaN(variantId)) {
      return sendError(res, { statusCode: 422, message: 'Valid variant_id is required' });
    }

    if (isNaN(delta) || !Number.isInteger(delta) || delta === 0) {
      return sendError(res, { statusCode: 422, message: 'quantity_delta must be a non-zero integer' });
    }

    if (!note) {
      return sendError(res, { statusCode: 422, message: 'A reason/note is required for manual stock adjustment' });
    }

    const allowedReasons = ['restock', 'manual_adjustment', 'damaged', 'return', 'initial_stock'];
    const safeReason = allowedReasons.includes(reason) ? reason : 'manual_adjustment';

    try {
      const result = await ProductModel.adjustVariantStock(
        variantId,
        delta,
        safeReason,
        req.user ? req.user.id : null,
        null,
        null,
        note
      );
      const updatedVariant = await ProductModel.findVariantById(variantId);

      return sendSuccess(res, {
        statusCode: 200,
        message: 'Inventory adjusted successfully',
        data: {
          ...result,
          variant_id: variantId,
          variantId,
          before_quantity: result.beforeQty,
          beforeQty: result.beforeQty,
          after_quantity: result.afterQty,
          afterQty: result.afterQty,
          stock_quantity: result.afterQty,
          delta,
          quantity_delta: delta,
          variant: updatedVariant,
        },
      });
    } catch (err) {
      if (err.message && err.message.includes('not found')) {
        return sendError(res, { statusCode: 404, message: err.message });
      }
      if (err.message && err.message.includes('Insufficient stock')) {
        return sendError(res, { statusCode: 400, message: err.message });
      }
      throw err;
    }
  },

  async getPayments(req, res) {
    const { page = 1, limit = 20, status = null, provider = null } = req.query;
    const offset = (Math.max(1, Number(page) || 1) - 1) * Math.max(1, Number(limit) || 20);

    const { total, items } = await DashboardModel.getPayments({
      offset,
      limit: Math.max(1, Number(limit) || 20),
      status,
      provider,
    });

    const pagination = paginate({ page, limit, total });

    return sendSuccess(res, {
      message: 'Payments retrieved successfully',
      data: items,
      meta: pagination,
    });
  },

  async getSalesReport(_req, res) {
    const report = await DashboardModel.getSalesReport();
    return sendSuccess(res, {
      message: 'Sales report retrieved successfully',
      data: report,
    });
  },

  async getCustomers(req, res) {
    const { page = 1, limit = 15, search, role } = req.query;

    const total = await UserModel.countAll({ search, role });
    const pagination = paginate({ page, limit, total });

    const users = await UserModel.findAll({
      offset: pagination.offset,
      limit: pagination.limit,
      search,
      role,
    });

    return sendSuccess(res, {
      message: 'Customers retrieved successfully',
      data: users.map(sanitizeUser),
      meta: pagination,
    });
  },

  async toggleCustomerStatus(req, res) {
    const { id } = req.params;
    const { is_active } = req.body;

    const user = await UserModel.findById(id);
    if (!user) {
      return sendError(res, { statusCode: 404, message: 'User not found' });
    }

    if (user.id === req.user.id) {
      return sendError(res, { statusCode: 400, message: 'You cannot change your own active status' });
    }

    const updated = await UserModel.update(id, { is_active: Number(is_active) ? 1 : 0 });

    return sendSuccess(res, {
      statusCode: 200,
      message: `User status updated to ${updated.is_active ? 'Active' : 'Inactive'}`,
      data: sanitizeUser(updated),
    });
  },

  async createCustomer(req, res) {
    const { full_name, email, password, phone, role = 'customer', is_active = 1 } = req.body;
    if (!full_name || !email || !password) {
      return sendError(res, { statusCode: 400, message: 'Full name, email, and password are required' });
    }
    const existing = await UserModel.findByEmail(email.trim().toLowerCase());
    if (existing) {
      return sendError(res, { statusCode: 409, message: 'Email is already registered' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const created = await UserModel.create({
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      password_hash,
      phone: phone ? phone.trim() : null,
      role: ['customer', 'admin', 'staff'].includes(role) ? role : 'customer',
    });
    if (Number(is_active) === 0) {
      await UserModel.update(created.id, { is_active: 0 });
    }
    const finalUser = await UserModel.findById(created.id);
    return sendSuccess(res, {
      statusCode: 201,
      message: 'User account created successfully',
      data: sanitizeUser(finalUser),
    });
  },

  async updateCustomer(req, res) {
    const { id } = req.params;
    const { full_name, email, phone, role, is_active, password } = req.body;
    const user = await UserModel.findById(id);
    if (!user) {
      return sendError(res, { statusCode: 404, message: 'User not found' });
    }

    const updates = {};
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existing = await UserModel.findByEmail(normalizedEmail);
        if (existing && existing.id !== Number(id)) {
          return sendError(res, { statusCode: 409, message: 'Email is already in use by another user' });
        }
      }
      updates.email = normalizedEmail;
    }
    if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
    if (role !== undefined && ['customer', 'admin', 'staff'].includes(role)) {
      updates.role = role;
    }
    if (is_active !== undefined && user.id !== req.user.id) {
      updates.is_active = Number(is_active) ? 1 : 0;
    }
    if (password && String(password).trim().length >= 6) {
      updates.password_hash = await bcrypt.hash(String(password).trim(), 10);
    }

    const updated = await UserModel.update(id, updates);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'User updated successfully',
      data: sanitizeUser(updated),
    });
  },

  async deleteCustomer(req, res) {
    const { id } = req.params;
    const user = await UserModel.findById(id);
    if (!user) {
      return sendError(res, { statusCode: 404, message: 'User not found' });
    }
    if (user.id === req.user.id) {
      return sendError(res, { statusCode: 400, message: 'You cannot delete your own admin account' });
    }
    await UserModel.delete(id);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'User deleted successfully',
    });
  },

  async deleteOrder(req, res) {
    const { id } = req.params;
    const deleted = await OrderModel.delete(id);
    if (!deleted) {
      return sendError(res, { statusCode: 404, message: 'Order not found' });
    }
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Order deleted and inventory restored',
    });
  },

  async getReviews(req, res) {
    const { page = 1, limit = 50, search = null, rating = null } = req.query;
    const total = await ReviewModel.countAllAdmin({ search, rating });
    const pagination = paginate({ page, limit, total });
    const reviews = await ReviewModel.findAllAdmin({
      offset: pagination.offset,
      limit: pagination.limit,
      search,
      rating,
    });
    return sendSuccess(res, {
      message: 'Reviews retrieved successfully',
      data: reviews,
      meta: pagination,
    });
  },

  async updateReview(req, res) {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const updated = await ReviewModel.updateById(id, { rating, comment });
    if (!updated) {
      return sendError(res, { statusCode: 404, message: 'Review not found' });
    }
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Review updated successfully',
      data: updated,
    });
  },

  async deleteReview(req, res) {
    const { id } = req.params;
    const deleted = await ReviewModel.delete(id, req.user.id, true);
    if (!deleted) {
      return sendError(res, { statusCode: 404, message: 'Review not found' });
    }
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Review deleted successfully',
    });
  },

  async getSettings(_req, res) {
    const settings = await SettingModel.getAll();
    return sendSuccess(res, {
      message: 'Store settings retrieved successfully',
      data: settings,
    });
  },

  async updateSettings(req, res) {
    const updated = await SettingModel.updateMany(req.body || {});
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Store & delivery settings updated successfully',
      data: updated,
    });
  },
};

module.exports = AdminController;
