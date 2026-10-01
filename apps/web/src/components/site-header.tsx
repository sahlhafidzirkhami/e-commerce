import Link from 'next/link';
import { CartButton } from '@/components/cart/cart-button';
import { SITE_NAME } from '@/lib/site';
import { HeaderAccount } from './header-account';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 md:h-16 md:px-6 lg:px-8">
        {/* Wordmark teks sampai file logo tersedia (DESIGN.md: Header). */}
        <Link
          href="/"
          className="mr-auto inline-flex min-h-11 shrink-0 items-center font-display text-lg font-bold tracking-tight"
        >
          {SITE_NAME}
        </Link>
        <nav aria-label="Utama">
          <Link
            href="/produk"
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold hover:bg-muted"
          >
            Produk
          </Link>
        </nav>
        <CartButton />
        <HeaderAccount />
      </div>
    </header>
  );
}
