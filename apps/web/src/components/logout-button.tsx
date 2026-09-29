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
      className="rounded-lg border border-neutral-300 px-3 py-1.5 font-medium disabled:opacity-60"
    >
      {pending ? 'Keluar…' : 'Keluar'}
    </button>
  );
}
