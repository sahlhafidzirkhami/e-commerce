import { Router } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import { getVouchers, postVoucher, putVoucher } from './admin-voucher.controller.js';

/** /api/admin/vouchers — hanya ADMIN atau OWNER (F-21). */
export function createAdminVoucherRouter(): Router {
  const router = Router();
  router.use(requireAdmin);

  router.get('/', getVouchers);
  router.post('/', postVoucher);
  router.put('/:id', putVoucher);

  return router;
}
