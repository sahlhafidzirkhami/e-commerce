import { voucherInputSchema } from '@sportswear/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { createVoucher, listVouchers, updateVoucher } from './admin-voucher.service.js';

const paramsSchema = z.object({ id: z.string().min(1).max(40) });

export const getVouchers: RequestHandler = async (_req, res) => {
  res.json({ data: { vouchers: await listVouchers() } });
};

export const postVoucher: RequestHandler = async (req, res) => {
  const input = voucherInputSchema.parse(req.body);
  res.status(201).json({ data: { voucher: await createVoucher(input) } });
};

export const putVoucher: RequestHandler = async (req, res) => {
  const { id } = paramsSchema.parse(req.params);
  const input = voucherInputSchema.parse(req.body);
  res.json({ data: { voucher: await updateVoucher(id, input) } });
};
