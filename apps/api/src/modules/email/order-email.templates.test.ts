import { describe, expect, it } from 'vitest';
import { routeMail } from '../../lib/mailer.js';
import { renderOrderEmail, type OrderEmailData } from './order-email.templates.js';

const order: OrderEmailData = {
  orderNumber: '3ON-261002-AB12',
  customerName: 'Rina <script>',
  orderUrl: 'http://localhost:3000/pesanan/3ON-261002-AB12?token=abc&x=1',
  items: [
    { name: '3ON Women Flow Short Black', variant: 'Ukuran M', quantity: 2, subtotal: 419800 },
  ],
  subtotal: 419800,
  shippingCost: 18000,
  discount: 20000,
  total: 417800,
  courier: 'jne',
  courierService: 'REG',
  trackingNumber: 'JNE1234567890',
  // 2 Okt 2026 15:30 UTC = 22:30 WIB
  expiresAt: new Date('2026-10-02T15:30:00Z'),
  address: { recipient: 'Rina', phone: '081234567890', full: 'Jl. Merdeka 1, Coblong, Bandung' },
};

describe('email transaksi (F-14)', () => {
  it('order dibuat: batas bayar dalam WIB, tautan bayar, dan rincian total', () => {
    const email = renderOrderEmail('order-created', order);
    expect(email.subject).toBe('Selesaikan pembayaran pesanan 3ON-261002-AB12');
    expect(email.text).toContain('22.30 WIB');
    expect(email.text).toContain(`Bayar Sekarang: ${order.orderUrl}`);
    expect(email.text).toContain('Potongan voucher: -Rp');
    expect(email.text).toMatch(/Total: Rp\s?417\.800/);
    expect(email.html).toContain(
      'href="http://localhost:3000/pesanan/3ON-261002-AB12?token=abc&amp;x=1"',
    );
  });

  it('isi dari pembeli di-escape di HTML', () => {
    const { html } = renderOrderEmail('order-paid', order);
    expect(html).not.toContain('<script>');
    expect(html).toContain('Rina &lt;script&gt;');
  });

  it('dikirim: menampilkan nomor resi dan tautan lacak situs kurir', () => {
    const email = renderOrderEmail('order-shipped', order);
    expect(email.subject).toBe('Pesanan 3ON-261002-AB12 sedang dikirim');
    expect(email.text).toContain('Nomor resi JNE: JNE1234567890');
    expect(email.text).toContain('https://www.jne.co.id/tracking-package');
  });

  it('tanpa potongan, baris voucher tidak ditampilkan', () => {
    const email = renderOrderEmail('order-paid', { ...order, discount: 0 });
    expect(email.text).not.toContain('Potongan voucher');
  });

  it('diterima: tanpa rincian harga', () => {
    const email = renderOrderEmail('order-delivered', order);
    expect(email.subject).toBe('Pesanan 3ON-261002-AB12 telah diterima');
    expect(email.text).not.toContain('Total:');
  });
});

describe('pengalihan email di luar production', () => {
  const message = { to: 'pembeli@contoh.id', subject: 'Halo', html: '', text: '' };

  it('production: dikirim ke pembeli apa adanya, walau alamat pengalihan diisi', () => {
    expect(routeMail(message, { production: true, redirectTo: 'dev@contoh.id' })).toEqual(message);
  });

  it('development: dialihkan ke developer dengan penanda alamat asli', () => {
    expect(routeMail(message, { production: false, redirectTo: 'dev@contoh.id' })).toMatchObject({
      to: 'dev@contoh.id',
      subject: '[DEV → pembeli@contoh.id] Halo',
    });
  });

  it('development tanpa alamat pengalihan: tidak dikirim sama sekali', () => {
    expect(routeMail(message, { production: false, redirectTo: undefined })).toBeNull();
  });
});
