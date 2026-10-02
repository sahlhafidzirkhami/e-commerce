'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Hanya halaman yang sudah ada; menu baru ditambah saat halamannya dibuat. */
const LINKS = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/pesanan', label: 'Pesanan', exact: false },
  { href: '/admin/produk', label: 'Produk', exact: false },
  { href: '/admin/kategori', label: 'Kategori', exact: false },
  { href: '/admin/voucher', label: 'Voucher', exact: false },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu admin" className="mx-auto max-w-7xl overflow-x-auto px-2 md:px-4">
      <ul className="flex gap-1">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold whitespace-nowrap ${
                  active ? 'border-action text-ink' : 'border-transparent text-ink-2 hover:text-ink'
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
