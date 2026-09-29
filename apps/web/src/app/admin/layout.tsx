import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Admin' },
  robots: { index: false, follow: false },
};

/** Layout bersama /admin/masuk dan panel. Pengecekan role ada di (panel)/layout.tsx. */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-neutral-50">{children}</div>;
}
