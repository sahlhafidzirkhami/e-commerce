import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

// TODO(auth): wajib cek role ADMIN/OWNER sebelum merender /admin — dibuat bersama modul auth.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-4 py-3">
        <span className="font-semibold">Admin Panel</span>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
