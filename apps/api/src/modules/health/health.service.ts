import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

export type ServiceStatus = 'up' | 'down';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: ServiceStatus;
  redis: ServiceStatus;
}

export async function checkHealth(): Promise<HealthStatus> {
  const [database, cache] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(
      () => 'up' as const,
      () => 'down' as const,
    ),
    redis.ping().then(
      () => 'up' as const,
      () => 'down' as const,
    ),
  ]);

  return {
    status: database === 'up' && cache === 'up' ? 'ok' : 'degraded',
    database,
    redis: cache,
  };
}
