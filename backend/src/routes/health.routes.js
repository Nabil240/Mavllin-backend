const express = require('express');
const HealthController = require('../controllers/health.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', asyncHandler(HealthController.getHealth));

module.exports = router;
