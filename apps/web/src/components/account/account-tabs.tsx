'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/akun', label: 'Pesanan' },
  { href: '/akun/alamat', label: 'Alamat' },
  { href: '/akun/profil', label: 'Profil' },
] as const;

export function AccountTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu akun" className="mt-4 border-b border-line">
      <ul className="-mb-px flex gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold ${
                  active ? 'border-action text-ink' : 'border-transparent text-ink-2 hover:text-ink'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
