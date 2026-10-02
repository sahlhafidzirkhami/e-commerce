'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton({ redirectTo = '/masuk' }: { redirectTo?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold hover:bg-muted disabled:opacity-40"
    >
      {pending ? 'Keluar...' : 'Keluar'}
    </button>
  );
}
