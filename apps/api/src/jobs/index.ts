import { Queue, Worker } from 'bullmq';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import { sendOrderEmail } from '../modules/email/order-email.service.js';
import { completeDeliveredOrders } from './complete-order.js';
import { EMAIL_QUEUE, type OrderEmailJob } from './email-queue.js';
import { expireOverdueOrders } from './expire-order.js';

const EXPIRE_ORDER_QUEUE = 'expire-order';
/** Order dicek tiap menit; batas bayar 3 jam, jadi keterlambatan maksimal ~1 menit. */
const EXPIRE_ORDER_EVERY_MS = 60_000;
const COMPLETE_ORDER_QUEUE = 'complete-order';
/** Batasnya 3 hari; selisih hingga 1 jam tidak berarti bagi pembeli. */
const COMPLETE_ORDER_EVERY_MS = 60 * 60_000;

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

  const completeQueue = new Queue(COMPLETE_ORDER_QUEUE, { connection: redis.duplicate() });
  await completeQueue.upsertJobScheduler(
    'complete-order-every-hour',
    { every: COMPLETE_ORDER_EVERY_MS },
    { name: 'complete-order', opts: { removeOnComplete: 50, removeOnFail: 200 } },
  );
  const completeWorker = new Worker(COMPLETE_ORDER_QUEUE, async () => completeDeliveredOrders(), {
    connection: redis.duplicate(),
    concurrency: 1,
  });
  completeWorker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'Job complete-order gagal');
  });

  const emailWorker = new Worker<OrderEmailJob>(
    EMAIL_QUEUE,
    async (job) => sendOrderEmail(job.data.kind, job.data.orderId),
    { connection: redis.duplicate(), concurrency: 2 },
  );
  emailWorker.on('failed', (job, err) => {
    logger.error(
      { err, jobId: job?.id, attempt: job?.attemptsMade },
      'Email order gagal dikirim (dicoba ulang otomatis)',
    );
  });

  logger.info('Job berjalan: expire-order (tiap 1 menit), complete-order (tiap 1 jam), email');
  return {
    close: async () => {
      await Promise.all([worker.close(), completeWorker.close(), emailWorker.close()]);
      await Promise.all([queue.close(), completeQueue.close()]);
    },
  };
}
