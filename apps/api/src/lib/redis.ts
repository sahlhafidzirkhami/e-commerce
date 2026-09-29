import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis(env.REDIS_URL, {
  // Wajib null agar koneksi ini bisa dipakai BullMQ.
  maxRetriesPerRequest: null,
  lazyConnect: true,
});
