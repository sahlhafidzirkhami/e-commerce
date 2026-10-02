import { ErrorCode } from '@sportswear/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';

export interface VoucherRule {
  id: string;
  code: string;
  type: 'FIXED' | 'PERCENT';
  /** FIXED: Rupiah. PERCENT: 1–100. */
  value: number;
  maxDiscount: number | null;
  minPurchase: number;
  quota: number;
  usedCount: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
}

function voucherError(message: string): HttpError {
  return HttpError.badRequest(message, ErrorCode.VOUCHER_INVALID);
}

function formatRupiah(amount: number): string {
  return `Rp${amount.toLocaleString('id-ID')}`;
}

/**
 * Validasi voucher dan hitung potongannya terhadap subtotal produk.
 * Potongan tidak pernah memotong ongkir dan tidak pernah melebihi subtotal.
 */
export function calculateVoucherDiscount(
  voucher: VoucherRule,
  subtotal: number,
  now: Date,
): number {
  if (!voucher.isActive) throw voucherError('Voucher tidak aktif');
  if (now < voucher.startsAt) throw voucherError('Voucher belum bisa dipakai');
  if (now > voucher.endsAt) throw voucherError('Voucher sudah berakhir');
  if (voucher.usedCount >= voucher.quota) throw voucherError('Kuota voucher sudah habis');
  if (subtotal < voucher.minPurchase) {
    throw voucherError(
      `Voucher berlaku untuk belanja minimal ${formatRupiah(voucher.minPurchase)}`,
    );
  }

  const raw =
    voucher.type === 'PERCENT' ? Math.floor((subtotal * voucher.value) / 100) : voucher.value;
  const capped = voucher.maxDiscount === null ? raw : Math.min(raw, voucher.maxDiscount);
  return Math.max(0, Math.min(capped, subtotal));
}

type Db = Prisma.TransactionClient | typeof prisma;

export async function findVoucherByCode(code: string, db: Db = prisma): Promise<VoucherRule> {
  const voucher = await db.voucher.findUnique({ where: { code } });
  if (!voucher) throw voucherError('Kode voucher tidak ditemukan');
  return voucher;
}

/**
 * Pakai satu kuota di dalam transaksi pembuatan order. Update bersyarat agar dua
 * order bersamaan tidak bisa melewati kuota.
 */
export async function claimVoucherQuota(
  tx: Prisma.TransactionClient,
  voucherId: string,
  now: Date,
): Promise<void> {
  const { count } = await tx.voucher.updateMany({
    where: {
      id: voucherId,
      isActive: true,
      usedCount: { lt: prisma.voucher.fields.quota },
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    data: { usedCount: { increment: 1 } },
  });
  if (count !== 1) throw voucherError('Kuota voucher sudah habis');
}

/** Kembalikan satu kuota saat order expired atau dibatalkan. */
export async function releaseVoucherQuota(
  tx: Prisma.TransactionClient,
  voucherId: string,
): Promise<void> {
  await tx.voucher.updateMany({
    where: { id: voucherId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
}
