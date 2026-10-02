/**
 * Dashboard admin (F-22): omzet harian/bulanan, pesanan per status, produk terlaris, dan
 * varian stok menipis. Semua tanggal dihitung dalam WIB berdasarkan waktu pembayaran.
 */
import {
  DASHBOARD_DAYS,
  LOW_STOCK_THRESHOLD,
  ORDER_STATUSES,
  REVENUE_STATUSES,
  type AdminDashboard,
  type DailyRevenue,
  type OrderStatus,
} from '@sportswear/shared';
import { prisma } from '../../lib/prisma.js';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_PRODUCTS = 10;
const LOW_STOCK_LIMIT = 20;

/** "YYYY-MM-DD" menurut kalender WIB. */
export function wibDateKey(date: Date): string {
  return new Date(date.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

function wibMidnight(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00+07:00`);
}

export async function getAdminDashboard(now = new Date()): Promise<AdminDashboard> {
  const todayKey = wibDateKey(now);
  const todayStart = wibMidnight(todayKey);
  const monthStart = wibMidnight(`${todayKey.slice(0, 7)}-01`);
  const rangeStart = new Date(todayStart.getTime() - (DASHBOARD_DAYS - 1) * DAY_MS);
  const queryStart = monthStart < rangeStart ? monthStart : rangeStart;
  const revenueStatuses = [...REVENUE_STATUSES];

  const [paidOrders, statusGroups, soldGroups, lowStock] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: revenueStatuses }, paidAt: { gte: queryStart, lte: now } },
      select: { total: true, paidAt: true },
    }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        variantId: { not: null },
        order: { status: { in: revenueStatuses }, paidAt: { gte: rangeStart, lte: now } },
      },
      _sum: { quantity: true, subtotal: true },
    }),
    prisma.productVariant.findMany({
      where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD }, product: { isActive: true } },
      orderBy: [{ stock: 'asc' }, { sku: 'asc' }],
      take: LOW_STOCK_LIMIT,
      select: { sku: true, size: true, stock: true, product: { select: { id: true, name: true } } },
    }),
  ]);

  // Omzet harian (WIB) untuk grafik, hari tanpa penjualan tetap ditampilkan sebagai 0.
  const byDay = new Map<string, DailyRevenue>();
  for (let i = 0; i < DASHBOARD_DAYS; i++) {
    const key = wibDateKey(new Date(rangeStart.getTime() + i * DAY_MS));
    byDay.set(key, { date: key, revenue: 0, orders: 0 });
  }
  const today = { revenue: 0, orders: 0 };
  const thisMonth = { revenue: 0, orders: 0 };
  for (const order of paidOrders) {
    if (!order.paidAt) continue;
    const day = byDay.get(wibDateKey(order.paidAt));
    if (day) {
      day.revenue += order.total;
      day.orders++;
    }
    if (order.paidAt >= monthStart) {
      thisMonth.revenue += order.total;
      thisMonth.orders++;
    }
    if (order.paidAt >= todayStart) {
      today.revenue += order.total;
      today.orders++;
    }
  }

  const countsByStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const group of statusGroups) countsByStatus[group.status] = group._count._all;

  // Terjual per varian → dijumlah per produk (satu produk = satu warna, beberapa ukuran).
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: soldGroups.flatMap((g) => (g.variantId ? [g.variantId] : [])) } },
    select: {
      id: true,
      product: {
        select: {
          id: true,
          name: true,
          images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true } },
        },
      },
    },
  });
  const productOf = new Map(variants.map((v) => [v.id, v.product]));
  const perProduct = new Map<string, AdminDashboard['topProducts'][number]>();
  for (const group of soldGroups) {
    const product = group.variantId ? productOf.get(group.variantId) : undefined;
    if (!product) continue;
    const entry = perProduct.get(product.id) ?? {
      productId: product.id,
      name: product.name,
      imageUrl: product.images[0]?.url ?? null,
      quantity: 0,
      revenue: 0,
    };
    entry.quantity += group._sum.quantity ?? 0;
    entry.revenue += group._sum.subtotal ?? 0;
    perProduct.set(product.id, entry);
  }
  const topProducts = [...perProduct.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, TOP_PRODUCTS);

  return {
    generatedAt: now.toISOString(),
    today,
    thisMonth,
    daily: [...byDay.values()],
    countsByStatus,
    topProducts,
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    lowStock: lowStock.map((v) => ({
      productId: v.product.id,
      productName: v.product.name,
      size: v.size,
      sku: v.sku,
      stock: v.stock,
    })),
  };
}
