const express = require('express');
const { body, param } = require('express-validator');
const ReviewController = require('../controllers/review.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/v1/reviews/product/:productId
router.get(
  '/product/:productId',
  [param('productId').isInt().withMessage('Product ID must be an integer'), validateRequest],
  asyncHandler(ReviewController.getProductReviews)
);

// Protected routes
router.post(
  '/',
  authenticate,
  [
    body('product_id').isInt().withMessage('Valid product ID is required'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').optional({ nullable: true }).trim(),
    validateRequest,
  ],
  asyncHandler(ReviewController.addOrUpdateReview)
);

router.delete(
  '/:id',
  authenticate,
  [param('id').isInt().withMessage('Review ID must be an integer'), validateRequest],
  asyncHandler(ReviewController.deleteReview)
);

module.exports = router;
