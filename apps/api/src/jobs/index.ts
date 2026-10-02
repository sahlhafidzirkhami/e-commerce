import { Queue, Worker } from 'bullmq';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { expireOverdueOrders } from './expire-order.js';

const EXPIRE_ORDER_QUEUE = 'expire-order';
/** Order dicek tiap menit; batas bayar 3 jam, jadi keterlambatan maksimal ~1 menit. */
const EXPIRE_ORDER_EVERY_MS = 60_000;

export interface RunningJobs {
  close: () => Promise<void>;
}

/** Menjalankan semua job terjadwal (BullMQ). Aman dijalankan di beberapa instance. */
export async function startJobs(): Promise<RunningJobs> {
  // Worker memakai koneksi blocking; jangan berbagi koneksi dengan perintah biasa.
  const queue = new Queue(EXPIRE_ORDER_QUEUE, { connection: redis.duplicate() });
  await queue.upsertJobScheduler(
    'expire-order-every-minute',
    { every: EXPIRE_ORDER_EVERY_MS },
    { name: 'expire-order', opts: { removeOnComplete: 100, removeOnFail: 500 } },
  );

  const worker = new Worker(EXPIRE_ORDER_QUEUE, async () => expireOverdueOrders(), {
    connection: redis.duplicate(),
    concurrency: 1,
  });
  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Job expire-order gagal');
  });

  logger.info('Job terjadwal berjalan: expire-order (tiap 1 menit)');
  return {
    close: async () => {
      await worker.close();
      await queue.close();
    },
  };
}
