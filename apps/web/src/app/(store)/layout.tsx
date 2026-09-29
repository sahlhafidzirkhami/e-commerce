import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/site-header';

/** Layout halaman toko (beranda, katalog, produk, keranjang). */
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
    </>
  );
}
