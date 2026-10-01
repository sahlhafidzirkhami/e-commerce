import path from 'node:path';
import type { NextConfig } from 'next';

// .env ada di root monorepo; Next hanya membaca .env di apps/web.
try {
  process.loadEnvFile(path.resolve(process.cwd(), '../../.env'));
} catch {
  // Tidak ada .env (mis. production): variabel diambil dari environment server.
}

const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
const api = new URL(apiUrl);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Hanya berlaku di `next dev`: izinkan perangkat lain di jaringan lokal (mis. 192.168.x.x)
  // membuka dev server. Production tidak terpengaruh.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
  images: {
    formats: ['image/webp'],
    // Foto produk disajikan API di /uploads (driver storage lokal).
    remotePatterns: [
      {
        protocol: api.protocol === 'https:' ? 'https' : 'http',
        hostname: api.hostname,
        ...(api.port && { port: api.port }),
        pathname: '/uploads/**',
      },
    ],
    // Development memakai API di localhost; Next 16 memblokir optimasi gambar dari IP lokal.
    // Production memakai host publik (object storage/CDN), jadi tetap diblokir di sana.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
  },
  // Browser memanggil /api di domain web; Next meneruskannya ke Express.
  // Cookie sesi jadi first-party (SameSite=Lax) tanpa pengaturan CORS lintas domain.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
