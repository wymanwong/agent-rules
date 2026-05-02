import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { getDb } from './db/index.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

const db = getDb();

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

registerRoutes(app, db);

app.use(errorHandler);

app.listen(env.port, () => {
  console.info(`Helpdesk API listening on port ${env.port}`);
});
