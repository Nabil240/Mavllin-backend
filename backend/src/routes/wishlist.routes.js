const express = require('express');
const { param } = require('express-validator');
const WishlistController = require('../controllers/wishlist.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/wishlist
router.get('/', asyncHandler(WishlistController.getWishlist));

// POST /api/v1/wishlist/toggle/:productId
router.post(
  '/toggle/:productId',
  [param('productId').isInt().withMessage('Product ID must be an integer'), validateRequest],
  asyncHandler(WishlistController.toggleWishlist)
);

// DELETE /api/v1/wishlist/:productId
router.delete(
  '/:productId',
  [param('productId').isInt().withMessage('Product ID must be an integer'), validateRequest],
  asyncHandler(WishlistController.removeItem)
);

module.exports = router;
