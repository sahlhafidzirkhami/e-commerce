import type { ApiError, CartView } from '@sportswear/shared';

/** Panggilan keranjang dari browser lewat rewrite /api, agar cookie first-party ikut terkirim. */
export class CartRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CartRequestError';
  }
}

async function cartRequest(path: string, init?: RequestInit): Promise<CartView> {
  let res: Response;
  try {
    res = await fetch(`/api/cart${path}`, {
      ...init,
      cache: 'no-store',
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    });
  } catch {
    throw new CartRequestError('NETWORK', 'Koneksi terputus. Periksa internet lalu coba lagi.');
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as ApiError | null)?.error;
    throw new CartRequestError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Keranjang gagal diperbarui. Coba lagi.',
    );
  }
  return (body as { data: { cart: CartView } }).data.cart;
}

export const cartApi = {
  get: () => cartRequest(''),
  add: (variantId: string, quantity: number) =>
    cartRequest('/items', { method: 'POST', body: JSON.stringify({ variantId, quantity }) }),
  update: (variantId: string, quantity: number) =>
    cartRequest(`/items/${encodeURIComponent(variantId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    }),
  remove: (variantId: string) =>
    cartRequest(`/items/${encodeURIComponent(variantId)}`, { method: 'DELETE' }),
};
