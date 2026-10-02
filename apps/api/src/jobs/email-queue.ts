/**
 * Antrean email transaksi. Email di-enqueue SETELAH transaksi database selesai, lalu dikirim
 * worker (jobs/index.ts), agar checkout dan webhook tidak tertahan SMTP yang lambat.
 */
import { Queue } from 'bullmq';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import type { OrderEmailKind } from '../modules/email/order-email.templates.js';

export const EMAIL_QUEUE = 'email';

export interface OrderEmailJob {
  kind: OrderEmailKind;
  orderId: string;
}

let queue: Queue<OrderEmailJob> | null = null;

function getQueue(): Queue<OrderEmailJob> {
  queue ??= new Queue<OrderEmailJob>(EMAIL_QUEUE, { connection: redis.duplicate() });
  return queue;
}

/**
 * jobId tetap per (jenis, order): notifikasi DOKU ganda atau klik ganda admin tidak
 * menghasilkan email ganda. Job selesai disimpan 7 hari agar pengaman ini tetap berlaku.
 * Tidak pernah melempar: gagal enqueue hanya dicatat, transaksi pembeli tetap berhasil.
 */
export async function enqueueOrderEmail(kind: OrderEmailKind, orderId: string): Promise<void> {
  try {
    await getQueue().add(
      kind,
      { kind, orderId },
      {
        jobId: `${kind}-${orderId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 7 * 24 * 3600 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    );
  } catch (err) {
    logger.error({ err, kind, orderId }, 'Email order gagal dimasukkan ke antrean');
  }
}

export async function closeEmailQueue(): Promise<void> {
  await queue?.close();
  queue = null;
}
