const express = require('express');
const { body, param } = require('express-validator');
const CouponController = require('../controllers/coupon.controller');
const { authenticate, requireRole, optionalAuthenticate } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Validation endpoint (restricted to registered customers unless coupon has universal permission)
router.post(
  '/validate',
  optionalAuthenticate,
  [
    body('code').trim().notEmpty().withMessage('Coupon code is required'),
    body('subtotal').optional().isFloat({ min: 0 }),
    validateRequest,
  ],
  asyncHandler(CouponController.validate)
);

// Admin-only management
router.get('/', authenticate, requireRole('admin'), asyncHandler(CouponController.getAll));
router.get('/analytics', authenticate, requireRole('admin'), asyncHandler(CouponController.getAnalytics));
router.get('/member-usage', authenticate, requireRole('admin'), asyncHandler(CouponController.getMemberUsage));
router.get(
  '/:id/members',
  authenticate,
  requireRole('admin', 'staff'),
  [param('id').isInt().withMessage('Coupon ID must be an integer'), validateRequest],
  asyncHandler(CouponController.getMembers)
);

router.post(
  '/:id/members',
  authenticate,
  requireRole('admin'),
  [
    param('id').isInt().withMessage('Coupon ID must be an integer'),
    body('user_id').optional().isInt({ min: 1 }),
    body('email').optional().isEmail(),
    body('usage_limit').optional().isInt({ min: 1 }),
    validateRequest,
  ],
  asyncHandler(CouponController.addMember)
);

router.put(
  '/:id/members/:userId',
  authenticate,
  requireRole('admin'),
  [
    param('id').isInt().withMessage('Coupon ID must be an integer'),
    param('userId').isInt().withMessage('User ID must be an integer'),
    body('usage_limit').isInt({ min: 1 }).withMessage('usage_limit must be an integer >= 1'),
    validateRequest,
  ],
  asyncHandler(CouponController.updateMemberLimit)
);

router.delete(
  '/:id/members/:userId',
  authenticate,
  requireRole('admin'),
  [
    param('id').isInt().withMessage('Coupon ID must be an integer'),
    param('userId').isInt().withMessage('User ID must be an integer'),
    validateRequest,
  ],
  asyncHandler(CouponController.removeMember)
);

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
