import express from 'express';
import { logger } from './utils/logger';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use((req, res) => {
    logger.warn({ path: req.path }, 'Route not found');
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
