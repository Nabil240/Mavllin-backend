const CartModel = require('../models/cart.model');
const ProductModel = require('../models/product.model');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const CartController = {
  async getCart(req, res) {
    const items = await CartModel.getItemsByUserId(req.user.id);

    const subtotal = items.reduce((acc, item) => acc + Number(item.line_total), 0);
    const totalItems = items.reduce((acc, item) => acc + Number(item.quantity), 0);

    return sendSuccess(res, {
      message: 'Cart retrieved successfully',
      data: {
        items,
        summary: {
          subtotal: parseFloat(subtotal.toFixed(2)),
          total_items: totalItems,
          item_count: items.length,
        },
      },
    });
  },

  async addItem(req, res) {
    const rawVariantId = req.body.variant_id || req.body.variantId || null;
    const rawProductId = req.body.product_id || req.body.productId || null;
    const requestedQty = Math.max(1, parseInt(req.body.quantity, 10) || 1);

    let variant = null;
    let product = null;

    if (rawVariantId) {
      variant = await ProductModel.findVariantById(Number(rawVariantId));
      if (!variant) {
        return sendError(res, { statusCode: 404, message: 'Product variant not found' });
      }
      product = await ProductModel.findById(variant.product_id);
      if (!product) {
        return sendError(res, { statusCode: 404, message: 'Product not found' });
      }
    } else if (rawProductId) {
      product = await ProductModel.findById(Number(rawProductId));
      if (!product) {
        return sendError(res, { statusCode: 404, message: 'Product not found' });
      }
      variant = await CartModel.getFirstActiveVariant(product.id);
      if (!variant) {
        return sendError(res, { statusCode: 400, message: 'No active variant available for this product' });
      }
    } else {
      return sendError(res, { statusCode: 422, message: 'Either variant_id or product_id is required' });
    }

    if (!product.is_active || !variant.is_active) {
      return sendError(res, { statusCode: 400, message: 'This product or variant is no longer available' });
    }

    const existing = await CartModel.findItem(req.user.id, product.id, variant.id);
    const newQty = (existing ? Number(existing.quantity) : 0) + requestedQty;

    if (newQty > Number(variant.stock_quantity)) {
      return sendError(res, {
        statusCode: 400,
        message: `Only ${variant.stock_quantity} item(s) available in stock`,
      });
    }

    await CartModel.addItem(req.user.id, product.id, variant.id, requestedQty);
    return CartController.getCart(req, res);
  },

  async updateItemQuantity(req, res) {
    const identifier = Number(req.params.id || req.params.productId);
    const { quantity } = req.body;
    const newQty = parseInt(quantity, 10);

    const existingItem = await CartModel.findItemByIdentifier(req.user.id, identifier);

    if (newQty <= 0) {
      if (existingItem) {
        await CartModel.updateQuantityById(existingItem.id, req.user.id, 0);
      }
      return CartController.getCart(req, res);
    }

    if (!existingItem) {
      return sendError(res, { statusCode: 404, message: 'Cart item not found' });
    }

    if (newQty > Number(existingItem.variant_stock)) {
      return sendError(res, {
        statusCode: 400,
        message: `Only ${existingItem.variant_stock} item(s) available in stock`,
      });
    }

    await CartModel.updateQuantityById(existingItem.id, req.user.id, newQty);
    return CartController.getCart(req, res);
  },

  async removeItem(req, res) {
    const identifier = Number(req.params.id || req.params.productId);
    await CartModel.removeItemByIdentifier(req.user.id, identifier);
    return CartController.getCart(req, res);
  },

  async mergeCart(req, res) {
    const guestItems = Array.isArray(req.body.items) ? req.body.items : [];

    for (const entry of guestItems) {
      if (!entry) continue;
      const rawVariantId = entry.variant_id || entry.variantId || null;
      const rawProductId = entry.product_id || entry.productId || null;
      const requestedQty = Math.max(1, parseInt(entry.quantity, 10) || 1);

      let variant = null;
      let product = null;

      if (rawVariantId) {
        variant = await ProductModel.findVariantById(Number(rawVariantId));
        if (variant) {
          product = await ProductModel.findById(variant.product_id);
        }
      } else if (rawProductId) {
        product = await ProductModel.findById(Number(rawProductId));
        if (product) {
          variant = await CartModel.getFirstActiveVariant(product.id);
        }
      }

      if (!product || !variant || !product.is_active || !variant.is_active) {
        continue;
      }

      const maxStock = Number(variant.stock_quantity) || 0;
      if (maxStock <= 0) continue;

      const existing = await CartModel.findItem(req.user.id, product.id, variant.id);
      const mergedQty = Math.min((existing ? Number(existing.quantity) : 0) + requestedQty, maxStock);

      if (mergedQty > 0) {
        await CartModel.setItemQuantity(req.user.id, product.id, variant.id, mergedQty);
      }
    }

    return CartController.getCart(req, res);
  },

  async clearCart(req, res) {
    await CartModel.clearCart(req.user.id);
    return sendSuccess(res, {
      message: 'Cart cleared successfully',
      data: {
        items: [],
        summary: { subtotal: 0, total_items: 0, item_count: 0 },
      },
    });
  },
};

module.exports = CartController;
