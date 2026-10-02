/**
 * Test integrasi dengan PostgreSQL sungguhan: pengurangan stok bersyarat, kuota voucher,
 * transisi status, dan webhook DOKU tidak bisa diuji dengan mock. Dilewati bila
 * TEST_DATABASE_URL kosong. Semua test database ada di satu file ini agar tidak berjalan
 * paralel dan saling mengosongkan tabel.
 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// Hanya tipe: modulnya baru dimuat di beforeAll, setelah DATABASE_URL diganti.
import type * as AppModule from '../../app.js';
import type * as ExpireModule from '../../jobs/expire-order.js';
import type * as PaymentModule from '../payment/payment.service.js';
import type * as DokuModule from '../../lib/doku.js';
import type * as HttpErrorModule from '../../lib/http-error.js';
import type * as PrismaModule from '../../lib/prisma.js';
import type * as OrderServiceModule from './order.service.js';
import type * as TransitionModule from './order.transition.js';

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

  // Kredensial palsu khusus test; kredensial sandbox asli di .env tidak dipakai.
  const DOKU_TEST = { clientId: 'BRN-TEST-0001', secretKey: 'SK-test-rahasia' };
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
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "OrderStatusHistory", "OrderItem", "Payment", "Order", "CartItem", "Cart", "Voucher", "ProductVariant", "ProductImage", "Product", "Category", "District", "City", "Province" CASCADE',
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
});
