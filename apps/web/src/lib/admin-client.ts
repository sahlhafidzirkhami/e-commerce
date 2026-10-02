import type {
  AdminCategory,
  AdminDashboard,
  AdminOrderDetail,
  AdminOrderListResult,
  AdminProductDetail,
  AdminProductListResult,
  AdminVoucher,
  CategoryInput,
  OrderStatus,
  ProductCreateInput,
  ProductUpdateInput,
  VariantCreateInput,
  VariantUpdateInput,
  VoucherInput,
} from '@sportswear/shared';
import { apiFetch } from './api-client';

type ProductResponse = { product: AdminProductDetail };
const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

/** Produk, ukuran, foto, dan kategori (F-19). Semua mengembalikan data terbaru. */
export const adminProductApi = {
  list: (params: {
    q?: string;
    categoryId?: string;
    status?: 'active' | 'inactive';
    page: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.categoryId) qs.set('categoryId', params.categoryId);
    if (params.status) qs.set('status', params.status);
    if (params.page > 1) qs.set('page', String(params.page));
    const query = qs.toString();
    return apiFetch<AdminProductListResult>(`/admin/products${query ? `?${query}` : ''}`);
  },
  get: (id: string) => apiFetch<ProductResponse>(`/admin/products/${id}`).then((d) => d.product),
  create: (input: ProductCreateInput) =>
    apiFetch<ProductResponse>('/admin/products', json('POST', input)).then((d) => d.product),
  update: (id: string, input: ProductUpdateInput) =>
    apiFetch<ProductResponse>(`/admin/products/${id}`, json('PUT', input)).then((d) => d.product),
  addVariant: (id: string, input: VariantCreateInput) =>
    apiFetch<ProductResponse>(`/admin/products/${id}/variants`, json('POST', input)).then(
      (d) => d.product,
    ),
  updateVariant: (variantId: string, input: VariantUpdateInput) =>
    apiFetch<ProductResponse>(`/admin/variants/${variantId}`, json('PUT', input)).then(
      (d) => d.product,
    ),
  setStock: (variantId: string, expected: number, stock: number) =>
    apiFetch<ProductResponse>(
      `/admin/variants/${variantId}/stock`,
      json('PUT', { expected, stock }),
    ).then((d) => d.product),
  uploadImage: (id: string, file: File) =>
    apiFetch<ProductResponse>(`/admin/products/${id}/images`, { method: 'POST', body: file }).then(
      (d) => d.product,
    ),
  deleteImage: (imageId: string) =>
    apiFetch<ProductResponse>(`/admin/images/${imageId}`, { method: 'DELETE' }).then(
      (d) => d.product,
    ),
  reorderImages: (id: string, imageIds: string[]) =>
    apiFetch<ProductResponse>(`/admin/products/${id}/images/order`, json('PUT', { imageIds })).then(
      (d) => d.product,
    ),
  setSizeChart: (id: string, file: File) =>
    apiFetch<ProductResponse>(`/admin/products/${id}/size-chart`, {
      method: 'PUT',
      body: file,
    }).then((d) => d.product),
  categories: () =>
    apiFetch<{ categories: AdminCategory[] }>('/admin/categories').then((d) => d.categories),
  createCategory: (input: CategoryInput) =>
    apiFetch<{ categories: AdminCategory[] }>('/admin/categories', json('POST', input)).then(
      (d) => d.categories,
    ),
  updateCategory: (id: string, input: CategoryInput) =>
    apiFetch<{ categories: AdminCategory[] }>(`/admin/categories/${id}`, json('PUT', input)).then(
      (d) => d.categories,
    ),
};

function orderPath(orderNumber: string, action = ''): string {
  return `/admin/orders/${encodeURIComponent(orderNumber)}${action}`;
}

type OrderResponse = { order: AdminOrderDetail };

export const adminApi = {
  dashboard: () =>
    apiFetch<{ dashboard: AdminDashboard }>('/admin/dashboard').then((d) => d.dashboard),
  orders: (params: { status?: OrderStatus | undefined; q?: string | undefined; page: number }) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);
    if (params.page > 1) qs.set('page', String(params.page));
    const query = qs.toString();
    return apiFetch<AdminOrderListResult>(`/admin/orders${query ? `?${query}` : ''}`);
  },
  order: (orderNumber: string) =>
    apiFetch<OrderResponse>(orderPath(orderNumber)).then((d) => d.order),
  process: (orderNumber: string) =>
    apiFetch<OrderResponse>(orderPath(orderNumber, '/process'), { method: 'POST' }).then(
      (d) => d.order,
    ),
  ship: (orderNumber: string, trackingNumber: string) =>
    apiFetch<OrderResponse>(orderPath(orderNumber, '/ship'), {
      method: 'POST',
      body: JSON.stringify({ trackingNumber }),
    }).then((d) => d.order),
  deliver: (orderNumber: string) =>
    apiFetch<OrderResponse>(orderPath(orderNumber, '/deliver'), { method: 'POST' }).then(
      (d) => d.order,
    ),
  cancel: (orderNumber: string, reason: string) =>
    apiFetch<OrderResponse>(orderPath(orderNumber, '/cancel'), {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }).then((d) => d.order),

  vouchers: () => apiFetch<{ vouchers: AdminVoucher[] }>('/admin/vouchers').then((d) => d.vouchers),
  createVoucher: (input: VoucherPayload) =>
    apiFetch<{ voucher: AdminVoucher }>('/admin/vouchers', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((d) => d.voucher),
  updateVoucher: (id: string, input: VoucherPayload) =>
    apiFetch<{ voucher: AdminVoucher }>(`/admin/vouchers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }).then((d) => d.voucher),
};

/** Tanggal dikirim sebagai ISO string; server mengubahnya menjadi Date. */
export type VoucherPayload = Omit<VoucherInput, 'startsAt' | 'endsAt'> & {
  startsAt: string;
  endsAt: string;
};
