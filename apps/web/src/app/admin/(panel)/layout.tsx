import { isAdminRole } from '@sportswear/shared';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { LogoutButton } from '@/components/logout-button';
import { getCurrentUser } from '@/lib/auth';

/**
 * Pengaman tampilan panel admin. Perlindungan data tetap di API (requireAdmin) —
 * layout ini hanya mencegah non-admin melihat panel.
 */
export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/masuk');
  if (!isAdminRole(user.role)) redirect('/admin/masuk?akses=ditolak');

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3">
        <span className="font-semibold">Admin Panel</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-neutral-600 sm:inline">
            {user.name} · {user.role}
          </span>
          <LogoutButton redirectTo="/admin/masuk" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
