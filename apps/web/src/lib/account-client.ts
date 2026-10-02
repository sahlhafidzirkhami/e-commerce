import type {
  AccountAddress,
  AccountOrderList,
  AddressInput,
  AuthUser,
  ProfileInput,
} from '@sportswear/shared';
import { apiFetch } from './api-client';

type Addresses = { addresses: AccountAddress[] };
const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

/** Akun pembeli (F-08, F-18). */
export const accountApi = {
  me: () => apiFetch<{ user: AuthUser }>('/auth/me').then((d) => d.user),
  orders: (page: number) =>
    apiFetch<AccountOrderList>(`/account/orders${page > 1 ? `?page=${page}` : ''}`),
  addresses: () => apiFetch<Addresses>('/account/addresses').then((d) => d.addresses),
  createAddress: (input: AddressInput) =>
    apiFetch<Addresses>('/account/addresses', json('POST', input)).then((d) => d.addresses),
  updateAddress: (id: string, input: AddressInput) =>
    apiFetch<Addresses>(`/account/addresses/${id}`, json('PUT', input)).then((d) => d.addresses),
  setDefaultAddress: (id: string) =>
    apiFetch<Addresses>(`/account/addresses/${id}/default`, { method: 'POST' }).then(
      (d) => d.addresses,
    ),
  deleteAddress: (id: string) =>
    apiFetch<Addresses>(`/account/addresses/${id}`, { method: 'DELETE' }).then((d) => d.addresses),
  updateProfile: (input: ProfileInput) =>
    apiFetch<{ user: AuthUser }>('/account/profile', json('PUT', input)).then((d) => d.user),
  deleteAccount: (password: string) => apiFetch<unknown>('/account', json('DELETE', { password })),
  createFromOrder: (orderNumber: string, token: string, password: string) =>
    apiFetch<{ user: AuthUser }>(
      `/orders/${encodeURIComponent(orderNumber)}/account`,
      json('POST', { token, password }),
    ).then((d) => d.user),
};
