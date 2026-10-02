import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeEmailQueue } from './jobs/email-queue.js';
import { startJobs, type RunningJobs } from './jobs/index.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API berjalan di http://localhost:${env.PORT}`);
});

// Job terjadwal ikut berjalan di proses API (RUN_JOBS=false untuk mematikannya, mis. bila
// nanti dipisah ke proses worker sendiri).
let jobs: RunningJobs | null = null;
if (env.RUN_JOBS) {
  startJobs()
    .then((running) => {
      jobs = running;
    })
    .catch((err: unknown) => logger.error({ err }, 'Job terjadwal gagal dijalankan'));
}

async function shutdown(signal: string) {
  logger.info(`${signal} diterima, mematikan server...`);
  server.close();
  await jobs?.close();
  await closeEmailQueue();
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
