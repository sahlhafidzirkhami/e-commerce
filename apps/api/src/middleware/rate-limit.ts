import { ErrorCode, type ApiError } from '@sportswear/shared';
import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { redis } from '../lib/redis.js';

interface LimiterOptions {
  /** Nama unik, dipakai sebagai prefix key Redis. */
  name: string;
  windowMs: number;
  limit: number;
  message: string;
  keyGenerator?: (req: Request) => string;
  /** Hanya hitung request yang gagal (status ≥ 400). */
  countFailedOnly?: boolean;
}

export function clientIp(req: Request): string {
  return ipKeyGenerator(req.ip ?? 'unknown');
}

/**
 * Rate limiter dengan penyimpanan Redis (dibagi antar instance API).
 * Saat test memakai memori agar tidak butuh Redis.
 */
export function createRateLimiter(options: LimiterOptions) {
  const body: ApiError = { error: { code: ErrorCode.RATE_LIMITED, message: options.message } };
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: options.countFailedOnly ?? false,
    keyGenerator: options.keyGenerator ?? clientIp,
    handler: (_req, res) => {
      res.status(429).json(body);
    },
    ...(env.NODE_ENV !== 'test' && {
      store: new RedisStore({
        prefix: `rl:${options.name}:`,
        sendCommand: (command: string, ...args: string[]) =>
          redis.call(command, ...args) as Promise<RedisReply>,
      }),
    }),
  });
}
