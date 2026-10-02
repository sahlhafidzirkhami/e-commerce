import { Router, type RequestHandler } from 'express';
import { requireAdmin } from '../auth/auth.middleware.js';
import { getAdminDashboard } from './admin-dashboard.service.js';

const getDashboard: RequestHandler = async (_req, res) => {
  res.json({ data: { dashboard: await getAdminDashboard() } });
};

/** /api/admin/dashboard (F-22). Hanya ADMIN atau OWNER. */
export function createAdminDashboardRouter(): Router {
  const router = Router();
  router.use(requireAdmin);
  router.get('/', getDashboard);
  return router;
}
