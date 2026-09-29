import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API berjalan di http://localhost:${env.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} diterima, mematikan server...`);
  server.close();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
