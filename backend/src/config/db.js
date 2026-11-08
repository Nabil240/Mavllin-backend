const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function checkDbHealth() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query('SELECT 1 AS health');
    return { isConnected: true };
  } catch (error) {
    return { isConnected: false, error: error.message };
  } finally {
    if (connection) connection.release();
  }
}

async function testDbConnection() {
  const result = await checkDbHealth();
  if (result.isConnected) {
    console.log(`[MySQL] Connected to database "${env.db.database}" at ${env.db.host}:${env.db.port}`);
  } else {
    console.warn(`[MySQL] Could not connect yet (${result.error}). Check your .env settings.`);
  }
}

module.exports = { pool, testDbConnection, checkDbHealth };
