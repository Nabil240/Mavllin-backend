const express = require('express');
const OrderController = require('../controllers/order.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/v1/delivery-charges
router.get('/', asyncHandler(OrderController.getDeliveryCharges));

module.exports = router;
