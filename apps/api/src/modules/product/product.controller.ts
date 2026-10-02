import { productListQuerySchema } from '@sportswear/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { getProductBySlug, listCategories, listProducts } from './product.service.js';

const slugParamsSchema = z.object({ slug: z.string().trim().min(1).max(200) });

export const getCategories: RequestHandler = async (_req, res) => {
  res.json({ data: { categories: await listCategories() } });
};

export const getProducts: RequestHandler = async (req, res) => {
  const query = productListQuerySchema.parse(req.query);
  res.json({ data: await listProducts(query) });
};

export const getProduct: RequestHandler = async (req, res) => {
  const { slug } = slugParamsSchema.parse(req.params);
  res.json({ data: { product: await getProductBySlug(slug) } });
};
