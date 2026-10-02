import { isAdminRole } from '@sportswear/shared';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin/admin-nav';
import { LogoutButton } from '@/components/logout-button';
import { getCurrentUser } from '@/lib/auth';
import { SITE_NAME } from '@/lib/site';

/**
 * Pengaman tampilan panel admin. Perlindungan data tetap di API (requireAdmin) —
 * layout ini hanya mencegah non-admin melihat panel.
 */
export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/masuk');
  if (!isAdminRole(user.role)) redirect('/admin/masuk?akses=ditolak');

  return (
    <div className="min-h-dvh bg-page font-sans text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:px-6">
          <span className="mr-auto font-display font-bold">
            {SITE_NAME} <span className="font-sans text-sm font-semibold text-ink-2">Admin</span>
          </span>
          <span className="hidden text-sm text-ink-2 sm:inline">
            {user.name} · {user.role}
          </span>
          <LogoutButton redirectTo="/admin/masuk" />
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">{children}</main>
    </div>
  );
}
