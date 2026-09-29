import path from 'node:path';
import type { NextConfig } from 'next';

// .env ada di root monorepo; Next hanya membaca .env di apps/web.
try {
  process.loadEnvFile(path.resolve(process.cwd(), '../../.env'));
} catch {
  // Tidak ada .env (mis. production): variabel diambil dari environment server.
}

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    formats: ['image/webp'],
  },
  // Browser memanggil /api di domain web; Next meneruskannya ke Express.
  // Cookie sesi jadi first-party (SameSite=Lax) tanpa pengaturan CORS lintas domain.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
