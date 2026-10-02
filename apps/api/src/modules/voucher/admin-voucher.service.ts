import { ErrorCode, voucherState, type AdminVoucher, type VoucherInput } from '@sportswear/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';

type VoucherRecord = Prisma.VoucherGetPayload<object>;

function toAdminVoucher(v: VoucherRecord, now: Date): AdminVoucher {
  return {
    id: v.id,
    code: v.code,
    type: v.type,
    value: v.value,
    maxDiscount: v.maxDiscount,
    minPurchase: v.minPurchase,
    quota: v.quota,
    usedCount: v.usedCount,
    startsAt: v.startsAt.toISOString(),
    endsAt: v.endsAt.toISOString(),
    isActive: v.isActive,
    state: voucherState(v, now),
  };
}

function codeTaken(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function listVouchers(now = new Date()): Promise<AdminVoucher[]> {
  const vouchers = await prisma.voucher.findMany({ orderBy: { createdAt: 'desc' } });
  return vouchers.map((v) => toAdminVoucher(v, now));
}

export async function createVoucher(input: VoucherInput, now = new Date()): Promise<AdminVoucher> {
  try {
    return toAdminVoucher(await prisma.voucher.create({ data: input }), now);
  } catch (err) {
    if (codeTaken(err)) throw HttpError.conflict(`Kode ${input.code} sudah dipakai voucher lain`);
    throw err;
  }
}

/**
 * Ubah voucher. Jumlah terpakai tidak bisa diedit, dan kuota tidak boleh di bawahnya.
 * Order lama menyimpan potongannya sendiri, jadi perubahan nilai hanya berlaku ke depan.
 */
export async function updateVoucher(
  id: string,
  input: VoucherInput,
  now = new Date(),
): Promise<AdminVoucher> {
  try {
    // Syarat kuota dicek di update yang sama agar tidak bisa disalip checkout bersamaan.
    const { count } = await prisma.voucher.updateMany({
      where: { id, usedCount: { lte: input.quota } },
      data: input,
    });
    if (count === 0) {
      const existing = await prisma.voucher.findUnique({
        where: { id },
        select: { usedCount: true },
      });
      if (!existing) throw HttpError.notFound('Voucher tidak ditemukan');
      throw HttpError.badRequest(
        `Kuota tidak boleh kurang dari yang sudah terpakai (${existing.usedCount})`,
        ErrorCode.VALIDATION_ERROR,
      );
    }
  } catch (err) {
    if (codeTaken(err)) throw HttpError.conflict(`Kode ${input.code} sudah dipakai voucher lain`);
    throw err;
  }
  return toAdminVoucher(await prisma.voucher.findUniqueOrThrow({ where: { id } }), now);
}
