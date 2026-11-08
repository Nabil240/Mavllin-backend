const express = require('express');
const { param, body } = require('express-validator');
const AdminController = require('../controllers/admin.controller');
const OrderController = require('../controllers/order.controller');
const ProductController = require('../controllers/product.controller');
const CategoryController = require('../controllers/category.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const { validateRequest } = require('../middlewares/validate.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

// GET /api/v1/admin/dashboard
router.get('/dashboard', asyncHandler(AdminController.getDashboard));

// Inventory Management
router.get('/inventory', asyncHandler(AdminController.getInventory));
router.get('/inventory/movements', asyncHandler(AdminController.getInventoryMovements));

const inventoryAdjustmentValidation = [
  body('variant_id').optional().isInt({ min: 1 }),
  body('quantity_delta').optional().isInt(),
  body('note').trim().notEmpty().withMessage('Adjustment note is required'),
  validateRequest,
];

router.post('/inventory/adjust', inventoryAdjustmentValidation, asyncHandler(AdminController.adjustInventory));
router.post('/inventory/adjustments', inventoryAdjustmentValidation, asyncHandler(AdminController.adjustInventory));

// Payments & Reports
router.get('/payments', asyncHandler(AdminController.getPayments));
router.get('/reports/sales', asyncHandler(AdminController.getSalesReport));

// Admin Orders Full CRUD & Status Management
router.get('/orders', asyncHandler(OrderController.getAllAdmin));
router.delete(
  '/orders/:id',
  [param('id').isInt().withMessage('Order ID must be an integer'), validateRequest],
  asyncHandler(AdminController.deleteOrder)
);
router.put(
  '/orders/:id/status',
  [
    param('id').isInt().withMessage('Order ID must be an integer'),
    body('status')
      .isString()
      .trim()
      .toLowerCase()
      .isIn(['pending', 'confirmed', 'processing', 'dispatch', 'dispatched', 'shipped', 'delivered', 'cancelled']),
    validateRequest,
  ],
  asyncHandler(OrderController.updateStatus)
);
router.patch(
  '/orders/:id/status',
  [
    param('id').isInt().withMessage('Order ID must be an integer'),
    body('status')
      .isString()
      .trim()
      .toLowerCase()
      .isIn(['pending', 'confirmed', 'processing', 'dispatch', 'dispatched', 'shipped', 'delivered', 'cancelled']),
    validateRequest,
  ],
  asyncHandler(OrderController.updateStatus)
);

const paymentStatusValidators = [
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
    ])
    .withMessage('payment_status must be one of: unpaid, paid, done, payment successful, failed, refunded'),
  validateRequest,
];

router.put(
  '/orders/:id/payment-status',
  paymentStatusValidators,
  asyncHandler(OrderController.updatePaymentStatus)
);
router.patch(
  '/orders/:id/payment-status',
  paymentStatusValidators,
  asyncHandler(OrderController.updatePaymentStatus)
);

router.put('/orders/:id/verify-payment', asyncHandler(OrderController.verifyPayment));
router.patch('/orders/:id/verify-payment', asyncHandler(OrderController.verifyPayment));
router.put('/orders/:id/verify-transaction', asyncHandler(OrderController.verifyPayment));
router.patch('/orders/:id/verify-transaction', asyncHandler(OrderController.verifyPayment));

// Store & Delivery Settings Management
router.get('/settings', asyncHandler(AdminController.getSettings));
router.put('/settings', asyncHandler(AdminController.updateSettings));
router.get('/delivery-settings', asyncHandler(AdminController.getSettings));
router.put('/delivery-settings', asyncHandler(AdminController.updateSettings));

router.get('/products', (req, res, next) => {
  if (req.query.isActive === undefined) {
    req.query.isActive = '1';
  }
  return asyncHandler(ProductController.getAll)(req, res, next);
});
router.get('/categories', asyncHandler(CategoryController.getAll));

// GET /api/v1/admin/customers
router.get('/customers', asyncHandler(AdminController.getCustomers));

// PUT /api/v1/admin/customers/:id/status
router.put(
  '/customers/:id/status',
  [
    param('id').isInt().withMessage('User ID must be an integer'),
    body('is_active').isInt({ min: 0, max: 1 }).withMessage('is_active must be 0 or 1'),
    validateRequest,
  ],
  asyncHandler(AdminController.toggleCustomerStatus)
);

// Admin Messaging Routes (Unified Omnichannel Inbox)
const MessagingController = require('../controllers/messaging.controller');

router.get('/messaging/conversations', asyncHandler(MessagingController.getConversations));
router.get('/messages/conversations', asyncHandler(MessagingController.getConversations));
router.get(
  '/messaging/conversations/:id/messages',
  [param('id').isInt().withMessage('Conversation ID must be an integer'), validateRequest],
  asyncHandler(MessagingController.getMessages)
);
router.get(
  '/messages/conversations/:id/messages',
  [param('id').isInt().withMessage('Conversation ID must be an integer'), validateRequest],
  asyncHandler(MessagingController.getMessages)
);
router.post(
  '/messaging/conversations/:id/reply',
  [
    param('id').isInt().withMessage('Conversation ID must be an integer'),
    body('content').optional().trim(),
    body('message').optional().trim(),
    validateRequest,
  ],
  asyncHandler(MessagingController.replyConversation)
);
router.patch(
  '/messaging/conversations/:id/toggle-ai',
  [param('id').isInt().withMessage('Conversation ID must be an integer'), validateRequest],
  asyncHandler(MessagingController.toggleAi)
);
router.patch(
  '/messaging/conversations/:id/read',
  [param('id').isInt().withMessage('Conversation ID must be an integer'), validateRequest],
  asyncHandler(MessagingController.markAsRead)
);

module.exports = router;
