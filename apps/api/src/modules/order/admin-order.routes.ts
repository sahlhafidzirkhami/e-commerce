import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import {
  getOrder,
  getOrders,
  postCancel,
  postDeliver,
  postProcess,
  postShip,
} from './admin-order.controller.js';

/** /api/admin/orders — semua endpoint hanya untuk ADMIN atau OWNER. */
export function createAdminOrderRouter(): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get('/', getOrders);
  router.get('/:orderNumber', getOrder);
  router.post('/:orderNumber/process', postProcess);
  router.post('/:orderNumber/ship', postShip);
  router.post('/:orderNumber/deliver', postDeliver);
  router.post('/:orderNumber/cancel', postCancel);

  return router;
}
