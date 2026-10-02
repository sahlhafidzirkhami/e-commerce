import { z } from 'zod';
import type { OrderStatus } from '../order-status.js';
import { passwordSchema, phoneSchema } from './auth.js';
import { shippingAddressSchema } from './checkout.js';

/** Buku alamat maksimal 5 alamat per user (F-18). */
export const ADDRESS_BOOK_LIMIT = 5;

export const addressInputSchema = shippingAddressSchema.extend({
  label: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(30, 'Label maksimal 30 karakter').nullable(),
  ),
});

export const profileInputSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama terlalu panjang'),
  phone: phoneSchema,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password wajib diisi').max(128),
});

/** Tamu membuat akun dari halaman pesanan yang sudah dibayar (F-08). */
export const accountFromOrderSchema = z.object({
  token: z.string().min(1).max(200),
  password: passwordSchema,
});

export type AddressInput = z.infer<typeof addressInputSchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;

export interface AccountAddress extends AddressInput {
  id: string;
  isDefault: boolean;
  district: string;
  city: string;
  province: string;
  /** Untuk mengisi ulang pilihan wilayah di form ubah alamat. */
  cityId: number;
  provinceId: number;
}

export interface AccountOrderSummary {
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  total: number;
  itemCount: number;
  firstItemName: string;
  courier: string;
  trackingNumber: string | null;
}

export interface AccountOrderList {
  items: AccountOrderSummary[];
  page: number;
  pageSize: number;
  total: number;
}
