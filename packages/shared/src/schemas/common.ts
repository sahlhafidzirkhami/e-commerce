import { z } from 'zod';
import { PAGINATION } from '../constants.js';

/** Nominal Rupiah: integer, tidak negatif, tanpa desimal. */
export const rupiahSchema = z.number().int().nonnegative();

export const idSchema = z.string().min(1);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
});

export type Pagination = z.infer<typeof paginationSchema>;
