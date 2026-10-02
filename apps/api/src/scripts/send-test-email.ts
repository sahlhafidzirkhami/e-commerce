/**
 * Kirim satu email uji dari order terbaru di database dev, untuk mengecek pengaturan SMTP.
 * Pengalihan tetap berlaku: di luar production email masuk ke EMAIL_DEV_REDIRECT_TO.
 *
 *   pnpm --filter api email:test                 # email "pembayaran diterima"
 *   pnpm --filter api email:test order-shipped   # jenis lain
 */
import { prisma } from '../lib/prisma.js';
import { sendOrderEmail } from '../modules/email/order-email.service.js';
import { ORDER_EMAIL_KINDS, type OrderEmailKind } from '../modules/email/order-email.templates.js';

const kind = (process.argv[2] ?? 'order-paid') as OrderEmailKind;
if (!ORDER_EMAIL_KINDS.includes(kind)) {
  console.error(`Jenis email tidak dikenal. Pilih: ${ORDER_EMAIL_KINDS.join(', ')}`);
  process.exit(1);
}

const order = await prisma.order.findFirst({
  // "order-created" hanya dikirim untuk order yang masih menunggu pembayaran.
  where: kind === 'order-created' ? { status: 'pending' } : {},
  orderBy: { createdAt: 'desc' },
  select: { id: true, orderNumber: true },
});
if (!order) {
  console.error('Belum ada order yang cocok di database. Buat pesanan dulu lewat checkout.');
  process.exit(1);
}

try {
  const outcome = await sendOrderEmail(kind, order.id);
  console.log(`${kind} untuk ${order.orderNumber}: ${outcome}`);
} catch (err) {
  console.error('Gagal mengirim:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
