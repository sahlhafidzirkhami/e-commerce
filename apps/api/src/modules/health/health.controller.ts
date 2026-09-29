import type { RequestHandler } from 'express';
import { checkHealth } from './health.service.js';

export const getHealth: RequestHandler = async (_req, res) => {
  const health = await checkHealth();
  res.status(health.status === 'ok' ? 200 : 503).json({ data: health });
};
