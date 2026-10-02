# PRD — Toko Online Sportswear

Sep 29, 2026 · @hafidz

> **Revisi 1 Okt 2026:** 1 produk = 1 warna, varian hanya ukuran (keputusan klien 29 Sep, warna lain = produk terpisah). Status `failed` hanya ada di `Payment`; order tetap `pending` sampai dibayar atau `expired`. Sumber aslinya adalah doc PRD di claude.ai; diagram di sana disalin ke sini sebagai teks.

## Ringkasan produk

Website toko online milik klien untuk menjual produk sportswear (jersey, celana training, sepatu, aksesori) langsung ke konsumen di Indonesia. Pembeli bisa memilih produk dan ukuran, membayar lewat payment gateway, lalu memantau pengiriman paket dari halaman pesanan.

Masalah yang diselesaikan: klien saat ini bergantung pada marketplace dan chat manual, sehingga margin terpotong komisi dan pengecekan ongkir serta resi dilakukan satu per satu. Website sendiri memberi kontrol penuh atas harga, data pelanggan, dan branding.

Tiga pilar fitur MVP: **jual beli** (katalog, keranjang, checkout, manajemen pesanan), **pembayaran otomatis** via payment gateway, dan **ongkir + tracking paket** via RajaOngkir API.

## Tujuan dan metrik keberhasilan

Target utama: pembeli bisa menyelesaikan belanja dari pilih produk sampai bayar dalam kurang dari 3 menit, tanpa campur tangan admin.

| Tujuan              | Metrik                                           | Target 3 bulan pasca-launch |
| ------------------- | ------------------------------------------------ | --------------------------- |
| Checkout mulus      | Conversion rate (visitor → order dibayar)        | ≥ 1,5%                      |
| Pembayaran otomatis | Order yang terverifikasi tanpa konfirmasi manual | 100%                        |
| Ongkir akurat       | Selisih ongkir web vs tagihan kurir              | 0 kasus komplain            |
| Tracking mandiri    | Pertanyaan "paket di mana?" via chat admin       | Turun ≥ 50%                 |
| Cepat di mobile     | Largest Contentful Paint halaman produk          | < 2,5 detik                 |

Angka target di atas adalah usulan awal dan perlu disepakati dengan klien.

**Di luar ruang lingkup (non-goals) MVP:** aplikasi mobile native, sistem multi-vendor/marketplace, integrasi otomatis ke Shopee/Tokopedia, program membership/poin, dan fitur COD.

## Persona pengguna

Ada tiga peran dengan hak akses berbeda.

| Peran      | Siapa                                        | Kebutuhan utama                                                     | Akses                                                          |
| ---------- | -------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| Pembeli    | Usia 18–35, aktif olahraga, belanja lewat HP | Cari ukuran yang pas, ongkir jelas sebelum bayar, tahu posisi paket | Storefront, akun, riwayat pesanan                              |
| Admin toko | Staf operasional (1–3 orang)                 | Proses pesanan harian, input resi, update stok                      | Admin panel: produk, stok, pesanan, pengiriman                 |
| Owner      | Pemilik bisnis                               | Pantau omzet, produk terlaris, kelola admin                         | Semua akses admin + laporan + manajemen user & pengaturan toko |

## Ruang lingkup fitur

MVP fokus pada alur jual beli lengkap yang bisa dipakai sendiri oleh pembeli; fitur pemasaran masuk fase 2.

| Modul                | MVP (fase 1)                                                                       | Fase 2                                                            |
| -------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Katalog              | Kategori, varian ukuran (1 produk = 1 warna), foto, size chart, pencarian & filter | Rekomendasi produk, "sering dibeli bersama"                       |
| Akun                 | Register/login email, Google login, alamat tersimpan                               | Wishlist, review & rating produk                                  |
| Keranjang & checkout | Cart, hitung ongkir, pilih kurir, checkout guest atau member                       | Simpan cart lintas perangkat, checkout 1 klik                     |
| Pembayaran           | VA bank, QRIS, e-wallet via payment gateway; notifikasi otomatis                   | Kartu kredit/cicilan, paylater                                    |
| Pengiriman           | Ongkir real-time & cek resi via RajaOngkir, halaman tracking                       | Notifikasi WhatsApp tiap update status, label pengiriman otomatis |
| Promo                | Kode voucher (nominal/persen)                                                      | Flash sale, gratis ongkir bersyarat, bundling                     |
| Admin panel          | Produk & stok, pesanan, input resi, dashboard penjualan sederhana                  | Laporan detail & export Excel, multi-gudang                       |
| Notifikasi           | Email konfirmasi order, pembayaran, pengiriman                                     | WhatsApp, abandoned cart reminder                                 |

## Kebutuhan fungsional

Setiap kebutuhan diberi kode agar mudah dirujuk saat estimasi dan testing.

### Katalog produk

- **F-01** Produk punya varian ukuran; stok, harga, dan SKU dicatat per varian, bukan per produk. Satu produk = satu warna; warna lain dijual sebagai produk terpisah.
- **F-02** Halaman produk menampilkan galeri foto produk, size chart, deskripsi bahan, berat (untuk ongkir), dan stok tersisa.
- **F-03** Filter berdasarkan kategori, ukuran, rentang harga, dan urutkan (terbaru, termurah, terlaris).
- **F-04** Varian stok 0 tetap tampil tapi tidak bisa dipilih.

### Keranjang dan checkout

- **F-05** Keranjang menyimpan varian + jumlah; jumlah dibatasi stok tersedia.
- **F-06** Checkout: isi/pilih alamat → sistem menghitung ongkir dari berat total → pembeli memilih kurir & layanan → pakai voucher → lihat total akhir.
- **F-07** Stok direservasi saat order dibuat dan dikembalikan otomatis jika pembayaran kedaluwarsa (default 24 jam).
- **F-08** Checkout sebagai tamu diperbolehkan; akun dibuat opsional setelah bayar.

### Pembayaran

- **F-09** Setelah checkout, pembeli diarahkan ke halaman pembayaran DOKU Checkout.
- **F-10** Status order berubah otomatis dari webhook gateway: `pending` → `paid`. Pembayaran gagal dicatat sebagai status `failed` di `Payment`, order tetap `pending` agar pembeli bisa mencoba bayar lagi; tidak dibayar 24 jam → `expired`.
- **F-11** Webhook diverifikasi signature-nya dan bersifat idempotent (notifikasi ganda tidak memproses order dua kali).

### Pengiriman dan tracking

- **F-12** Pilihan provinsi/kota/kecamatan tujuan diambil dari data lokasi RajaOngkir.
- **F-13** Ongkir dihitung real-time dari kota asal gudang ke tujuan, untuk kurir yang diaktifkan owner (mis. JNE, J&T, SiCepat).
- **F-14** Admin menginput nomor resi saat paket dikirim; status order menjadi `shipped` dan email terkirim ke pembeli.
- **F-15** Halaman tracking menampilkan riwayat perjalanan paket dari API cek resi; hasil di-cache 1–3 jam untuk hemat kuota.
- **F-16** Order otomatis `delivered` saat status kurir menyatakan diterima; `completed` 3 hari setelahnya jika tidak ada komplain.

### Akun pembeli

- **F-17** Register/login dengan email + password atau Google; reset password via email.
- **F-18** Riwayat pesanan dengan status dan tautan tracking; buku alamat maksimal 5 alamat.

### Admin panel

- **F-19** CRUD produk, varian, kategori, dan upload foto massal.
- **F-20** Daftar pesanan dengan filter status; aksi: proses, input resi, batalkan (stok dikembalikan).
- **F-21** Kelola voucher: kode, tipe, nilai, minimal belanja, kuota, masa berlaku.
- **F-22** Dashboard: omzet harian/bulanan, jumlah order per status, 10 produk terlaris, varian stok menipis.
- **F-23** Pengaturan toko: alamat asal pengiriman, kurir aktif, rekening/kunci API, dan akun admin (hanya owner).

## User flow dan status order

Pembeli cukup checkout dan bayar; perubahan status berikutnya digerakkan webhook payment gateway, input resi admin, dan hasil cek resi RajaOngkir.

```
checkout (pending) ── bayar ≤ 24 jam? ──ya──▶ paid ──▶ processing (dikemas admin)
        │                                                   │ admin input resi
        │ tidak (lewat 24 jam)                              ▼
        ▼                                     delivered ◀── shipped
     expired (stok dikembalikan)                  │ 3 hari tanpa komplain
                                                  ▼
                                              completed
```

Order yang tidak dibayar dalam 24 jam berakhir `expired` dan stoknya kembali; order yang sudah dibayar hanya menunggu satu aksi manual, yaitu admin menginput resi. Pembatalan oleh admin (`cancelled`) bisa dilakukan sebelum status `shipped`.

## Integrasi pihak ketiga

Dua integrasi wajib: payment gateway untuk pembayaran otomatis dan RajaOngkir untuk ongkir serta cek resi. Semua kunci API disimpan di server, tidak pernah dikirim ke browser.

| Integrasi             | Kandidat                   | Dipakai untuk                                 | Catatan teknis                                                                                          |
| --------------------- | -------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Payment gateway       | DOKU (DOKU Checkout)       | Buat transaksi, halaman bayar, webhook status | Wajib pakai sandbox saat development; verifikasi signature webhook; biaya per transaksi ditanggung toko |
| RajaOngkir — lokasi   | RajaOngkir API             | Daftar provinsi/kota/kecamatan                | Data jarang berubah → simpan di database, sinkron berkala                                               |
| RajaOngkir — ongkir   | RajaOngkir API             | Tarif per kurir & layanan berdasarkan berat   | Dipanggil saat checkout; cache per kombinasi asal–tujuan–berat 24 jam                                   |
| RajaOngkir — cek resi | RajaOngkir API             | Riwayat status paket                          | Pastikan paket langganan mendukung endpoint cek resi dan kurir yang dipilih                             |
| Email                 | Resend / SMTP (mis. Brevo) | Email transaksi                               | Template: order dibuat, dibayar, dikirim, diterima                                                      |

Payment gateway sudah ditetapkan: DOKU. Paket dan kuota API RajaOngkir masih perlu dikonfirmasi ke klien karena memengaruhi biaya bulanan; akun merchant DOKU sudah terverifikasi sehingga kredensial sandbox dan production siap dipakai.

## Kebutuhan non-fungsional

| Aspek           | Kebutuhan                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Performa        | Halaman produk LCP < 2,5 detik di 4G; gambar dikompres (WebP) dan disajikan lewat CDN                                                      |
| Mobile-first    | Semua alur utama nyaman di layar 360 px; tombol checkout selalu terlihat                                                                   |
| Keamanan        | HTTPS wajib; password di-hash (bcrypt/argon2); rate limit login & checkout; validasi input di server; admin panel dengan role-based access |
| Integritas data | Transaksi database saat buat order & kurangi stok untuk mencegah overselling; webhook idempotent                                           |
| SEO             | URL produk ramah SEO (`/produk/jersey-lari-pria`), meta tag & Open Graph, sitemap.xml, schema Product                                      |
| Ketersediaan    | Uptime target 99,5%; backup database harian, retensi 7 hari                                                                                |
| Privasi         | Mematuhi UU PDP: kebijakan privasi, data pelanggan tidak dibagikan, bisa hapus akun                                                        |
| Monitoring      | Log error (mis. Sentry), log setiap webhook yang masuk untuk audit                                                                         |

## Model data inti

Stok dan harga melekat pada varian; order menyimpan salinan harga dan nama saat checkout agar riwayat tidak berubah ketika produk diedit.

| Tabel               | Kolom penting                                                                                       | Relasi                                        |
| ------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| users               | id, name, email, password\_hash, role (customer/admin/owner)                                        | 1–N addresses, orders                         |
| addresses           | user\_id, recipient, phone, province\_id, city\_id, district\_id, detail, postal\_code              | N–1 users                                     |
| categories          | id, name, slug, parent\_id                                                                          | 1–N products                                  |
| products            | id, category\_id, name, slug, description, weight\_gram, is\_active                                 | 1–N product\_variants, product\_images        |
| product\_variants   | product\_id, sku, size, price, stock                                                                | N–1 products                                  |
| product\_images     | product\_id, url, sort\_order                                                                       | N–1 products                                  |
| carts / cart\_items | user\_id atau session\_id; variant\_id, qty                                                         | —                                             |
| vouchers            | code, type, value, min\_purchase, quota, used, starts\_at, ends\_at                                 | 1–N orders                                    |
| orders              | order\_no, user\_id (nullable), address snapshot, subtotal, shipping\_cost, discount, total, status | 1–N order\_items, 1–1 payments, 1–1 shipments |
| order\_items        | order\_id, variant\_id, name\_snapshot, price\_snapshot, qty                                        | N–1 orders                                    |
| payments            | order\_id, gateway, gateway\_ref, method, amount, status, paid\_at, raw\_payload                    | 1–1 orders                                    |
| shipments           | order\_id, courier, service, waybill, status, last\_tracking\_json, last\_checked\_at               | 1–1 orders                                    |

## Tech stack dan arsitektur

Usulan: Next.js di frontend dan Node.js di backend dengan PostgreSQL, karena satu bahasa (TypeScript) di seluruh sistem dan Next.js memberi SSR untuk SEO halaman produk.

```
Browser ──▶ Next.js (apps/web) ──▶ Express API (apps/api) ──┬──▶ DOKU Checkout
                                          │                ├──▶ RajaOngkir
                                          │                └──▶ Email (Resend/SMTP)
                                          ├──▶ PostgreSQL
                                          ├──▶ Redis (cache + BullMQ)
                                          └──▶ Object storage (gambar WebP)
```

Backend satu-satunya yang memanggil payment gateway dan RajaOngkir; Redis menyimpan cache ongkir dan tracking serta menjalankan job terjadwal (cek resi berkala, expire order 24 jam).

| Lapisan     | Pilihan                                                                                      | Alternatif                                        |
| ----------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Frontend    | Next.js + Tailwind CSS                                                                       | React (Vite) + React Router                       |
| Backend     | Node.js + Express atau NestJS, Prisma ORM                                                    | Laravel                                           |
| Database    | PostgreSQL                                                                                   | MySQL                                             |
| Cache & job | Redis + BullMQ                                                                               | node-cron                                         |
| Hosting     | Hosting milik klien (sudah tersedia); pastikan mendukung Node.js, PostgreSQL, dan cron/Redis | cPanel hosting (kurang cocok untuk job terjadwal) |

## Timeline dan milestone

Estimasi 5 minggu kerja full-time (±200 jam) oleh satu fullstack developer dengan bantuan Claude Code, plus 1 minggu buffer revisi; komitmen ke klien 6 minggu.

| Minggu | Fase                                                |
| ------ | --------------------------------------------------- |
| M1     | Setup, DB, auth, import produk                      |
| M2     | Katalog, varian, keranjang                          |
| M3     | Checkout, ongkir, DOKU sandbox                      |
| M4     | Admin, tracking, email, voucher                     |
| M5     | UAT, deploy, DOKU production — siap launch akhir M5 |
| M6     | Buffer revisi klien, launch                         |

M1 = minggu pertama setelah kontrak.

Akun DOKU sudah terverifikasi dan data produk sudah tersedia, jadi pengerjaan bisa langsung dimulai. Langganan RajaOngkir yang mendukung cek resi perlu aktif sebelum M3. Usulan termin pembayaran: 30% di awal, 40% setelah demo checkout end-to-end di sandbox (akhir M3), 30% saat launch.

## Risiko, asumsi, dan pertanyaan terbuka

**Asumsi:** satu gudang asal pengiriman, harga dalam Rupiah, jumlah SKU awal di bawah 500 varian, dan akun merchant DOKU sudah terverifikasi, data produk sudah tersedia dari klien, dan developer bekerja full-time.

| Risiko                                                             | Dampak                   | Mitigasi                                                                                   |
| ------------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------ |
| Integrasi DOKU (signature dan notifikasi) butuh banyak putaran uji | Minggu ke-3 molor        | Mulai integrasi di awal M3; log setiap notifikasi; uji skenario sukses, gagal, dan expired |
| Kuota/paket RajaOngkir tidak mencakup cek resi atau kurir tertentu | Tracking tidak berfungsi | Konfirmasi paket sebelum development; cache hasil; fallback tautan ke situs kurir          |
| Overselling saat banyak order bersamaan                            | Komplain & refund        | Lock stok di transaksi database, reservasi stok dengan batas waktu                         |
| Format data produk dari klien tidak seragam                        | Import produk lebih lama | Rapikan ke template spreadsheet dan import di M1                                           |
| Perubahan scope di tengah jalan                                    | Biaya & waktu bertambah  | Fitur baru masuk backlog fase 2, disepakati tertulis                                       |

**Pertanyaan untuk klien:**

- [ ] Data produk sudah ada: berapa jumlah produk/varian, dan apakah fotonya sudah siap pakai?
- [ ] Kurir apa saja yang ingin diaktifkan, dan dari kota mana paket dikirim?
- [ ] Akun merchant DOKU: sudah terverifikasi (tinggal serahkan kredensial sandbox dan production).
- [ ] Metode pembayaran wajib: VA, QRIS, e-wallet, kartu kredit?
- [ ] Perlu fitur retur/tukar ukuran di MVP?
- [ ] Hosting sudah ada: jenisnya apa (shared/cPanel atau VPS) dan apakah domain juga sudah ada?
- [ ] Siapa yang memelihara website dan server setelah launch, dan apakah ada kontrak maintenance?
- [ ] Budget dan target tanggal launch?
