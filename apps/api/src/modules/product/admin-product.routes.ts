import express, { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import {
  deleteImage,
  getCategories,
  getProduct,
  getProducts,
  postCategory,
  postImage,
  postProduct,
  postVariant,
  putCategory,
  putImageOrder,
  putProduct,
  putSizeChart,
  putVariant,
  putVariantStock,
} from './admin-product.controller.js';

/** Foto dari HP bisa beberapa MB; dikonversi ke WebP 1200 px sebelum disimpan. */
const imageUpload = express.raw({
  type: ['image/jpeg', 'image/png', 'image/webp'],
  limit: '10mb',
});

/** /api/admin — produk, ukuran, foto, kategori (F-19). Hanya ADMIN atau OWNER. */
export function createAdminProductRouter(): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get('/products', getProducts);
  router.post('/products', postProduct);
  router.get('/products/:id', getProduct);
  router.put('/products/:id', putProduct);
  router.post('/products/:id/variants', postVariant);
  router.post('/products/:id/images', imageUpload, postImage);
  router.put('/products/:id/images/order', putImageOrder);
  router.put('/products/:id/size-chart', imageUpload, putSizeChart);

  router.put('/variants/:id', putVariant);
  router.put('/variants/:id/stock', putVariantStock);

  router.delete('/images/:id', deleteImage);

  router.get('/categories', getCategories);
  router.post('/categories', postCategory);
  router.put('/categories/:id', putCategory);

  return router;
}
