import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET minimal 32 karakter'),
  WEB_URL: z.url(),
  API_URL: z.url(),

  // Opsional sampai modulnya dibuat; akan dijadikan wajib saat integrasi.
  DOKU_CLIENT_ID: z.string().optional(),
  DOKU_SECRET_KEY: z.string().optional(),
  DOKU_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  RAJAONGKIR_API_KEY: z.string().optional(),
  RAJAONGKIR_BASE_URL: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  UPLOADS_DIR: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // String kosong di .env dianggap tidak diisi.
  const raw = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ''),
  );
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment variable tidak valid:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
