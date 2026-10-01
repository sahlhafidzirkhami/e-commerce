import { z } from 'zod';
import { CART_MAX_QUANTITY_PER_ITEM, PRODUCT_SORTS } from '../catalog.js';
import { PAGINATION } from '../constants.js';
import { idSchema } from './common.js';

/** Angka opsional dari query string; string kosong dianggap tidak diisi. */
const optionalRupiahQuery = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().int().nonnegative().optional(),
);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );

export const productListQuerySchema = z
  .object({
    category: optionalText(100),
    size: optionalText(20),
    q: optionalText(100),
    minPrice: optionalRupiahQuery,
    maxPrice: optionalRupiahQuery,
    sort: z.enum(PRODUCT_SORTS).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(PAGINATION.MAX_PAGE_SIZE)
      .default(PAGINATION.DEFAULT_PAGE_SIZE),
  })
  .refine(
    (query) =>
      query.minPrice === undefined ||
      query.maxPrice === undefined ||
      query.minPrice <= query.maxPrice,
    { message: 'Harga minimum tidak boleh lebih besar dari harga maksimum', path: ['minPrice'] },
  );

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

const quantitySchema = z
  .number()
  .int('Jumlah harus bilangan bulat')
  .min(1, 'Jumlah minimal 1')
  .max(CART_MAX_QUANTITY_PER_ITEM, `Jumlah maksimal ${CART_MAX_QUANTITY_PER_ITEM}`);

export const addCartItemSchema = z.object({
  variantId: idSchema,
  quantity: quantitySchema.default(1),
});

export const updateCartItemSchema = z.object({
  quantity: quantitySchema,
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
