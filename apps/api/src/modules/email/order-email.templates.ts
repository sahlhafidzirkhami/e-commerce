/**
 * Template email transaksi (F-14). Fungsi murni: data order → subjek, HTML, dan teks polos.
 * HTML memakai tabel dan style inline karena banyak klien email mengabaikan <style>.
 */
import { courierName, courierTrackingUrl } from '@sportswear/shared';

export const ORDER_EMAIL_KINDS = [
  'order-created',
  'order-paid',
  'order-shipped',
  'order-delivered',
] as const;
export type OrderEmailKind = (typeof ORDER_EMAIL_KINDS)[number];

export interface OrderEmailData {
  orderNumber: string;
  customerName: string;
  /** Tautan halaman pesanan, berisi token akses agar tamu pun bisa membuka. */
  orderUrl: string;
  items: { name: string; variant: string; quantity: number; subtotal: number }[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  courier: string;
  courierService: string;
  trackingNumber: string | null;
  expiresAt: Date;
  address: { recipient: string; phone: string; full: string };
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Email adalah lapisan tampilan; formatnya sama dengan frontend.
const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});
const wib = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatRupiah(amount: number): string {
  return rupiah.format(amount);
}

export function formatWib(date: Date): string {
  return `${wib.format(date)} WIB`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Content {
  subject: string;
  heading: string;
  /** Paragraf pembuka; teks polos (di-escape saat dirender). */
  intro: string[];
  /** Kotak sorotan, mis. batas bayar atau nomor resi. */
  highlight?: { label: string; value: string; note?: string };
  button: { label: string; url: string };
  secondaryLink?: { label: string; url: string };
  showSummary: boolean;
  showAddress: boolean;
}

function contentFor(kind: OrderEmailKind, o: OrderEmailData): Content {
  const courier = `${courierName(o.courier)} ${o.courierService}`;
  switch (kind) {
    case 'order-created':
      return {
        subject: `Selesaikan pembayaran pesanan ${o.orderNumber}`,
        heading: 'Pesanan Anda sudah kami terima',
        intro: [
          `Halo ${o.customerName}, terima kasih sudah berbelanja di 3ON SportsWear.`,
          'Stok sudah kami simpan untuk Anda. Selesaikan pembayaran sebelum batas waktu, setelah itu pesanan dibatalkan otomatis.',
        ],
        highlight: { label: 'Bayar sebelum', value: formatWib(o.expiresAt) },
        button: { label: 'Bayar Sekarang', url: o.orderUrl },
        showSummary: true,
        showAddress: true,
      };
    case 'order-paid':
      return {
        subject: `Pembayaran diterima: pesanan ${o.orderNumber}`,
        heading: 'Pembayaran berhasil',
        intro: [
          `Halo ${o.customerName}, pembayaran untuk pesanan ${o.orderNumber} sudah kami terima.`,
          `Pesanan segera kami kemas dan kirim dengan ${courier}. Nomor resi akan kami kirim lewat email.`,
        ],
        highlight: { label: 'Total dibayar', value: formatRupiah(o.total) },
        button: { label: 'Lihat Pesanan', url: o.orderUrl },
        showSummary: true,
        showAddress: true,
      };
    case 'order-shipped': {
      const trackingUrl = courierTrackingUrl(o.courier);
      return {
        subject: `Pesanan ${o.orderNumber} sedang dikirim`,
        heading: 'Pesanan Anda dalam perjalanan',
        intro: [
          `Halo ${o.customerName}, pesanan ${o.orderNumber} sudah kami serahkan ke ${courier}.`,
          'Lacak paket di situs kurir dengan nomor resi di bawah.',
        ],
        highlight: {
          label: `Nomor resi ${courierName(o.courier)}`,
          value: o.trackingNumber ?? '-',
          note: 'Status di situs kurir biasanya muncul beberapa jam setelah paket diserahkan.',
        },
        button: { label: 'Lihat Pesanan', url: o.orderUrl },
        ...(trackingUrl && {
          secondaryLink: { label: `Lacak di situs ${courierName(o.courier)}`, url: trackingUrl },
        }),
        showSummary: false,
        showAddress: true,
      };
    }
    case 'order-delivered':
      return {
        subject: `Pesanan ${o.orderNumber} telah diterima`,
        heading: 'Paket sudah sampai',
        intro: [
          `Halo ${o.customerName}, menurut catatan kami pesanan ${o.orderNumber} sudah diterima.`,
          'Terima kasih sudah berbelanja di 3ON SportsWear. Semoga cocok dan nyaman dipakai berolahraga.',
          'Bila ada kendala dengan pesanan ini, balas email ini dan sertakan nomor pesanan.',
        ],
        button: { label: 'Lihat Pesanan', url: o.orderUrl },
        showSummary: false,
        showAddress: false,
      };
  }
}

const C = {
  page: '#FAFAFA',
  surface: '#FFFFFF',
  ink: '#171717',
  ink2: '#525252',
  line: '#E5E5E5',
  action: '#C026D3',
  tint: '#FDF4FF',
  tintInk: '#A21CAF',
  promo: '#0E7490',
};
const font = 'font-family:Arial,Helvetica,sans-serif;';

function summaryRows(o: OrderEmailData): string {
  const items = o.items
    .map(
      (i) => `<tr>
  <td style="${font}padding:8px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink};">
    ${escapeHtml(i.name)}<br><span style="color:${C.ink2};font-size:13px;">${escapeHtml(i.variant)} &times; ${i.quantity}</span>
  </td>
  <td align="right" style="${font}padding:8px 0;border-bottom:1px solid ${C.line};font-size:14px;color:${C.ink};white-space:nowrap;">${formatRupiah(i.subtotal)}</td>
</tr>`,
    )
    .join('');
  const line = (label: string, value: string, color = C.ink2) =>
    `<tr><td style="${font}padding:4px 0;font-size:14px;color:${C.ink2};">${label}</td><td align="right" style="${font}padding:4px 0;font-size:14px;color:${color};white-space:nowrap;">${value}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${items}
${line('Subtotal', formatRupiah(o.subtotal))}
${line(`Ongkir (${escapeHtml(courierName(o.courier))} ${escapeHtml(o.courierService)})`, formatRupiah(o.shippingCost))}
${o.discount > 0 ? line('Potongan voucher', `&minus;${formatRupiah(o.discount)}`, C.promo) : ''}
<tr><td style="${font}padding:8px 0 0;font-size:16px;font-weight:bold;color:${C.ink};">Total</td><td align="right" style="${font}padding:8px 0 0;font-size:16px;font-weight:bold;color:${C.ink};white-space:nowrap;">${formatRupiah(o.total)}</td></tr>
</table>`;
}

export function renderOrderEmail(kind: OrderEmailKind, o: OrderEmailData): RenderedEmail {
  const c = contentFor(kind, o);
  const paragraphs = c.intro
    .map(
      (p) =>
        `<p style="${font}margin:0 0 12px;font-size:15px;line-height:1.5;color:${C.ink};">${escapeHtml(p)}</p>`,
    )
    .join('');
  const highlight = c.highlight
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="${font}background:${C.tint};border-radius:12px;padding:16px;">
  <div style="font-size:13px;color:${C.tintInk};">${escapeHtml(c.highlight.label)}</div>
  <div style="font-size:20px;font-weight:bold;color:${C.ink};margin-top:4px;letter-spacing:0.5px;">${escapeHtml(c.highlight.value)}</div>
  ${c.highlight.note ? `<div style="font-size:13px;color:${C.ink2};margin-top:6px;">${escapeHtml(c.highlight.note)}</div>` : ''}
</td></tr></table>`
    : '';
  const button = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;"><tr><td style="background:${C.action};border-radius:999px;">
  <a href="${escapeHtml(c.button.url)}" style="${font}display:inline-block;padding:12px 28px;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">${escapeHtml(c.button.label)}</a>
</td></tr></table>`;
  const secondary = c.secondaryLink
    ? `<p style="${font}margin:8px 0 0;font-size:14px;"><a href="${escapeHtml(c.secondaryLink.url)}" style="color:${C.action};">${escapeHtml(c.secondaryLink.label)}</a></p>`
    : '';
  const section = (title: string, body: string) =>
    `<h2 style="${font}margin:28px 0 8px;font-size:15px;color:${C.ink};">${title}</h2>${body}`;
  const summary = c.showSummary ? section('Ringkasan pesanan', summaryRows(o)) : '';
  const address = c.showAddress
    ? section(
        'Dikirim ke',
        `<p style="${font}margin:0;font-size:14px;line-height:1.5;color:${C.ink2};"><strong style="color:${C.ink};">${escapeHtml(o.address.recipient)}</strong> (${escapeHtml(o.address.phone)})<br>${escapeHtml(o.address.full)}</p>`,
      )
    : '';

  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(c.subject)}</title></head>
<body style="margin:0;padding:0;background:${C.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.surface};border:1px solid ${C.line};border-radius:16px;">
<tr><td style="padding:24px 24px 0;${font}font-size:18px;font-weight:bold;color:${C.ink};">3ON SportsWear</td></tr>
<tr><td style="padding:16px 24px 28px;">
<h1 style="${font}margin:0 0 16px;font-size:22px;line-height:1.3;color:${C.ink};">${escapeHtml(c.heading)}</h1>
<p style="${font}margin:0 0 16px;font-size:13px;color:${C.ink2};">Pesanan ${escapeHtml(o.orderNumber)}</p>
${paragraphs}${highlight}${button}${secondary}${summary}${address}
</td></tr></table>
<p style="${font}margin:16px 0 0;font-size:12px;color:${C.ink2};">Email ini dikirim otomatis karena ada transaksi atas nama Anda di 3ON SportsWear.</p>
</td></tr></table>
</body></html>`;

  const textLines = [
    c.heading,
    `Pesanan ${o.orderNumber}`,
    '',
    ...c.intro,
    ...(c.highlight ? ['', `${c.highlight.label}: ${c.highlight.value}`] : []),
    '',
    `${c.button.label}: ${c.button.url}`,
    ...(c.secondaryLink ? [`${c.secondaryLink.label}: ${c.secondaryLink.url}`] : []),
    ...(c.showSummary
      ? [
          '',
          'Ringkasan pesanan',
          ...o.items.map(
            (i) => `- ${i.name} (${i.variant}) x${i.quantity}: ${formatRupiah(i.subtotal)}`,
          ),
          `Subtotal: ${formatRupiah(o.subtotal)}`,
          `Ongkir: ${formatRupiah(o.shippingCost)}`,
          ...(o.discount > 0 ? [`Potongan voucher: -${formatRupiah(o.discount)}`] : []),
          `Total: ${formatRupiah(o.total)}`,
        ]
      : []),
    ...(c.showAddress
      ? ['', 'Dikirim ke', `${o.address.recipient} (${o.address.phone})`, o.address.full]
      : []),
    '',
    '3ON SportsWear',
  ];

  return { subject: c.subject, html, text: textLines.join('\n') };
}
