import type { ApiError } from '@sportswear/shared';

/** Error dari API dengan kode dan pesan yang aman ditampilkan ke pembeli. */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

/** Panggilan API dari browser lewat rewrite /api (cookie first-party ikut terkirim). */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      cache: 'no-store',
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    });
  } catch {
    throw new ApiClientError(0, 'NETWORK', 'Koneksi terputus. Periksa internet lalu coba lagi.');
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as ApiError | null)?.error;
    throw new ApiClientError(
      res.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Terjadi kesalahan. Coba lagi.',
    );
  }
  return (body as { data: T }).data;
}

export function errorMessage(err: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  return err instanceof ApiClientError ? err.message : fallback;
}
