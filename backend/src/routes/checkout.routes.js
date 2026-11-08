const express = require('express');
const { body } = require('express-validator');
const OrderController = require('../controllers/order.controller');
const { optionalAuthenticate } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const checkoutOrderValidators = [
  body('shipping_address').isObject().withMessage('Valid shipping address object is required'),
  body('shipping_address.recipient_name').trim().notEmpty().withMessage('Recipient name is required'),
  body('shipping_address.phone').trim().notEmpty().withMessage('Recipient phone is required'),
  body('shipping_address.street_address').trim().notEmpty().withMessage('Street address is required'),
  body('shipping_address.city').trim().notEmpty().withMessage('City is required'),
  body('shipping_address.postal_code').trim().notEmpty().withMessage('Postal code is required'),
  body('payment_method')
    .optional({ values: 'falsy' })
    .customSanitizer((val) => (typeof val === 'string' ? val.trim().toLowerCase().replace(/[\s-]+/g, '_') : val))
    .isIn(['cash_on_delivery', 'cod', 'manual', 'manual_payment', 'stripe', 'sslcommerz', 'bkash', 'nagad', 'nogod', 'rocket', 'upay', 'upai', 'paypal'])
    .withMessage('Supported payment methods: cash_on_delivery, manual, bkash, nagad, rocket, upay'),
  body('payment_provider')
    .optional({ values: 'falsy' })
    .customSanitizer((val) => (typeof val === 'string' ? val.trim().toLowerCase().replace(/[\s-]+/g, '_') : val))
    .isIn(['cash_on_delivery', 'cod', 'manual', 'manual_payment', 'stripe', 'sslcommerz', 'bkash', 'nagad', 'nogod', 'rocket', 'upay', 'upai', 'paypal'])
    .withMessage('Supported payment providers: cod, manual, bkash, nagad, rocket, upay'),
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
  body('items')
    .optional()
    .isArray()
    .withMessage('items must be an array of order items'),
  body('items.*.variant_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('variant_id must be a positive integer'),
  body('items.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('quantity must be at least 1'),
  validateRequest,
];

// Handles POST /orders and alias POST / (for /api/v1/checkout/orders and /api/v1/checkout)
router.post('/orders', optionalAuthenticate, checkoutOrderValidators, asyncHandler(OrderController.checkoutOrder));
router.post('/', optionalAuthenticate, checkoutOrderValidators, asyncHandler(OrderController.checkoutOrder));

module.exports = router;
