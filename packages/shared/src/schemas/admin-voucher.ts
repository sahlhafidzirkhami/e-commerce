import { z } from 'zod';
import { voucherCodeSchema } from './checkout.js';

const rupiah = (label: string) =>
  z
    .number({ error: `${label} wajib angka` })
    .int(`${label} harus Rupiah bulat`)
    .min(0, `${label} tidak boleh negatif`);

/** Data voucher dari form admin. Tanggal dikirim sebagai ISO string. */
export const voucherInputSchema = z
  .object({
    code: voucherCodeSchema,
    type: z.enum(['FIXED', 'PERCENT']),
    value: z.number().int('Nilai harus bilangan bulat').min(1, 'Nilai minimal 1'),
    maxDiscount: rupiah('Batas potongan').min(1, 'Batas potongan minimal Rp1').nullable(),
    minPurchase: rupiah('Minimal belanja'),
    quota: z.number().int('Kuota harus bilangan bulat').min(1, 'Kuota minimal 1'),
    startsAt: z.coerce.date({ error: 'Tanggal mulai tidak valid' }),
    endsAt: z.coerce.date({ error: 'Tanggal berakhir tidak valid' }),
    isActive: z.boolean(),
  })
  .refine((v) => v.type !== 'PERCENT' || v.value <= 100, {
    message: 'Persen maksimal 100',
    path: ['value'],
  })
  .refine((v) => v.type === 'PERCENT' || v.maxDiscount === null, {
    message: 'Batas potongan hanya untuk voucher persen',
    path: ['maxDiscount'],
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: 'Tanggal berakhir harus setelah tanggal mulai',
    path: ['endsAt'],
  });

export type VoucherInput = z.infer<typeof voucherInputSchema>;

export const VOUCHER_STATES = ['active', 'scheduled', 'ended', 'exhausted', 'inactive'] as const;
export type VoucherState = (typeof VOUCHER_STATES)[number];

export const VOUCHER_STATE_LABELS: Readonly<Record<VoucherState, string>> = {
  active: 'Aktif',
  scheduled: 'Terjadwal',
  ended: 'Berakhir',
  exhausted: 'Kuota habis',
  inactive: 'Nonaktif',
};

/** Status tampilan voucher, diturunkan dari data (tidak disimpan). */
export function voucherState(
  v: { isActive: boolean; startsAt: Date; endsAt: Date; quota: number; usedCount: number },
  now: Date,
): VoucherState {
  if (!v.isActive) return 'inactive';
  if (now > v.endsAt) return 'ended';
  if (v.usedCount >= v.quota) return 'exhausted';
  if (now < v.startsAt) return 'scheduled';
  return 'active';
}

export interface AdminVoucher {
  id: string;
  code: string;
  type: 'FIXED' | 'PERCENT';
  value: number;
  maxDiscount: number | null;
  minPurchase: number;
  quota: number;
  usedCount: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  state: VoucherState;
}
