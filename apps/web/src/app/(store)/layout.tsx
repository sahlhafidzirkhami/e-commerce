import type { ReactNode } from 'react';
import { CartDrawer } from '@/components/cart/cart-drawer';
import { CartProvider } from '@/components/cart/cart-provider';
import { SiteHeader } from '@/components/site-header';

/** Layout halaman toko (beranda, katalog, produk, keranjang). */
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      {children}
      <CartDrawer />
    </CartProvider>
  );
}
