import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { initDatabase } from './db/index.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

async function main(): Promise<void> {
  await initDatabase();
  registerRoutes(app, null);

  app.use(errorHandler);

  app.listen(env.port, () => {
    console.info(`Helpdesk API listening on port ${env.port} (PostgreSQL)`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
