import {
  categoryInputSchema,
  imageOrderSchema,
  productCreateSchema,
  productUpdateSchema,
  stockUpdateSchema,
  variantCreateSchema,
  variantUpdateSchema,
} from '@sportswear/shared';
import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import {
  addProductImage,
  addVariant,
  createCategory,
  createProduct,
  deleteProductImage,
  getAdminProduct,
  listAdminCategories,
  listAdminProducts,
  reorderProductImages,
  setSizeChart,
  setVariantStock,
  updateCategory,
  updateProduct,
  updateVariant,
} from './admin-product.service.js';

const idParams = z.object({ id: z.string().min(1).max(40) });

const listQuerySchema = z.object({
  q: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(100).optional(),
  ),
  categoryId: z.string().min(1).max(40).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

/** Foto dikirim sebagai body biner (express.raw di routes). */
function imageBody(req: Request): Buffer {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw HttpError.badRequest('File foto kosong');
  }
  return req.body;
}

export const getProducts: RequestHandler = async (req, res) => {
  res.json({ data: await listAdminProducts(listQuerySchema.parse(req.query)) });
};

export const getProduct: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json({ data: { product: await getAdminProduct(id) } });
};

export const postProduct: RequestHandler = async (req, res) => {
  const input = productCreateSchema.parse(req.body);
  res.status(201).json({ data: { product: await createProduct(input) } });
};

export const putProduct: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  const input = productUpdateSchema.parse(req.body);
  res.json({ data: { product: await updateProduct(id, input) } });
};

export const postVariant: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  const input = variantCreateSchema.parse(req.body);
  res.status(201).json({ data: { product: await addVariant(id, input) } });
};

export const putVariant: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  const input = variantUpdateSchema.parse(req.body);
  res.json({ data: { product: await updateVariant(id, input) } });
};

export const putVariantStock: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  const input = stockUpdateSchema.parse(req.body);
  res.json({ data: { product: await setVariantStock(id, input) } });
};

export const postImage: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.status(201).json({ data: { product: await addProductImage(id, imageBody(req)) } });
};

export const deleteImage: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json({ data: { product: await deleteProductImage(id) } });
};

export const putImageOrder: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  const { imageIds } = imageOrderSchema.parse(req.body);
  res.json({ data: { product: await reorderProductImages(id, imageIds) } });
};

export const putSizeChart: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json({ data: { product: await setSizeChart(id, imageBody(req)) } });
};

export const getCategories: RequestHandler = async (_req, res) => {
  res.json({ data: { categories: await listAdminCategories() } });
};

export const postCategory: RequestHandler = async (req, res) => {
  const input = categoryInputSchema.parse(req.body);
  res.status(201).json({ data: { categories: await createCategory(input) } });
};

export const putCategory: RequestHandler = async (req, res) => {
  const { id } = idParams.parse(req.params);
  const input = categoryInputSchema.parse(req.body);
  res.json({ data: { categories: await updateCategory(id, input) } });
};
