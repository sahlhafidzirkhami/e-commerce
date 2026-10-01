import { Router } from 'express';
import { getCategories, getProduct, getProducts } from './product.controller.js';

export function createCatalogRouter(): Router {
  const router = Router();

  router.get('/categories', getCategories);
  router.get('/products', getProducts);
  router.get('/products/:slug', getProduct);

  return router;
}
