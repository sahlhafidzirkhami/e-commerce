import { z } from 'zod';
import { emailSchema, phoneSchema } from './auth.js';

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} wajib diisi`).max(max, `${label} maksimal ${max} karakter`);

/** Kontak pembeli, wajib untuk tamu maupun member. */
export const checkoutContactSchema = z.object({
  name: requiredText('Nama', 100).pipe(z.string().min(2, 'Nama minimal 2 karakter')),
  email: emailSchema,
  phone: phoneSchema,
});

export const shippingAddressSchema = z.object({
  recipientName: requiredText('Nama penerima', 100),
  phone: phoneSchema,
  street: requiredText('Alamat lengkap', 300).pipe(
    z.string().min(10, 'Alamat lengkap minimal 10 karakter'),
  ),
  districtId: z.number().int().positive('Pilih kecamatan'),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'Kode pos harus 5 digit'),
});

export const shippingChoiceSchema = z.object({
  /** Kode kurir RajaOngkir, mis. "jne". */
  courier: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,20}$/, 'Kurir tidak valid'),
  /** Kode layanan, mis. "REG". */
  service: requiredText('Layanan kurir', 50),
});

export const voucherCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,32}$/, 'Kode voucher tidak valid');

/** Hitung ulang total untuk ditampilkan (tanpa membuat order). */
export const checkoutQuoteSchema = z.object({
  districtId: z.number().int().positive(),
  shipping: shippingChoiceSchema,
  voucherCode: voucherCodeSchema.optional(),
});

export const createOrderSchema = z.object({
  contact: checkoutContactSchema,
  address: shippingAddressSchema,
  shipping: shippingChoiceSchema,
  voucherCode: voucherCodeSchema.optional(),
  notes: z.string().trim().max(300, 'Catatan maksimal 300 karakter').optional(),
  /** Member: simpan alamat ini ke buku alamat (diabaikan bila sudah 5 alamat). */
  saveAddress: z.boolean().optional(),
});

export type CheckoutContact = z.infer<typeof checkoutContactSchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type ShippingChoice = z.infer<typeof shippingChoiceSchema>;
export type CheckoutQuoteInput = z.infer<typeof checkoutQuoteSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
