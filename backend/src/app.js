const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const apiRoutes = require('./routes');
const checkoutRoutes = require('./routes/checkout.routes');
const deliveryRoutes = require('./routes/delivery.routes');
const healthRoutes = require('./routes/health.routes');
const { apiLimiter } = require('./middlewares/rateLimit.middleware');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');

const app = express();

// Trust reverse proxy (Podman, Docker, Nginx, Load Balancers)
app.set('trust proxy', 1);

// Security Headers via Helmet
// crossOriginResourcePolicy is configured to cross-origin so Angular (port 4200) can load static assets
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Cross-Origin Resource Sharing
const allowedOrigins = Array.from(
  new Set([env.clientUrl, 'http://localhost:4200', 'http://127.0.0.1:4200'].filter(Boolean))
);
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Body Parsers with size limits to prevent memory exhaustion attacks
app.use(
  express.json({
    limit: '100kb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Static folder for product & avatar uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Unthrottled Root Health Check (for Docker/K8s/Load Balancers)
app.use('/health', healthRoutes);

// Apply Global Rate Limiting to all versioned API routes
app.use('/api/v1', apiLimiter);

// Dedicated Checkout & Versioned REST API Routes
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/delivery-charges', deliveryRoutes);
app.use('/api/v1', apiRoutes);

// 404 Not Found & Centralized Global Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
