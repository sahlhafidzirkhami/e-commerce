/**
 * Test integrasi dengan PostgreSQL sungguhan: pengurangan stok bersyarat, kuota voucher,
 * transisi status, dan webhook DOKU tidak bisa diuji dengan mock. Dilewati bila
 * TEST_DATABASE_URL kosong. Semua test database ada di satu file ini agar tidak berjalan
 * paralel dan saling mengosongkan tabel.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// Hanya tipe: modulnya baru dimuat di beforeAll, setelah DATABASE_URL diganti.
import type * as AppModule from '../../app.js';
import type * as ExpireModule from '../../jobs/expire-order.js';
import type * as PaymentModule from '../payment/payment.service.js';
import type * as MailerModule from '../../lib/mailer.js';
import type * as DokuModule from '../../lib/doku.js';
import type * as HttpErrorModule from '../../lib/http-error.js';
import type * as PrismaModule from '../../lib/prisma.js';
import type * as OrderServiceModule from './order.service.js';
import type * as TransitionModule from './order.transition.js';
import type * as AuthTokenModule from '../auth/auth.token.js';

config({ path: fileURLToPath(new URL('../../../../../.env', import.meta.url)), quiet: true });
const testUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testUrl)('order di database sungguhan', () => {
  // Modul yang memakai Prisma diimpor setelah DATABASE_URL diarahkan ke database test.
  let prisma: typeof PrismaModule.prisma;
  let createOrder: typeof OrderServiceModule.createOrder;
  let getOrderForViewer: typeof OrderServiceModule.getOrderForViewer;
  let transitionOrder: typeof TransitionModule.transitionOrder;
  let HttpError: typeof HttpErrorModule.HttpError;
  let createApp: typeof AppModule.createApp;
  let doku: typeof DokuModule;
  let startPayment: typeof PaymentModule.startPayment;
  let expireOverdueOrders: typeof ExpireModule.expireOverdueOrders;
  let signSessionToken: typeof AuthTokenModule.signSessionToken;

  // Kredensial palsu khusus test; kredensial sandbox asli di .env tidak dipakai.
  const DOKU_TEST = { clientId: 'BRN-TEST-0001', secretKey: 'SK-test-rahasia' };
  const uploadsDir = mkdtempSync(path.join(tmpdir(), '3on-uploads-'));
  // Email hanya dicatat; job dari test tidak boleh masuk antrean Redis development.
  const enqueueOrderEmail = vi.fn(async (_kind: string, _orderId: string) => {});
  const emailsFor = (kind: string) =>
    enqueueOrderEmail.mock.calls.filter(([k]) => k === kind).map(([, orderId]) => orderId);
  // Pembuatan sesi DOKU dicatat, bukan dikirim ke DOKU.
  const createCheckoutPayment = vi.fn(async (input: { dueMinutes: number }) => ({
    url: `https://staging.doku.com/checkout-link-v2/test-${input.dueMinutes}`,
    tokenId: null,
    sessionId: null,
    expiredDate: null,
  }));

  const quoteShipping = async () => ({
    courier: 'jne',
    courierName: 'JNE',
    service: 'REG',
    description: 'Layanan Reguler',
    cost: 20000,
    etd: '2-3 day',
  });

  const contact = { name: 'Budi Santoso', email: 'budi@mail.com', phone: '081234567890' };
  const address = {
    recipientName: 'Budi Santoso',
    phone: '081234567890',
    street: 'Jl. Melati No. 10, RT 02 RW 03',
    districtId: 1001,
    postalCode: '40115',
  };
  const shipping = { courier: 'jne', service: 'REG' };

  let variantId: string;
  let productId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    process.env.DOKU_CLIENT_ID = DOKU_TEST.clientId;
    process.env.DOKU_SECRET_KEY = DOKU_TEST.secretKey;
    delete process.env.DOKU_NOTIFICATION_URL;
    // Foto hasil test tidak boleh tercampur dengan foto produk development.
    process.env.UPLOADS_DIR = uploadsDir;
    vi.doMock('../../jobs/email-queue.js', () => ({ enqueueOrderEmail }));
    // .env sungguhan dimuat: email tidak boleh benar-benar terkirim dari test.
    vi.doMock('../../lib/mailer.js', async (original) => ({
      ...(await original<typeof MailerModule>()),
      sendMail: vi.fn(async () => 'sent' as const),
    }));
    vi.doMock('../../lib/doku.js', async (original) => ({
      ...(await original<typeof DokuModule>()),
      createCheckoutPayment,
    }));
    ({ prisma } = await import('../../lib/prisma.js'));
    ({ startPayment } = await import('../payment/payment.service.js'));
    ({ expireOverdueOrders } = await import('../../jobs/expire-order.js'));
    ({ createApp } = await import('../../app.js'));
    doku = await import('../../lib/doku.js');
    ({ createOrder, getOrderForViewer } = await import('./order.service.js'));
    ({ transitionOrder } = await import('./order.transition.js'));
    ({ HttpError } = await import('../../lib/http-error.js'));
    ({ signSessionToken } = await import('../auth/auth.token.js'));
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    enqueueOrderEmail.mockClear();
    await prisma.$executeRawUnsafe(
      'TRUNCATE "PasswordResetToken", "OrderStatusHistory", "OrderItem", "Payment", "Order", "CartItem", "Cart", "Voucher", "ProductVariant", "ProductImage", "Product", "Category", "District", "City", "Province", "User" CASCADE',
    );
    // Huruf kapital semua, seperti data asli dari RajaOngkir.
    await prisma.province.create({ data: { id: 9, name: 'JAWA BARAT' } });
    await prisma.city.create({ data: { id: 23, provinceId: 9, name: 'BANDUNG' } });
    await prisma.district.create({ data: { id: 1001, cityId: 23, name: 'SUMUR BANDUNG' } });
    const product = await prisma.product.create({
      data: {
        sku: 'TSS001-1',
        name: 'Kaos Lari',
        slug: 'kaos-lari',
        variants: {
          create: { sku: 'TSS001-1-M', size: 'M', price: 150000, stock: 1, weightGram: 200 },
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0]!.id;
  });

  async function cartWith(token: string, quantity = 1) {
    await prisma.cart.create({
      data: { token, items: { create: { variantId, quantity } } },
    });
    return { token };
  }

  async function stock() {
    return (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
  }

  function errorCode(err: unknown): string {
    return err instanceof HttpError ? err.code : String(err);
  }

  it('membuat order: stok berkurang, snapshot tersimpan, keranjang kosong, total dari server', async () => {
    const owner = await cartWith('tamu-1');
    const created = await createOrder({ contact, address, shipping }, { owner, quoteShipping });

    expect(await stock()).toBe(0);
    expect(emailsFor('order-created')).toEqual([created.id]);
    const order = await prisma.order.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true, statusHistory: true },
    });
    expect(order).toMatchObject({
      status: 'pending',
      subtotal: 150000,
      shippingCost: 20000,
      discount: 0,
      total: 170000,
      totalWeightGram: 200,
      shippingDistrict: 'Sumur Bandung',
      shippingCity: 'Bandung',
      shippingProvince: 'Jawa Barat',
    });
    expect(order.items).toEqual([
      expect.objectContaining({
        productName: 'Kaos Lari',
        variantLabel: 'Ukuran M',
        price: 150000,
      }),
    ]);
    expect(order.statusHistory.map((h) => [h.fromStatus, h.toStatus])).toEqual([[null, 'pending']]);
    // Batas bayar 3 jam (keputusan 1 Okt 2026).
    expect(order.expiresAt.getTime() - order.createdAt.getTime()).toBe(3 * 60 * 60 * 1000);
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it('dua checkout bersamaan untuk stok terakhir: hanya satu yang berhasil, stok tidak negatif', async () => {
    const [a, b] = await Promise.all([cartWith('tamu-a'), cartWith('tamu-b')]);
    const results = await Promise.allSettled([
      createOrder({ contact, address, shipping }, { owner: a, quoteShipping }),
      createOrder({ contact, address, shipping }, { owner: b, quoteShipping }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(['INSUFFICIENT_STOCK', 'CART_HAS_ISSUES']).toContain(errorCode(failed.reason));
    expect(await stock()).toBe(0);
    expect(await prisma.order.count()).toBe(1);
  });

  it('kuota voucher tidak bisa terlampaui oleh order bersamaan', async () => {
    await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 10 } });
    await prisma.voucher.create({
      data: {
        code: 'LARI20',
        type: 'FIXED',
        value: 20000,
        quota: 1,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000 * 60),
      },
    });
    const [a, b] = await Promise.all([cartWith('tamu-a'), cartWith('tamu-b')]);
    const results = await Promise.allSettled([
      createOrder(
        { contact, address, shipping, voucherCode: 'LARI20' },
        { owner: a, quoteShipping },
      ),
      createOrder(
        { contact, address, shipping, voucherCode: 'LARI20' },
        { owner: b, quoteShipping },
      ),
    ]);

    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    expect((ok[0] as PromiseFulfilledResult<{ total: number }>).value.total).toBe(150000);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(errorCode(failed.reason)).toBe('VOUCHER_INVALID');
    expect((await prisma.voucher.findUniqueOrThrow({ where: { code: 'LARI20' } })).usedCount).toBe(
      1,
    );
    // Order yang gagal tidak boleh mengurangi stok.
    expect(await stock()).toBe(9);
  });

  it('expired mengembalikan stok dan kuota voucher; transisi lanjutan ditolak', async () => {
    await prisma.voucher.create({
      data: {
        code: 'LARI20',
        type: 'FIXED',
        value: 20000,
        quota: 5,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 60_000 * 60),
      },
    });
    const owner = await cartWith('tamu-1');
    const order = await createOrder(
      { contact, address, shipping, voucherCode: 'LARI20' },
      { owner, quoteShipping },
    );
    expect(await stock()).toBe(0);

    await transitionOrder(order.id, 'expired', { note: 'Tidak dibayar 24 jam' });

    expect(await stock()).toBe(1);
    expect((await prisma.voucher.findUniqueOrThrow({ where: { code: 'LARI20' } })).usedCount).toBe(
      0,
    );
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(history.map((h) => h.toStatus)).toEqual(['pending', 'expired']);

    await expect(transitionOrder(order.id, 'paid')).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
    // Penolakan tidak mengubah apa pun.
    expect(await stock()).toBe(1);
  });

  it('paid mengisi paidAt dan tidak mengembalikan stok; riwayat order tidak ikut berubah saat produk diedit', async () => {
    const owner = await cartWith('tamu-1');
    const order = await createOrder({ contact, address, shipping }, { owner, quoteShipping });

    await transitionOrder(order.id, 'paid');
    await prisma.product.update({ where: { id: productId }, data: { name: 'Kaos Lari Baru' } });
    await prisma.productVariant.update({ where: { id: variantId }, data: { price: 199000 } });

    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
    expect(saved.status).toBe('paid');
    expect(saved.paidAt).not.toBeNull();
    expect(await stock()).toBe(0);
    expect(saved.items[0]).toMatchObject({ productName: 'Kaos Lari', price: 150000 });
  });

  it('status pesanan hanya bisa dibuka dengan token yang benar', async () => {
    const owner = await cartWith('tamu-1');
    const order = await createOrder({ contact, address, shipping }, { owner, quoteShipping });

    const view = await getOrderForViewer(order.orderNumber, { token: order.accessToken });
    expect(view).toMatchObject({ status: 'pending', total: 170000 });
    await expect(
      getOrderForViewer(order.orderNumber, { token: 'token-salah' }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(getOrderForViewer(order.orderNumber, {})).rejects.toMatchObject({ status: 404 });
  });

  it('keranjang kosong ditolak', async () => {
    await prisma.cart.create({ data: { token: 'kosong' } });
    await expect(
      createOrder({ contact, address, shipping }, { owner: { token: 'kosong' }, quoteShipping }),
    ).rejects.toMatchObject({ code: 'CART_EMPTY' });
  });

  describe('webhook DOKU', () => {
    const WEBHOOK = '/api/webhooks/doku';

    /** Order pending + Payment PENDING seperti setelah pembeli membuka pop-up DOKU. */
    async function pendingOrderWithPayment(invoiceNumber = 'INV-TEST-0001') {
      const owner = await cartWith(`tamu-${randomUUID()}`);
      const order = await createOrder({ contact, address, shipping }, { owner, quoteShipping });
      await prisma.payment.create({
        data: {
          orderId: order.id,
          invoiceNumber,
          amount: order.total,
          status: 'PENDING',
          paymentUrl: 'https://sandbox.doku.com/checkout-link-v2/x',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      return order;
    }

    function notify(
      body: object | string,
      { secretKey = DOKU_TEST.secretKey, target = WEBHOOK } = {},
    ) {
      const raw = typeof body === 'string' ? body : JSON.stringify(body);
      const requestId = randomUUID();
      const timestamp = doku.dokuTimestamp(new Date());
      const signature = doku.sign(
        { clientId: DOKU_TEST.clientId, requestId, timestamp, target, digest: doku.digestOf(raw) },
        secretKey,
      );
      return request(createApp())
        .post(WEBHOOK)
        .set('Content-Type', 'application/json')
        .set('Client-Id', DOKU_TEST.clientId)
        .set('Request-Id', requestId)
        .set('Request-Timestamp', timestamp)
        .set('Signature', signature)
        .send(raw);
    }

    function successBody(invoiceNumber: string, amount: number | string) {
      return {
        service: { id: 'VIRTUAL_ACCOUNT' },
        acquirer: { id: 'BCA' },
        channel: { id: 'VIRTUAL_ACCOUNT_BCA' },
        transaction: { status: 'SUCCESS', date: '2026-10-01T03:24:23Z' },
        order: { invoice_number: invoiceNumber, amount },
      };
    }

    async function orderState(orderId: string) {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { payments: true, statusHistory: true },
      });
      return {
        status: order.status,
        paidAt: order.paidAt,
        payment: order.payments[0]!,
        paidTransitions: order.statusHistory.filter((h) => h.toStatus === 'paid').length,
      };
    }

    it('notifikasi SUCCESS bersignature valid: order paid, payload mentah tersimpan', async () => {
      const order = await pendingOrderWithPayment();
      const res = await notify(successBody('INV-TEST-0001', order.total));

      expect(res.status).toBe(200);
      expect(res.body.data.outcome).toBe('paid');
      expect(emailsFor('order-paid')).toEqual([order.id]);
      const state = await orderState(order.id);
      expect(state.status).toBe('paid');
      expect(state.paidAt).not.toBeNull();
      expect(state.payment).toMatchObject({
        status: 'SUCCESS',
        paymentMethod: 'VIRTUAL_ACCOUNT_BCA',
      });
      expect(state.payment.rawPayload).toMatchObject({
        order: { invoice_number: 'INV-TEST-0001' },
      });
    });

    it('notifikasi yang sama dua kali (juga bersamaan) hanya diproses sekali', async () => {
      const order = await pendingOrderWithPayment();
      const body = successBody('INV-TEST-0001', order.total);
      const [a, b] = await Promise.all([notify(body), notify(body)]);
      const again = await notify(body);

      expect([a.status, b.status, again.status]).toEqual([200, 200, 200]);
      expect(again.body.data.outcome).toBe('already-paid');
      expect((await orderState(order.id)).paidTransitions).toBe(1);
      expect(emailsFor('order-paid')).toEqual([order.id]);
    });

    it('signature tidak valid: 401 dan order tetap pending', async () => {
      const order = await pendingOrderWithPayment();
      const res = await notify(successBody('INV-TEST-0001', order.total), {
        secretKey: 'SK-milik-penyerang',
      });

      expect(res.status).toBe(401);
      const state = await orderState(order.id);
      expect(state.status).toBe('pending');
      expect(state.payment.status).toBe('PENDING');
      expect(state.payment.rawPayload).toBeNull();
    });

    it('nominal tidak cocok: tidak ditandai lunas', async () => {
      const order = await pendingOrderWithPayment();
      const res = await notify(successBody('INV-TEST-0001', order.total - 1000));

      expect(res.body.data.outcome).toBe('amount-mismatch');
      expect((await orderState(order.id)).status).toBe('pending');
    });

    it('nominal desimal dari QRIS ("170000.00") diterima', async () => {
      const order = await pendingOrderWithPayment();
      const res = await notify(successBody('INV-TEST-0001', `${order.total}.00`));
      expect(res.body.data.outcome).toBe('paid');
    });

    it('FAILED: payment gagal, order tetap pending agar pembeli bisa bayar lagi', async () => {
      const order = await pendingOrderWithPayment();
      const res = await notify({
        ...successBody('INV-TEST-0001', order.total),
        transaction: { status: 'FAILED' },
      });

      expect(res.body.data.outcome).toBe('failed');
      const state = await orderState(order.id);
      expect(state.status).toBe('pending');
      expect(state.payment.status).toBe('FAILED');
    });

    it('pembayaran sukses setelah order expired: dicatat, order tidak dibuka lagi', async () => {
      const order = await pendingOrderWithPayment();
      await transitionOrder(order.id, 'expired');
      const res = await notify(successBody('INV-TEST-0001', order.total));

      expect(res.body.data.outcome).toBe('paid-but-order-closed');
      const state = await orderState(order.id);
      expect(state.status).toBe('expired');
      expect(state.payment.status).toBe('SUCCESS');
    });

    it('invoice tidak dikenal: 404', async () => {
      const res = await notify(successBody('INV-TIDAK-ADA', 1000));
      expect(res.status).toBe(404);
    });
  });

  describe('jendela pembayaran (tidak bisa bayar setelah expired)', () => {
    const MINUTE = 60_000;

    async function orderExpiringIn(minutes: number) {
      const owner = await cartWith(`tamu-${randomUUID()}`);
      const order = await createOrder({ contact, address, shipping }, { owner, quoteShipping });
      await prisma.order.update({
        where: { id: order.id },
        data: { expiresAt: new Date(Date.now() + minutes * MINUTE) },
      });
      return order;
    }

    beforeEach(() => {
      createCheckoutPayment.mockClear();
    });

    it('halaman bayar DOKU ditutup 15 menit sebelum order expired', async () => {
      const order = await orderExpiringIn(180);
      const session = await startPayment(order.orderNumber, { token: order.accessToken });

      const dueMinutes = createCheckoutPayment.mock.calls[0]![0].dueMinutes;
      expect(dueMinutes).toBeGreaterThanOrEqual(164);
      expect(dueMinutes).toBeLessThanOrEqual(165);
      const orderExpires = (await prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
        .expiresAt;
      expect(orderExpires.getTime() - new Date(session.expiresAt).getTime()).toBeGreaterThanOrEqual(
        15 * MINUTE,
      );
    });

    it('membuka pembayaran lagi memakai sesi yang sama (tidak membuat invoice baru)', async () => {
      const order = await orderExpiringIn(180);
      const first = await startPayment(order.orderNumber, { token: order.accessToken });
      const second = await startPayment(order.orderNumber, { token: order.accessToken });

      expect(second.paymentUrl).toBe(first.paymentUrl);
      expect(createCheckoutPayment).toHaveBeenCalledTimes(1);
    });

    it('sisa waktu kurang dari 20 menit: sesi bayar baru ditolak tanpa memanggil DOKU', async () => {
      const order = await orderExpiringIn(19);
      await expect(
        startPayment(order.orderNumber, { token: order.accessToken }),
      ).rejects.toMatchObject({ code: 'ORDER_NOT_PAYABLE' });
      expect(createCheckoutPayment).not.toHaveBeenCalled();
    });

    it('order yang sudah expired tidak bisa dibayar', async () => {
      const order = await orderExpiringIn(180);
      await transitionOrder(order.id, 'expired');
      await expect(
        startPayment(order.orderNumber, { token: order.accessToken }),
      ).rejects.toMatchObject({ code: 'ORDER_NOT_PAYABLE' });
    });
  });

  describe('job expire-order', () => {
    async function overdueOrder(minutesOverdue: number, withPaymentSession = true) {
      const owner = await cartWith(`tamu-${randomUUID()}`);
      const order = await createOrder({ contact, address, shipping }, { owner, quoteShipping });
      await prisma.order.update({
        where: { id: order.id },
        data: { expiresAt: new Date(Date.now() - minutesOverdue * 60_000) },
      });
      if (withPaymentSession) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            invoiceNumber: `${order.orderNumber}-TEST`,
            amount: order.total,
            status: 'PENDING',
            paymentUrl: 'https://staging.doku.com/checkout-link-v2/x',
          },
        });
      }
      return order;
    }

    const statusOf = (status: string, amount: number) => async (invoiceNumber: string) => ({
      invoiceNumber,
      amount,
      status,
      channel: 'VIRTUAL_ACCOUNT_BCA',
      raw: { transaction: { status }, channel: { id: 'VIRTUAL_ACCOUNT_BCA' } },
    });

    async function statusOfOrder(id: string) {
      return (await prisma.order.findUniqueOrThrow({ where: { id } })).status;
    }

    it('belum dibayar: expired dan stok kembali', async () => {
      const order = await overdueOrder(1);
      const summary = await expireOverdueOrders(new Date(), statusOf('PENDING', order.total));

      expect(summary).toMatchObject({ expired: 1, paidLate: 0 });
      expect(await statusOfOrder(order.id)).toBe('expired');
      expect(await stock()).toBe(1);
    });

    it('ternyata sudah dibayar (webhook terlambat): menjadi paid, bukan expired', async () => {
      const order = await overdueOrder(1);
      const summary = await expireOverdueOrders(new Date(), statusOf('SUCCESS', order.total));

      expect(summary).toMatchObject({ expired: 0, paidLate: 1 });
      expect(await statusOfOrder(order.id)).toBe('paid');
      expect(emailsFor('order-paid')).toEqual([order.id]);
      expect(await stock()).toBe(0);
      // Metode bayar ikut tercatat walau lunasnya diketahui lewat cek status.
      const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
      expect(payment.paymentMethod).toBe('VIRTUAL_ACCOUNT_BCA');
    });

    it('DOKU tidak bisa dihubungi: ditunda, lalu di-expire setelah lewat 1 jam', async () => {
      const unreachable = async () => {
        throw new doku.DokuError(503, 'DOKU tidak bisa dihubungi');
      };
      const recent = await overdueOrder(5);
      expect(await expireOverdueOrders(new Date(), unreachable)).toMatchObject({ deferred: 1 });
      expect(await statusOfOrder(recent.id)).toBe('pending');

      await prisma.order.update({
        where: { id: recent.id },
        data: { expiresAt: new Date(Date.now() - 61 * 60_000) },
      });
      expect(await expireOverdueOrders(new Date(), unreachable)).toMatchObject({ expired: 1 });
      expect(await statusOfOrder(recent.id)).toBe('expired');
    });

    it('pembeli belum pernah membuka pembayaran: langsung expired tanpa cek DOKU', async () => {
      const order = await overdueOrder(1, false);
      const checkStatus = vi.fn();
      await expireOverdueOrders(new Date(), checkStatus);

      expect(checkStatus).not.toHaveBeenCalled();
      expect(await statusOfOrder(order.id)).toBe('expired');
    });

    it('order yang belum lewat batas tidak disentuh', async () => {
      const owner = await cartWith('tamu-baru');
      const order = await createOrder({ contact, address, shipping }, { owner, quoteShipping });
      await expireOverdueOrders(new Date(), statusOf('PENDING', order.total));
      expect(await statusOfOrder(order.id)).toBe('pending');
    });
  });

  describe('job complete-order', () => {
    async function deliveredAt(at: Date) {
      const owner = await cartWith(`tamu-${randomUUID()}`);
      const order = await createOrder({ contact, address, shipping }, { owner, quoteShipping });
      for (const to of ['paid', 'processing', 'shipped', 'delivered'] as const) {
        await transitionOrder(order.id, to, { now: at });
      }
      return order;
    }

    it('delivered lebih dari 3 hari: completed; yang belum 3 hari tidak disentuh', async () => {
      const { completeDeliveredOrders } = await import('../../jobs/complete-order.js');
      const now = new Date('2026-10-10T12:00:00Z');
      await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 5 } });
      const old = await deliveredAt(new Date('2026-10-07T11:59:00Z'));
      const recent = await deliveredAt(new Date('2026-10-07T12:01:00Z'));

      expect(await completeDeliveredOrders(now)).toBe(1);
      const status = async (id: string) =>
        (await prisma.order.findUniqueOrThrow({ where: { id } })).status;
      expect(await status(old.id)).toBe('completed');
      expect(await status(recent.id)).toBe('delivered');
      const last = await prisma.orderStatusHistory.findFirstOrThrow({
        where: { orderId: old.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(last).toMatchObject({ toStatus: 'completed', changedById: null });

      // Dijalankan ulang: tidak ada yang diproses dua kali.
      expect(await completeDeliveredOrders(now)).toBe(0);
    });
  });

  describe('admin pesanan', () => {
    async function sessionCookie(role: 'ADMIN' | 'OWNER' | 'CUSTOMER') {
      const user = await prisma.user.create({
        data: {
          email: `${role.toLowerCase()}-${randomUUID()}@toko.test`,
          name: `Uji ${role}`,
          passwordHash: 'x',
          role,
        },
      });
      return `session=${await signSessionToken({ userId: user.id, tokenVersion: user.tokenVersion })}`;
    }

    async function paidOrder() {
      const owner = await cartWith(`tamu-${randomUUID()}`);
      const order = await createOrder({ contact, address, shipping }, { owner, quoteShipping });
      await transitionOrder(order.id, 'paid');
      return order;
    }

    const api = () => request(createApp());

    it('tanpa sesi 401, akun pembeli 403', async () => {
      const order = await paidOrder();
      expect((await api().get('/api/admin/orders')).status).toBe(401);
      const customer = await sessionCookie('CUSTOMER');
      const res = await api()
        .post(`/api/admin/orders/${order.orderNumber}/process`)
        .set('Cookie', customer);
      expect(res.status).toBe(403);
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
        'paid',
      );
    });

    it('alur penuh: proses → kirim dengan resi → diterima, tercatat siapa yang mengubah', async () => {
      const admin = await sessionCookie('ADMIN');
      const order = await paidOrder();
      const base = `/api/admin/orders/${order.orderNumber}`;

      expect(
        (await api().post(`${base}/process`).set('Cookie', admin)).body.data.order.status,
      ).toBe('processing');

      const tanpaResi = await api().post(`${base}/ship`).set('Cookie', admin).send({});
      expect(tanpaResi.status).toBe(400);

      const shipped = await api()
        .post(`${base}/ship`)
        .set('Cookie', admin)
        .send({ trackingNumber: 'jp1234567890' });
      expect(shipped.body.data.order.status).toBe('shipped');
      expect(shipped.body.data.order.shipping.trackingNumber).toBe('JP1234567890');
      expect(emailsFor('order-shipped')).toEqual([order.id]);

      const delivered = await api().post(`${base}/deliver`).set('Cookie', admin);
      const detail = delivered.body.data.order;
      expect(detail.status).toBe('delivered');
      expect(emailsFor('order-delivered')).toEqual([order.id]);
      expect(detail.history.map((h: { toStatus: string }) => h.toStatus)).toEqual([
        'pending',
        'paid',
        'processing',
        'shipped',
        'delivered',
      ]);
      expect(detail.history.at(-1).changedBy).toBe('Uji ADMIN');
      expect(detail.history[3].note).toBe('Resi JP1234567890');

      // Pesanan yang sudah dikirim tidak bisa dibatalkan.
      const cancel = await api()
        .post(`${base}/cancel`)
        .set('Cookie', admin)
        .send({ reason: 'Coba batal' });
      expect(cancel.status).toBe(409);
    });

    it('isi email dibaca saat dikirim: resi terbaru ikut, "silakan bayar" dilewati bila sudah lunas', async () => {
      const { sendOrderEmail } = await import('../email/order-email.service.js');
      const send = vi.fn(async (_message: { to: string; text: string }) => 'sent' as const);
      const order = await paidOrder();
      await prisma.order.update({
        where: { id: order.id },
        data: { trackingNumber: 'JP0000111122', status: 'shipped' },
      });

      expect(await sendOrderEmail('order-created', order.id, send)).toBe('stale');
      expect(send).not.toHaveBeenCalled();

      expect(await sendOrderEmail('order-shipped', order.id, send)).toBe('sent');
      const message = send.mock.calls[0]![0];
      expect(message.to).toBe(contact.email);
      expect(message.text).toContain('JP0000111122');
      expect(message.text).toContain(`/pesanan/${order.orderNumber}?token=`);

      expect(await sendOrderEmail('order-paid', 'tidak-ada', send)).toBe('order-missing');
    });

    it('resi tidak bisa diinput sebelum pesanan diproses', async () => {
      const admin = await sessionCookie('ADMIN');
      const order = await paidOrder();
      const res = await api()
        .post(`/api/admin/orders/${order.orderNumber}/ship`)
        .set('Cookie', admin)
        .send({ trackingNumber: 'JP1234567890' });
      expect(res.status).toBe(409);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).trackingNumber,
      ).toBeNull();
    });

    it('batalkan pesanan yang sudah dibayar: stok kembali, alasan tercatat', async () => {
      const owner = await sessionCookie('OWNER');
      const order = await paidOrder();
      expect(await stock()).toBe(0);

      const res = await api()
        .post(`/api/admin/orders/${order.orderNumber}/cancel`)
        .set('Cookie', owner)
        .send({ reason: 'Stok rusak di gudang' });
      expect(res.body.data.order.status).toBe('cancelled');
      expect(res.body.data.order.history.at(-1).note).toBe(
        'Dibatalkan admin: Stok rusak di gudang',
      );
      expect(await stock()).toBe(1);
    });

    it('daftar pesanan: filter status, cari, dan hitungan per status', async () => {
      const admin = await sessionCookie('ADMIN');
      await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 5 } });
      const paid = await paidOrder();
      const owner = await cartWith('tamu-pending');
      await createOrder(
        { contact: { ...contact, name: 'Sari Pending' }, address, shipping },
        { owner, quoteShipping },
      );

      const all = (await api().get('/api/admin/orders').set('Cookie', admin)).body.data;
      expect(all.total).toBe(2);
      expect(all.countsByStatus).toMatchObject({ paid: 1, pending: 1, shipped: 0 });

      const onlyPaid = (await api().get('/api/admin/orders?status=paid').set('Cookie', admin)).body
        .data;
      expect(onlyPaid.items.map((o: { orderNumber: string }) => o.orderNumber)).toEqual([
        paid.orderNumber,
      ]);
      // Hitungan per status tidak ikut tersaring oleh filter status.
      expect(onlyPaid.countsByStatus.pending).toBe(1);

      const search = (await api().get('/api/admin/orders?q=sari').set('Cookie', admin)).body.data;
      expect(search.items.map((o: { customerName: string }) => o.customerName)).toEqual([
        'Sari Pending',
      ]);
    });

    describe('voucher', () => {
      const voucherBody = (overrides: Record<string, unknown> = {}) => ({
        code: 'lari10',
        type: 'PERCENT',
        value: 10,
        maxDiscount: 12000,
        minPurchase: 100000,
        quota: 2,
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 3_600_000).toISOString(),
        isActive: true,
        ...overrides,
      });

      it('dibuat admin lalu dipakai checkout: potongan persen dibatasi maxDiscount', async () => {
        const admin = await sessionCookie('ADMIN');
        const created = await api()
          .post('/api/admin/vouchers')
          .set('Cookie', admin)
          .send(voucherBody());
        expect(created.status).toBe(201);
        expect(created.body.data.voucher).toMatchObject({
          code: 'LARI10',
          state: 'active',
          usedCount: 0,
        });

        const owner = await cartWith('tamu-voucher');
        const order = await createOrder(
          { contact, address, shipping, voucherCode: 'LARI10' },
          { owner, quoteShipping },
        );
        // 10% dari 150.000 = 15.000, dibatasi 12.000; ongkir tidak dipotong.
        expect(order.total).toBe(150000 - 12000 + 20000);

        const list = (await api().get('/api/admin/vouchers').set('Cookie', admin)).body.data
          .vouchers;
        expect(list[0]).toMatchObject({ code: 'LARI10', usedCount: 1 });
      });

      it('kode ganda 409, kuota di bawah yang terpakai ditolak, akun pembeli 403', async () => {
        const admin = await sessionCookie('ADMIN');
        const created = (
          await api().post('/api/admin/vouchers').set('Cookie', admin).send(voucherBody())
        ).body.data.voucher;
        await prisma.voucher.update({ where: { id: created.id }, data: { usedCount: 2 } });

        const duplicate = await api()
          .post('/api/admin/vouchers')
          .set('Cookie', admin)
          .send(voucherBody());
        expect(duplicate.status).toBe(409);

        const lowerQuota = await api()
          .put(`/api/admin/vouchers/${created.id}`)
          .set('Cookie', admin)
          .send(voucherBody({ quota: 1 }));
        expect(lowerQuota.status).toBe(400);
        expect(lowerQuota.body.error.message).toBe(
          'Kuota tidak boleh kurang dari yang sudah terpakai (2)',
        );

        const raised = await api()
          .put(`/api/admin/vouchers/${created.id}`)
          .set('Cookie', admin)
          .send(voucherBody({ quota: 5, value: 15 }));
        expect(raised.body.data.voucher).toMatchObject({ quota: 5, value: 15, usedCount: 2 });

        const customer = await sessionCookie('CUSTOMER');
        expect((await api().get('/api/admin/vouchers').set('Cookie', customer)).status).toBe(403);
      });
    });

    describe('produk', () => {
      const newProduct = (overrides: Record<string, unknown> = {}) => ({
        sku: 'tss009-1',
        name: 'Kaos Training Baru',
        categoryId: null,
        description: 'Bahan dry-fit.',
        seoTitle: null,
        brand: '3ON',
        gender: null,
        sportType: null,
        motif: null,
        sleeveLength: null,
        lengthCm: 20,
        widthCm: 10,
        heightCm: null,
        isActive: true,
        variants: [
          { size: 'L', price: 159000, stock: 4, weightGram: 200 },
          { size: 'M', price: 149000, stock: 3, weightGram: 200 },
        ],
        ...overrides,
      });

      async function png(): Promise<Buffer> {
        return sharp({
          create: { width: 1600, height: 1600, channels: 3, background: '#d946ef' },
        })
          .png()
          .toBuffer();
      }

      function filesUploaded(): string[] {
        const dir = path.join(uploadsDir, 'products', 'TSS009-1');
        return existsSync(dir) ? readdirSync(dir) : [];
      }

      it('buat produk: SKU ukuran diturunkan dari SKU induk, slug dari nama, SKU ganda 409', async () => {
        const admin = await sessionCookie('ADMIN');
        const res = await api().post('/api/admin/products').set('Cookie', admin).send(newProduct());
        expect(res.status).toBe(201);
        const product = res.body.data.product;
        expect(product).toMatchObject({ sku: 'TSS009-1', slug: 'kaos-training-baru' });
        expect(product.variants.map((v: { sku: string }) => v.sku)).toEqual([
          'TSS009-1-M',
          'TSS009-1-L',
        ]);

        const dup = await api().post('/api/admin/products').set('Cookie', admin).send(newProduct());
        expect(dup.status).toBe(409);
      });

      it('ganti nama tidak mengubah slug; slug baru hanya bila diisi sendiri', async () => {
        const admin = await sessionCookie('ADMIN');
        const created = (
          await api().post('/api/admin/products').set('Cookie', admin).send(newProduct())
        ).body.data.product;
        const {
          variants: _v,
          images: _i,
          id: _id,
          sku: _sku,
          sizeChartUrl: _s,
          ...fields
        } = created;

        const renamed = await api()
          .put(`/api/admin/products/${created.id}`)
          .set('Cookie', admin)
          .send({ ...fields, name: 'Kaos Training Edisi 2' });
        expect(renamed.body.data.product).toMatchObject({
          name: 'Kaos Training Edisi 2',
          slug: 'kaos-training-baru',
        });
      });

      it('ubah stok dengan pengaman: ditolak bila stok berubah karena pesanan masuk', async () => {
        const admin = await sessionCookie('ADMIN');
        // Varian M dari data test (stok 1); seolah admin melihat 1 lalu ada yang checkout.
        const owner = await cartWith('tamu-stok');
        await createOrder({ contact, address, shipping }, { owner, quoteShipping });
        expect(await stock()).toBe(0);

        const stale = await api()
          .put(`/api/admin/variants/${variantId}/stock`)
          .set('Cookie', admin)
          .send({ expected: 1, stock: 10 });
        expect(stale.status).toBe(409);
        expect(stale.body.error.code).toBe('STOCK_CHANGED');
        expect(await stock()).toBe(0);

        const fresh = await api()
          .put(`/api/admin/variants/${variantId}/stock`)
          .set('Cookie', admin)
          .send({ expected: 0, stock: 10 });
        expect(fresh.status).toBe(200);
        expect(await stock()).toBe(10);
      });

      it('foto: diunggah jadi WebP maks. 1200 px, bisa diurutkan dan dihapus (file ikut terhapus)', async () => {
        const admin = await sessionCookie('ADMIN');
        const created = (
          await api().post('/api/admin/products').set('Cookie', admin).send(newProduct())
        ).body.data.product;
        const upload = () =>
          png().then((buf) =>
            api()
              .post(`/api/admin/products/${created.id}/images`)
              .set('Cookie', admin)
              .set('Content-Type', 'image/png')
              .send(buf),
          );

        await upload();
        const second = await upload();
        expect(second.status).toBe(201);
        const images = second.body.data.product.images as { id: string; url: string }[];
        expect(images).toHaveLength(2);
        expect(images.every((i) => i.url.endsWith('.webp'))).toBe(true);
        expect(filesUploaded()).toHaveLength(2);
        // Dibaca ke memori dulu: sharp menahan file yang dibukanya, dan di Windows file itu
        // jadi tidak bisa dihapus (EBUSY).
        const meta = await sharp(
          readFileSync(path.join(uploadsDir, 'products', 'TSS009-1', filesUploaded()[0]!)),
        ).metadata();
        expect(meta).toMatchObject({ format: 'webp', width: 1200, height: 1200 });

        const reordered = await api()
          .put(`/api/admin/products/${created.id}/images/order`)
          .set('Cookie', admin)
          .send({ imageIds: [images[1]!.id, images[0]!.id] });
        expect(reordered.body.data.product.images[0].id).toBe(images[1]!.id);

        await api().delete(`/api/admin/images/${images[0]!.id}`).set('Cookie', admin);
        expect(filesUploaded()).toHaveLength(1);

        const notImage = await api()
          .post(`/api/admin/products/${created.id}/images`)
          .set('Cookie', admin)
          .set('Content-Type', 'image/png')
          .send(Buffer.from('bukan gambar'));
        expect(notImage.status).toBe(400);
      });

      it('kategori: buat, nama ganda ditolak, ganti nama tidak mengubah slug', async () => {
        const admin = await sessionCookie('ADMIN');
        const body = { name: 'Sepatu Lari', isActive: true, sortOrder: 5 };
        const created = await api().post('/api/admin/categories').set('Cookie', admin).send(body);
        const category = created.body.data.categories.find(
          (c: { name: string }) => c.name === 'Sepatu Lari',
        );
        expect(category.slug).toBe('sepatu-lari');

        expect(
          (await api().post('/api/admin/categories').set('Cookie', admin).send(body)).status,
        ).toBe(409);

        const renamed = await api()
          .put(`/api/admin/categories/${category.id}`)
          .set('Cookie', admin)
          .send({ ...body, name: 'Sepatu' });
        expect(
          renamed.body.data.categories.find((c: { id: string }) => c.id === category.id),
        ).toMatchObject({ name: 'Sepatu', slug: 'sepatu-lari' });
      });
    });
  });

  describe('akun pembeli', () => {
    const api = () => request(createApp());

    async function member(password = 'rahasia-123') {
      const { hashPassword } = await import('../../lib/password.js');
      const user = await prisma.user.create({
        data: {
          email: `member-${randomUUID()}@mail.com`,
          name: 'Member Uji',
          passwordHash: await hashPassword(password),
        },
      });
      const token = await signSessionToken({ userId: user.id, tokenVersion: user.tokenVersion });
      return { user, cookie: `session=${token}`, password };
    }

    async function memberCart(userId: string) {
      await prisma.cart.create({
        data: { userId, token: randomUUID(), items: { create: { variantId, quantity: 1 } } },
      });
      return { userId };
    }

    const addressBody = (n: number) => ({ ...address, label: `Alamat ${n}` });

    it('buku alamat: maks. 5, alamat pertama jadi utama, hapus utama memindahkan utama', async () => {
      const { cookie } = await member();
      for (let n = 1; n <= 5; n++) {
        const res = await api()
          .post('/api/account/addresses')
          .set('Cookie', cookie)
          .send(addressBody(n));
        expect(res.status).toBe(201);
      }
      const full = await api()
        .post('/api/account/addresses')
        .set('Cookie', cookie)
        .send(addressBody(6));
      expect(full.status).toBe(409);
      expect(full.body.error.code).toBe('ADDRESS_BOOK_FULL');

      const list = (await api().get('/api/account/addresses').set('Cookie', cookie)).body.data
        .addresses as { id: string; label: string; isDefault: boolean; city: string }[];
      expect(list).toHaveLength(5);
      expect(list[0]).toMatchObject({ label: 'Alamat 1', isDefault: true, city: 'Bandung' });

      const afterDelete = await api()
        .delete(`/api/account/addresses/${list[0]!.id}`)
        .set('Cookie', cookie);
      expect(afterDelete.body.data.addresses[0]).toMatchObject({
        label: 'Alamat 2',
        isDefault: true,
      });

      // Alamat milik orang lain tidak bisa disentuh.
      const other = await member();
      const foreign = await api()
        .delete(`/api/account/addresses/${list[1]!.id}`)
        .set('Cookie', other.cookie);
      expect(foreign.status).toBe(404);
    });

    it('tambah alamat bersamaan tidak bisa melewati batas 5', async () => {
      const { user, cookie } = await member();
      await Promise.all(
        Array.from({ length: 8 }, (_, n) =>
          api().post('/api/account/addresses').set('Cookie', cookie).send(addressBody(n)),
        ),
      );
      expect(await prisma.address.count({ where: { userId: user.id } })).toBe(5);
      expect(await prisma.address.count({ where: { userId: user.id, isDefault: true } })).toBe(1);
    });

    it('checkout member: alamat disimpan bila diminta, pesanan muncul di riwayat', async () => {
      const { user, cookie } = await member();
      const order = await createOrder(
        { contact, address, shipping, saveAddress: true },
        { owner: await memberCart(user.id), quoteShipping },
      );

      const saved = await prisma.address.findMany({ where: { userId: user.id } });
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({ street: address.street, isDefault: true });

      const history = await api().get('/api/account/orders').set('Cookie', cookie);
      expect(history.body.data).toMatchObject({ total: 1 });
      expect(history.body.data.items[0]).toMatchObject({
        orderNumber: order.orderNumber,
        status: 'pending',
        itemCount: 1,
        firstItemName: 'Kaos Lari',
      });
    });

    it('buat akun dari pesanan tamu: hanya setelah bayar, dengan token, sekali saja', async () => {
      const owner = await cartWith('tamu-akun');
      const order = await createOrder({ contact, address, shipping }, { owner, quoteShipping });
      const claim = (token: string) =>
        api()
          .post(`/api/orders/${order.orderNumber}/account`)
          .send({ token, password: 'password-baru-1' });

      expect((await claim(order.accessToken)).body.error.code).toBe('ORDER_NOT_PAID');
      await transitionOrder(order.id, 'paid');
      expect((await claim('token-salah')).status).toBe(404);

      const created = await claim(order.accessToken);
      expect(created.status).toBe(201);
      expect(String(created.headers['set-cookie'])).toMatch(/^session=/);
      expect(created.body.data.user).toMatchObject({
        email: contact.email,
        name: contact.name,
        phone: contact.phone,
        role: 'CUSTOMER',
      });
      const linked = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(linked.userId).toBe(created.body.data.user.id);
      expect(await prisma.address.count({ where: { userId: linked.userId! } })).toBe(1);

      expect((await claim(order.accessToken)).body.error.code).toBe('ALREADY_LINKED');
    });

    it('buat akun dari pesanan: email yang sudah terdaftar diminta masuk', async () => {
      await prisma.user.create({
        data: { email: contact.email, name: 'Sudah Ada', passwordHash: 'x' },
      });
      const owner = await cartWith('tamu-akun-2');
      const order = await createOrder({ contact, address, shipping }, { owner, quoteShipping });
      await transitionOrder(order.id, 'paid');
      const res = await api()
        .post(`/api/orders/${order.orderNumber}/account`)
        .send({ token: order.accessToken, password: 'password-baru-1' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
      const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(unchanged.userId).toBeNull();
    });

    it('hapus akun: perlu password, ditolak selama ada pesanan berjalan, pesanan tetap tersimpan', async () => {
      const { user, cookie, password } = await member();
      const order = await createOrder(
        { contact, address, shipping, saveAddress: true },
        { owner: await memberCart(user.id), quoteShipping },
      );
      const remove = (pw: string) =>
        api().delete('/api/account').set('Cookie', cookie).send({ password: pw });

      expect((await remove('salah-password')).status).toBe(401);
      expect((await remove(password)).body.error.code).toBe('ACTIVE_ORDERS');

      await transitionOrder(order.id, 'expired');
      const deleted = await remove(password);
      expect(deleted.status).toBe(200);
      expect(String(deleted.headers['set-cookie'])).toMatch(/^session=;/);

      expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
      expect(await prisma.address.count({ where: { userId: user.id } })).toBe(0);
      const kept = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(kept).toMatchObject({ userId: null, customerEmail: contact.email });

      // Sesi lama tidak berlaku lagi.
      expect((await api().get('/api/account/orders').set('Cookie', cookie)).status).toBe(401);
    });

    it('akun admin tidak bisa dihapus lewat halaman akun', async () => {
      const { user, cookie, password } = await member();
      await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      const res = await api().delete('/api/account').set('Cookie', cookie).send({ password });
      expect(res.status).toBe(403);
    });
  });

  describe('dashboard admin (F-22)', () => {
    // 15 Okt 2026 12:00 WIB
    const now = new Date('2026-10-15T05:00:00Z');

    async function orderPaidAt(paidAt: Date | null) {
      const owner = await cartWith(`tamu-${randomUUID()}`);
      const order = await createOrder(
        { contact, address, shipping },
        { owner, quoteShipping, now: new Date('2026-09-01T00:00:00Z') },
      );
      if (paidAt) await transitionOrder(order.id, 'paid', { now: paidAt });
      return order;
    }

    it('omzet hari ini & bulan ini mengikuti WIB; pending dan batal tidak dihitung', async () => {
      const { getAdminDashboard } = await import('./admin-dashboard.service.js');
      await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 10 } });

      await orderPaidAt(new Date('2026-10-14T17:30:00Z')); // 15 Okt 00.30 WIB: hari ini
      await orderPaidAt(new Date('2026-10-14T16:30:00Z')); // 14 Okt 23.30 WIB: kemarin
      await orderPaidAt(new Date('2026-09-30T18:00:00Z')); // 1 Okt 01.00 WIB: bulan ini
      await orderPaidAt(new Date('2026-09-30T16:00:00Z')); // 30 Sep 23.00 WIB: bulan lalu
      await orderPaidAt(null); // pending
      const cancelled = await orderPaidAt(new Date('2026-10-15T01:00:00Z'));
      await transitionOrder(cancelled.id, 'cancelled', { now });

      const d = await getAdminDashboard(now);
      // Total tiap order: Rp150.000 + ongkir Rp20.000.
      expect(d.today).toEqual({ revenue: 170000, orders: 1 });
      expect(d.thisMonth).toEqual({ revenue: 510000, orders: 3 });
      expect(d.daily).toHaveLength(30);
      expect(d.daily[0]!.date).toBe('2026-09-16');
      expect(d.daily.at(-1)).toEqual({ date: '2026-10-15', revenue: 170000, orders: 1 });
      expect(d.daily.find((x) => x.date === '2026-10-14')!.revenue).toBe(170000);
      expect(d.daily.find((x) => x.date === '2026-09-30')!.revenue).toBe(170000);
      expect(d.countsByStatus).toMatchObject({ paid: 4, pending: 1, cancelled: 1, shipped: 0 });

      // Terlaris: hanya pesanan lunas, dihitung per produk.
      expect(d.topProducts).toEqual([
        expect.objectContaining({ productId, name: 'Kaos Lari', quantity: 4, revenue: 600000 }),
      ]);

      // Stok 10 − 6 dipesan + 1 dikembalikan (batal) = 5: belum menipis.
      expect(d.lowStock).toEqual([]);
      await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 2 } });
      expect((await getAdminDashboard(now)).lowStock).toEqual([
        { productId, productName: 'Kaos Lari', size: 'M', sku: 'TSS001-1-M', stock: 2 },
      ]);
    });

    it('hanya untuk admin', async () => {
      const api = () => request(createApp());
      expect((await api().get('/api/admin/dashboard')).status).toBe(401);
    });
  });

  describe('reset password (F-17)', () => {
    const api = () => request(createApp());

    async function userWithPassword() {
      const { hashPassword } = await import('../../lib/password.js');
      return prisma.user.create({
        data: {
          email: `lupa-${randomUUID()}@mail.com`,
          name: 'Pelupa',
          passwordHash: await hashPassword('password-lama-1'),
        },
      });
    }

    function tokenFrom(text: string): string {
      const match = /reset-password\?token=([A-Za-z0-9_-]+)/.exec(text);
      if (!match) throw new Error('Tautan reset tidak ada di email');
      return match[1]!;
    }

    it('email tidak terdaftar: tidak ada token dan tidak ada email', async () => {
      const { requestPasswordReset } = await import('../auth/password-reset.service.js');
      const send = vi.fn(async (_m: { to: string; text: string }) => 'sent' as const);
      await requestPasswordReset('tidak-ada@mail.com', new Date(), send);
      expect(send).not.toHaveBeenCalled();
      expect(await prisma.passwordResetToken.count()).toBe(0);
    });

    it('alur penuh: tautan di email, password baru berlaku, sesi lama keluar, token sekali pakai', async () => {
      const { requestPasswordReset, resetPassword } =
        await import('../auth/password-reset.service.js');
      const user = await userWithPassword();
      const oldCookie = `session=${await signSessionToken({ userId: user.id, tokenVersion: user.tokenVersion })}`;
      const send = vi.fn(async (_m: { to: string; text: string }) => 'sent' as const);

      await requestPasswordReset(user.email, new Date(), send);
      expect(send).toHaveBeenCalledTimes(1);
      const message = send.mock.calls[0]![0];
      expect(message.to).toBe(user.email);
      const token = tokenFrom(message.text);
      // Yang disimpan hanya hash-nya.
      const stored = await prisma.passwordResetToken.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(stored.tokenHash).not.toBe(token);

      const res = await api()
        .post('/api/auth/password/reset')
        .send({ token, password: 'password-baru-9' });
      expect(res.status).toBe(200);
      expect(String(res.headers['set-cookie'])).toMatch(/^session=/);

      expect((await api().get('/api/account/orders').set('Cookie', oldCookie)).status).toBe(401);
      const oldLogin = await api()
        .post('/api/auth/login')
        .send({ email: user.email, password: 'password-lama-1' });
      expect(oldLogin.status).toBe(401);
      const newLogin = await api()
        .post('/api/auth/login')
        .send({ email: user.email, password: 'password-baru-9' });
      expect(newLogin.status).toBe(200);

      await expect(resetPassword(token, 'password-lain-7')).rejects.toMatchObject({
        code: 'RESET_TOKEN_INVALID',
      });
    });

    it('token kedaluwarsa setelah 60 menit; meminta token baru tidak membuka token lama yang terpakai', async () => {
      const { requestPasswordReset, resetPassword } =
        await import('../auth/password-reset.service.js');
      const user = await userWithPassword();
      const send = vi.fn(async (_m: { to: string; text: string }) => 'sent' as const);
      const issuedAt = new Date('2026-10-02T10:00:00Z');
      await requestPasswordReset(user.email, issuedAt, send);
      const token = tokenFrom(send.mock.calls[0]![0].text);

      await expect(
        resetPassword(token, 'password-baru-9', new Date('2026-10-02T11:00:00Z')),
      ).rejects.toMatchObject({ code: 'RESET_TOKEN_INVALID' });
      await expect(
        resetPassword(token, 'password-baru-9', new Date('2026-10-02T10:59:00Z')),
      ).resolves.toMatchObject({ email: user.email });
    });

    it('endpoint lupa password: balasan sama untuk email terdaftar dan tidak', async () => {
      const user = await userWithPassword();
      const known = await api().post('/api/auth/password/forgot').send({ email: user.email });
      const unknown = await api()
        .post('/api/auth/password/forgot')
        .send({ email: 'tidak-ada@mail.com' });
      expect(known.status).toBe(200);
      expect(known.body).toEqual(unknown.body);
    });
  });
});
