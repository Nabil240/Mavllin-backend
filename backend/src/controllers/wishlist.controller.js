const WishlistModel = require('../models/wishlist.model');
const ProductModel = require('../models/product.model');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const WishlistController = {
  async getWishlist(req, res) {
    const items = await WishlistModel.getItems(req.user.id);
    return sendSuccess(res, {
      message: 'Wishlist retrieved successfully',
      data: items,
    });
  },

  async toggleWishlist(req, res) {
    const { productId } = req.params;

    const product = await ProductModel.findById(productId);
    if (!product) {
      return sendError(res, { statusCode: 404, message: 'Product not found' });
    }

    const result = await WishlistModel.toggleItem(req.user.id, productId);
    const message = result.wishlisted ? 'Product added to wishlist' : 'Product removed from wishlist';

    return sendSuccess(res, {
      statusCode: 200,
      message,
      data: result,
    });
  },

  async removeItem(req, res) {
    const { productId } = req.params;
    await WishlistModel.removeItem(req.user.id, productId);

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Product removed from wishlist',
    });
  },
};

module.exports = WishlistController;
