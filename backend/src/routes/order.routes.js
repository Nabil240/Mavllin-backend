const express = require('express');
const { body, param } = require('express-validator');
const OrderController = require('../controllers/order.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const shippingAddressValidation = [
  body('shipping_address').isObject().withMessage('Valid shipping address is required'),
  body('shipping_address.recipient_name').trim().notEmpty().withMessage('Recipient name is required'),
  body('shipping_address.phone').trim().notEmpty().withMessage('Recipient phone is required'),
  body('shipping_address.street_address').trim().notEmpty().withMessage('Street address is required'),
  body('shipping_address.city').trim().notEmpty().withMessage('City is required'),
  body('shipping_address.postal_code').trim().notEmpty().withMessage('Postal code is required'),
  body('payment_provider')
    .optional({ values: 'falsy' })
    .customSanitizer((val) => (typeof val === 'string' ? val.trim().toLowerCase().replace(/[\s-]+/g, '_') : val))
    .isIn(['cod', 'cash_on_delivery', 'manual', 'manual_payment', 'bkash', 'nagad', 'nogod', 'rocket', 'upay', 'upai', 'stripe', 'sslcommerz', 'paypal'])
    .withMessage('Supported payment providers: cod, manual, bkash, nagad, rocket, upay'),
  body('payment_method')
    .optional({ values: 'falsy' })
    .customSanitizer((val) => (typeof val === 'string' ? val.trim().toLowerCase().replace(/[\s-]+/g, '_') : val))
    .isIn(['cash_on_delivery', 'cod', 'manual', 'manual_payment', 'bkash', 'nagad', 'nogod', 'rocket', 'upay', 'upai', 'stripe', 'sslcommerz', 'paypal'])
    .withMessage('Supported payment methods: cash_on_delivery, manual, bkash, nagad, rocket, upay'),
  body('transaction_id')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Transaction ID must be a string')
    .trim()
    .isLength({ max: 120 })
    .withMessage('Transaction ID must not exceed 120 characters'),
  body('sender_phone')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Sender phone must be a string')
    .trim()
    .isLength({ max: 30 })
    .withMessage('Sender phone must not exceed 30 characters'),
];

// Public endpoints (Guest checkout & order tracking)
router.post(
  ['/guest', '/guest-checkout'],
  [
    ...shippingAddressValidation,
    body('items').isArray({ min: 1 }).withMessage('At least one item is required for guest checkout'),
    validateRequest,
  ],
  asyncHandler(OrderController.placeGuestOrder)
);

router.get('/track/:orderNumber', asyncHandler(OrderController.trackOrder));

// Authenticated endpoints
router.use(authenticate);

// GET /api/v1/orders returns customer's own orders (requires authenticate); admins can pass scope=all
router.get(
  '/',
  asyncHandler((req, res, next) => {
    if (req.user && req.user.role === 'admin' && (req.query.scope === 'all' || req.query.all === 'true')) {
      return OrderController.getAllAdmin(req, res, next);
    }
    return OrderController.getMyOrders(req, res, next);
  })
);

router.post(
  '/',
  [...shippingAddressValidation, validateRequest],
  asyncHandler(OrderController.placeOrder)
);

router.get('/my-orders', asyncHandler(OrderController.getMyOrders));
router.get('/my', asyncHandler(OrderController.getMyOrders));

router.post('/:id/cancel', asyncHandler(OrderController.cancelOrder));

// Get order details (customer for own order, or admin)
router.get('/:id', asyncHandler(OrderController.getOne));

const statusUpdateValidators = [
  param('id').isInt().withMessage('Order ID must be an integer'),
  body('status')
    .isString()
    .trim()
    .toLowerCase()
    .isIn(['pending', 'confirmed', 'processing', 'dispatch', 'dispatched', 'shipped', 'delivered', 'cancelled']),
  validateRequest,
];

router.put('/:id/status', requireRole('admin'), statusUpdateValidators, asyncHandler(OrderController.updateStatus));
router.patch('/:id/status', requireRole('admin'), statusUpdateValidators, asyncHandler(OrderController.updateStatus));

router.put(
  '/:id/payment-status',
  requireRole('admin'),
  [
    param('id').isInt().withMessage('Order ID must be an integer'),
    body('payment_status')
      .isString()
      .trim()
      .toLowerCase()
      .isIn([
        'unpaid',
        'paid',
        'done',
        'payment successful',
        'payment_successful',
        'completed',
        'succeeded',
        'failed',
        'refunded',
      ]),
    validateRequest,
  ],
  asyncHandler(OrderController.updatePaymentStatus)
);

router.put('/:id/verify-payment', requireRole('admin'), asyncHandler(OrderController.verifyPayment));
router.patch('/:id/verify-payment', requireRole('admin'), asyncHandler(OrderController.verifyPayment));

module.exports = router;
