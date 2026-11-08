const express = require('express');
const MessagingController = require('../controllers/messaging.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Public Webhook Endpoints
router.get('/webhook/:channel', asyncHandler(MessagingController.verifyWebhook));
router.post(
  '/webhook/:channel',
  MessagingController.validateWebhookSignatureMiddleware,
  asyncHandler(MessagingController.handleInboundWebhook)
);

module.exports = router;
