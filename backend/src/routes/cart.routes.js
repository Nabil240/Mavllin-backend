const express = require('express');
const { body, param } = require('express-validator');
const CartController = require('../controllers/cart.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/cart
router.get('/', asyncHandler(CartController.getCart));

const addItemValidators = [
  body('variant_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('variant_id must be a positive integer'),
  body('product_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('product_id must be a positive integer'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body().custom((val) => {
    if (!val.variant_id && !val.variantId && !val.product_id && !val.productId) {
      throw new Error('Either variant_id or product_id is required');
    }
    return true;
  }),
  validateRequest,
];

// POST /api/v1/cart & POST /api/v1/cart/items
router.post('/', addItemValidators, asyncHandler(CartController.addItem));
router.post('/items', addItemValidators, asyncHandler(CartController.addItem));

// POST /api/v1/cart/merge
router.post(
  '/merge',
  [
    body('items').isArray().withMessage('items array is required'),
    validateRequest,
  ],
  asyncHandler(CartController.mergeCart)
);

const updateValidators = [
  param('id').isInt().withMessage('ID must be an integer'),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be an integer (0 to remove)'),
  validateRequest,
];

// PUT/PATCH /api/v1/cart/:id & /api/v1/cart/items/:id
router.put('/items/:id', updateValidators, asyncHandler(CartController.updateItemQuantity));
router.patch('/items/:id', updateValidators, asyncHandler(CartController.updateItemQuantity));
router.put('/:id', updateValidators, asyncHandler(CartController.updateItemQuantity));
router.patch('/:id', updateValidators, asyncHandler(CartController.updateItemQuantity));

// DELETE /api/v1/cart/items/:id & DELETE /api/v1/cart/:id
router.delete(
  '/items/:id',
  [param('id').isInt().withMessage('ID must be an integer'), validateRequest],
  asyncHandler(CartController.removeItem)
);
router.delete(
  '/:id',
  [param('id').isInt().withMessage('ID must be an integer'), validateRequest],
  asyncHandler(CartController.removeItem)
);

// DELETE /api/v1/cart
router.delete('/', asyncHandler(CartController.clearCart));

module.exports = router;
