import Link from 'next/link';
import { HeaderAccount } from './header-account';

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight">
          Sportswear Store
        </Link>
        <HeaderAccount />
      </div>
    </header>
  );
}
