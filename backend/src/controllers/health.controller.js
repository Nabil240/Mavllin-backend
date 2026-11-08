const db = require('../config/db');

const HealthController = {
  async getHealth(_req, res) {
    const dbHealth = await db.checkDbHealth();
    const isHealthy = dbHealth.isConnected;
    const statusCode = isHealthy ? 200 : 503;

    const response = {
      status: isHealthy ? 'ok' : 'degraded',
      service: 'mavllin-api',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime() * 100) / 100,
      database: isHealthy
        ? { status: 'connected' }
        : { status: 'disconnected', error: dbHealth.error },
    };

    return res.status(statusCode).json(response);
  },
};

module.exports = HealthController;
