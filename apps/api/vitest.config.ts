import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Nilai dummy agar env.ts lolos validasi; test tidak menyentuh DB/Redis sungguhan.
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
