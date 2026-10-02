import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Tiap worker memuat Prisma Client; default (jumlah core - 1) membuat worker crash acak
    // saat RAM laptop tersisa sedikit. 4 worker cukup cepat untuk jumlah test saat ini.
    maxWorkers: 4,
    // Nilai dummy agar env.ts lolos validasi; test di-mock, kecuali *.db.test.ts (TEST_DATABASE_URL).
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_SECRET: 'test-secret-yang-panjangnya-lebih-dari-32-karakter',
      WEB_URL: 'http://localhost:3000',
      API_URL: 'http://localhost:4000',
    },
  },
});
