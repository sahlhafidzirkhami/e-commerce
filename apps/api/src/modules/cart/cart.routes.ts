import { Router } from 'express';
import { deleteCartItem, getCart, patchCartItem, postCartItem } from './cart.controller.js';

export function createCartRouter(): Router {
  const router = Router();

  router.get('/', getCart);
  router.post('/items', postCartItem);
  router.patch('/items/:variantId', patchCartItem);
  router.delete('/items/:variantId', deleteCartItem);

  return router;
}
