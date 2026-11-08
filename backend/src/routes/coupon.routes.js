const express = require('express');
const { body, param } = require('express-validator');
const CouponController = require('../controllers/coupon.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Validation endpoint (available to customers)
router.post(
  '/validate',
  [
    body('code').trim().notEmpty().withMessage('Coupon code is required'),
    body('subtotal').optional().isFloat({ min: 0 }),
    validateRequest,
  ],
  asyncHandler(CouponController.validate)
);

// Admin-only management
router.get('/', authenticate, requireRole('admin'), asyncHandler(CouponController.getAll));
router.get(
  '/:id',
  authenticate,
  requireRole('admin'),
  [param('id').isInt().withMessage('Coupon ID must be an integer'), validateRequest],
  asyncHandler(CouponController.getOne)
);

router.post(
  '/',
  authenticate,
  requireRole('admin'),
  [
    body('code').trim().notEmpty().withMessage('Coupon code is required'),
    body('discount_type').isIn(['percentage', 'fixed']).withMessage('discount_type must be percentage or fixed'),
    body('discount_value').isFloat({ min: 0.01 }).withMessage('discount_value must be greater than 0'),
    body('min_order_amount').optional().isFloat({ min: 0 }),
    body('usage_limit').optional({ nullable: true }).isInt({ min: 1 }),
    validateRequest,
  ],
  asyncHandler(CouponController.create)
);

router.put(
  '/:id',
  authenticate,
  requireRole('admin'),
  [
    param('id').isInt().withMessage('Coupon ID must be an integer'),
    body('discount_type').optional().isIn(['percentage', 'fixed']),
    body('discount_value').optional().isFloat({ min: 0.01 }),
    validateRequest,
  ],
  asyncHandler(CouponController.update)
);

router.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  [param('id').isInt().withMessage('Coupon ID must be an integer'), validateRequest],
  asyncHandler(CouponController.delete)
);

module.exports = router;
