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

/**
 * Panggilan API dari browser lewat rewrite /api (cookie first-party ikut terkirim).
 * Body string dianggap JSON; body File/Blob dikirim apa adanya dengan tipe file-nya.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const requestBody = init?.body;
  const contentType =
    requestBody instanceof Blob
      ? requestBody.type
      : typeof requestBody === 'string'
        ? 'application/json'
        : undefined;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      cache: 'no-store',
      headers: contentType ? { 'content-type': contentType } : undefined,
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
