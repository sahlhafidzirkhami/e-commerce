import { z } from 'zod';
import { PAGINATION } from '../constants.js';
import { OrderStatus } from '../order-status.js';

export const adminOrderListQuerySchema = z.object({
  status: z.enum(OrderStatus).optional(),
  /** Nomor order, nama, atau email pembeli. */
  q: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(100).optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
});

export const shipOrderSchema = z.object({
  trackingNumber: z
    .string()
    .trim()
    .min(6, 'Nomor resi minimal 6 karakter')
    .max(40, 'Nomor resi maksimal 40 karakter')
    .regex(/^[A-Za-z0-9-]+$/, 'Nomor resi hanya huruf, angka, dan tanda hubung'),
});

export const cancelOrderSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, 'Alasan pembatalan minimal 5 karakter')
    .max(300, 'Alasan maksimal 300 karakter'),
});

export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;
export type ShipOrderInput = z.infer<typeof shipOrderSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
