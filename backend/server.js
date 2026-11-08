const app = require('./src/app');
const env = require('./src/config/env');
const { testDbConnection } = require('./src/config/db');

async function startServer() {
  await testDbConnection();

  app.listen(env.port, () => {
    console.log(`[API] Server running in ${env.nodeEnv} mode on http://localhost:${env.port}`);
  });
}

startServer();
