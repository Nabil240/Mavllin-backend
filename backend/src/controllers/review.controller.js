const ReviewModel = require('../models/review.model');
const ProductModel = require('../models/product.model');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { paginate } = require('../utils/helpers');

const ReviewController = {
  async getProductReviews(req, res) {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const total = await ReviewModel.countByProduct(productId);
    const pagination = paginate({ page, limit, total });

    const reviews = await ReviewModel.findByProduct(productId, {
      offset: pagination.offset,
      limit: pagination.limit,
    });

    const summary = await ReviewModel.getRatingSummary(productId);

    return sendSuccess(res, {
      message: 'Product reviews retrieved',
      data: {
        reviews,
        summary: {
          average_rating: Number(summary.average_rating).toFixed(1),
          total_reviews: summary.total_reviews,
          breakdown: {
            5: Number(summary.five_star || 0),
            4: Number(summary.four_star || 0),
            3: Number(summary.three_star || 0),
            2: Number(summary.two_star || 0),
            1: Number(summary.one_star || 0),
          },
        },
      },
      meta: pagination,
    });
  },

  async addOrUpdateReview(req, res) {
    const { product_id, rating, comment } = req.body;

    const product = await ProductModel.findById(product_id);
    if (!product) {
      return sendError(res, { statusCode: 404, message: 'Product not found' });
    }

    const review = await ReviewModel.createOrUpdate({
      productId: product_id,
      userId: req.user.id,
      rating: Number(rating),
      comment: comment ? comment.trim() : null,
    });

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Review submitted successfully',
      data: review,
    });
  },

  async deleteReview(req, res) {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';

    const success = await ReviewModel.delete(id, req.user.id, isAdmin);
    if (!success) {
      return sendError(res, { statusCode: 404, message: 'Review not found or not authorized' });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Review deleted successfully',
    });
  },
};

module.exports = ReviewController;
