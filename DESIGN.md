# 3ON SportsWear

Trendy, energetic, conversion-focused.

Dial: ENERGY 2 / RHYTHM 2 / MOTION 1 (confirmed by the owner, 1 Oct 2026)

## Overview

3ON SportsWear is a design system crafted for fashion and lifestyle e-commerce storefronts that demand visual punch and effortless conversion. The spacious layout philosophy ensures products have the breathing room to shine, with generous whitespace framing hero imagery. A bold fuchsia primary drives urgency on CTAs, while cyan and yellow accents inject youthful energy. Every element is tuned to move shoppers from browse to checkout with minimal friction.

All UI copy is in Bahasa Indonesia. Prices are shown in Rupiah without decimals (`Rp 189.000`). Every color pair in this file meets WCAG AA (4.5:1 for normal text, 3:1 for large text and UI boundaries).

## Colors

### Brand

- **Primary** (#D946EF): Brand fuchsia. Used for fills and borders that carry no small text: selected filter chip border, focus-adjacent accents, product hover tint, large display text (32px+). White text on it is only 3.46:1, so it never carries body-size text.
- **Primary Action** (#C026D3): Primary button fill, outline button text and border, text links, selected size. White on it 4.71:1; on Background 4.51:1.
- **Primary Hover** (#A21CAF): Hover state of Primary Action; text on Primary Tint. White on it 6.32:1; on Primary Tint 5.89:1.
- **Primary Active** (#86198F): Pressed state.
- **Primary Tint** (#FDF4FF): Outline button hover background, selected list item background. Text on it uses Primary Hover, not Primary Action (4.39:1 fails).
- **Secondary** (#22D3EE): Promo badge background, decorative promo surfaces. Never used as a text color (1.81:1 on white). Text on it: #164E63 (5.04:1).
- **Secondary Text** (#0E7490): Promo or discounted price text on white (5.36:1).
- **Tertiary** (#FACC15): Highlight accent background only, with #713F12 text (5.66:1). Never a text color.

### Neutrals

- **Background** (#FAFAFA): Global page background, clean and airy
- **Surface** (#FFFFFF): Product cards, modals, cart drawer
- **Surface Muted** (#F5F5F5): Disabled fields, ghost button hover, out-of-stock size
- **Text Primary** (#171717): Headings, body, prices
- **Text Secondary** (#525252): Helper text, metadata, secondary details (7.49:1 on Background)
- **Text Tertiary** (#737373): Placeholder, struck-through original price, captions on white only (4.74:1 on Surface; fails on Surface Muted, use Text Secondary there)
- **Border** (#E5E5E5): Card outlines and dividers (decorative separation only)
- **Border Strong** (#D4D4D4): Card hover border
- **Border Input** (#8A8A8A): Input, checkbox, radio, and chip outlines. 3.45:1 on white, meets the 3:1 rule for UI boundaries.

### Semantic

- **Success** (#22C55E): Icon and fill accents. Text: #166534 on #DCFCE7.
- **Warning** (#F59E0B): Icon and fill accents. Text: #854D0E on #FEF9C3.
- **Error** (#DC2626): Error text and destructive button fill (white on it 4.83:1). Hover #B91C1C. Text in chips: #991B1B on #FEE2E2.
- **Info** (#3B82F6): Icon and fill accents. Text: #1E40AF on #DBEAFE.

## Typography

- **Headline Font**: Poppins (weights 600, 700, 800 only)
- **Body Font**: Nunito (variable font, 400 to 700)
- **Mono**: system monospace stack (`ui-monospace, SFMono-Regular, Consolas, monospace`), no web font. Used only for promo codes and order numbers, so it does not justify an extra font download against the 2.5s LCP target.
- Load fonts through `next/font` with `display: swap` and the Latin subset.

| Style          | Desktop (1024px+)                          | Mobile (under 768px)            | Use                                              |
| -------------- | ------------------------------------------ | ------------------------------- | ------------------------------------------------ |
| **Display**    | Poppins 56px extra-bold, 1.1 lh, 0.02em    | Poppins 36px extra-bold, 1.1 lh | Hero banners, sale headlines                     |
| **Headline**   | Poppins 40px bold, 1.2 lh, 0.01em          | Poppins 28px bold, 1.2 lh       | Collection titles, category headers              |
| **Subhead**    | Poppins 26px semibold, 1.3 lh              | Poppins 22px semibold, 1.3 lh   | Section titles, promo headings                   |
| **Body Large** | Nunito 18px regular, 1.6 lh                | Nunito 17px regular, 1.6 lh     | Product description lead                         |
| **Body**       | Nunito 16px regular, 1.6 lh                | same                            | Default body text                                |
| **Body Small** | Nunito 14px regular, 1.5 lh                | same                            | Secondary details                                |
| **Caption**    | Nunito 12px medium, 1.4 lh, 0.02em         | same                            | Size labels, stock status                        |
| **Overline**   | Nunito 11px bold, 1.2 lh, 0.1em, uppercase | same                            | Category tags, "Baru" label on real new arrivals |
| **Code**       | Mono 14px regular, 1.5 lh                  | same                            | Promo codes, order numbers                       |

Tablet (768px to 1023px) uses the midpoint between the two columns, rounded to the nearest even pixel. Long product names must wrap, never overflow; clamp product card names to 2 lines.

## Spacing

- **Base unit:** 8px
- **Scale:** 4, 8, 12, 16, 24, 32, 48, 64, 96, 128
- **Component padding:** 8px (small), 16px (medium), 24px (large)
- **Section spacing:** 56px (mobile), 80px (tablet), 112px (desktop)
- **Page gutter:** 16px (mobile), 24px (tablet), 32px (desktop); content max width 1280px

## Layout & Breakpoints

- **Mobile:** 360px to 767px. The 360px width is the minimum that must work with no horizontal scroll.
- **Tablet:** 768px to 1023px
- **Desktop:** 1024px and up
- **Product grid:** 2 columns mobile (12px gap), 3 tablet (16px gap), 4 desktop (24px gap)
- **Tap targets:** every interactive element has a hit area of at least 44 by 44px, with at least 8px between adjacent targets.

## Border Radius

- **None:** 0px — Product image overlays, full-bleed banners
- **Small:** 4px — Badges, inline tags
- **Medium:** 12px — Cards, inputs, dropdowns, size selector
- **Large:** 16px — Product cards, image containers, modals
- **XL:** 24px — Promotional banners, feature sections
- **Full:** 9999px — CTA pill buttons, avatars, quantity selectors, filter chips

## Elevation

3ON SportsWear uses Material-style layered shadows to create a tactile, shoppable card interface. Shadow marks elevation only; most elements sit flat.

- **Subtle:** 1px offset, 3px blur, #000000 at 6%; 1px offset, 2px blur, #000000 at 4%
- **Medium:** 4px offset, 6px blur, #000000 at 7%; 2px offset, 4px blur, #000000 at 5%
- **Large:** 10px offset, 25px blur, #000000 at 10%; 6px offset, 10px blur, #000000 at 6%
- **Overlay:** 25px offset, 50px blur, #000000 at 15%; 12px offset, 24px blur, #000000 at 8%. Cart drawer, modals, bottom sheets.
- **Product Hover:** 14px offset, 32px blur, #D946EF at 12%; 6px offset, 12px blur, #000000 at 6% — Fuchsia-tinted lift on product cards (pointer devices only)

## Focus

Every interactive element (buttons, links, chips, size options, inputs, cards that are links) shows a visible focus ring on keyboard focus: 2px solid #C026D3 outline with 2px offset, via `:focus-visible`. Inputs keep their own focus style below. Never remove the outline without this replacement.

## Components

### Buttons

**Primary (Filled)** — `bg: #C026D3`, `text: #FFFFFF`, `font: Nunito 15px/700`, `padding: 12px 28px`, `radius: 9999px`, `hover: #A21CAF`, `active: #86198F`
**Secondary (Outline)** — `bg: transparent`, `text: #C026D3`, `border: 2px #C026D3`, `radius: 9999px`, `hover: bg #FDF4FF, text #A21CAF`
**Ghost** — `bg: transparent`, `text: #525252`, `hover: bg #F5F5F5`
**Destructive** — `bg: #DC2626`, `text: #FFFFFF`, `radius: 9999px`, `hover: #B91C1C`

- **Sizes**: Small `40px h / 10px 18px` (hit area extended to 44px), Medium `48px h / 12px 28px`, Large `52px h / 14px 36px`
- **Disabled**: 40% opacity, disabled cursor, `aria-disabled`
- **Loading**: label replaced by a spinner plus "Memproses...", button stays the same width and is not clickable
- **Labels** name the action in Bahasa Indonesia: "Tambah ke Keranjang", "Pilih Ukuran", "Lanjut ke Pembayaran", "Bayar Sekarang", "Simpan Alamat"

### Cards

**Default** — `bg: #FFFFFF`, `border: 1px #E5E5E5`, `radius: 16px`, `padding: 0 (image flush) / 16px (content)`, `hover: border #D4D4D4`
**Elevated** — `shadow: Medium`, `hover: shadow Large with translateY(-3px) transition 200ms`

### Product Card

- Image 1:1 (matches the square cover photos from the product import), WebP, flush to the top, `radius: 16px 16px 0 0`
- Name: Body 16px/600, Text Primary, max 2 lines
- Price: Nunito 16px/700, Text Primary. If a discounted price is shown (not decided yet), it uses Secondary Text and the original price is struck through in Text Tertiary.
- Stock cue: Caption in #854D0E (6.85:1 on white) "Sisa 3" only when real total stock is at or below the low-stock threshold (threshold not decided yet); nothing otherwise
- The whole card links to the product page. Because every product has size variants, the card CTA is "Pilih Ukuran", which opens the size bottom sheet; it is the most prominent element on the card.
- When every size is out of stock: image at 60% opacity and a "Stok habis" status chip; the card still links to the product page

### Size Selector

- Each size is a button, min `44px x 44px`, `radius: 12px`, `border: 1.5px #8A8A8A`, `text: Nunito 15px/600 #171717`
- **Selected**: `bg: #C026D3`, `text: #FFFFFF`, `border: #C026D3`, `aria-pressed="true"`
- **Out of stock** (stock 0): still shown, `bg: #F5F5F5`, `text: #525252` with line-through, `border: #E5E5E5`, `aria-disabled="true"`, not selectable; label read by screen readers as "XL, stok habis"
- Size chart link sits next to the selector: "Lihat panduan ukuran"

### Quantity Selector

Pill (`radius: 9999px`), minus and plus buttons each 44px, number in the middle (Nunito 16px/600). Plus is disabled at the available stock; minus is disabled at 1.

### Inputs

**Text Input** — `bg: #FFFFFF`, `border: 1.5px #8A8A8A`, `text: #171717`, `placeholder: #737373`, `radius: 12px`, `padding: 0 16px`, `height: 48px`, `font: Nunito 16px/400`, `focus: border #C026D3, ring 3px #D946EF at 15%`, `error: border #DC2626, ring #DC2626 at 15%`, `disabled: bg #F5F5F5, 50% opacity`

- **Label**: top, Nunito, 13px, 600, #171717
- **Helper text**: 12px, #525252
- **Error text**: 12px, #DC2626, below the field, says what to fix ("Nomor HP minimal 10 digit")
- Placeholders describe the format, never fake data: "Contoh: 081234567890", not a made-up name

### Chips

**Filter Chip** — `height: 40px` (hit area 44px), `padding: 0 16px`, `radius: 9999px`, `border: 1.5px #8A8A8A`, `selected: bg #C026D3, text #FFFFFF, border #C026D3`, `hover: bg #F5F5F5`
**Status Chip** — `height: 24px`, `padding: 0 8px`, `radius: 4px`, `font: Caption 12px/600`. Success: `bg #DCFCE7, text #166534` / Warning: `bg #FEF9C3, text #854D0E` / Error: `bg #FEE2E2, text #991B1B` / Info: `bg #DBEAFE, text #1E40AF` / Shipping: `bg #CFFAFE, text #155E75` / Neutral: `bg #F5F5F5, text #404040`

### Order Status Chips

One label and color per order status, used on the storefront and in the admin panel:

| Status       | Label               | Chip     |
| ------------ | ------------------- | -------- |
| `pending`    | Menunggu Pembayaran | Warning  |
| `paid`       | Dibayar             | Info     |
| `processing` | Dikemas             | Info     |
| `shipped`    | Dikirim             | Shipping |
| `delivered`  | Diterima            | Success  |
| `completed`  | Selesai             | Success  |
| `expired`    | Kedaluwarsa         | Neutral  |
| `cancelled`  | Dibatalkan          | Error    |

### Lists

**Default List Item** — `height: 48px`, `padding: 0 16px`, `font: Nunito 16px/400`, `divider: 1px #E5E5E5`, `hover: bg #FAFAFA`, `selected: bg #FDF4FF, text #A21CAF`, `icon variant: 22px icon, 14px gap`

### Checkboxes

20px box inside a 44px hit area, border: 2px #8A8A8A, radius: 6px, checked: bg #C026D3 border #C026D3 with white checkmark, indeterminate: bg #C026D3 with white dash, disabled: 40% opacity, label: Nunito 14px/400 with 10px gap.

### Radio Buttons

20px circle inside a 44px hit area, border: 2px #8A8A8A, selected: border #C026D3 with 6px inner dot #C026D3, disabled: 40% opacity, label: Nunito 14px/400 with 10px gap. Courier and service options in checkout are radio cards: full-width, 16px padding, `radius: 12px`, selected border #C026D3.

### Tooltips

#171717, text: #FFFFFF, font: Nunito 12px/500, padding: 8px 12px, radius: 8px, max-width: 200px, arrow: 6px, delay: 200ms, position: top preferred fill. Opens on hover and on keyboard focus; never the only place information lives (touch devices have no hover).

### Header

- Sticky, `height: 56px` mobile / `64px` desktop, Surface background, bottom border #E5E5E5
- Left: store wordmark as text (Poppins 700) until a logo file is supplied
- Right: search, cart icon with item count, account. Each is a 44px target.
- Navigation items only for pages that exist

### Cart Drawer

- Opens from every page without a page redirect: right side panel 400px wide on desktop, full-height sheet on mobile, Overlay shadow
- Closes with the close button, Escape, and a tap on the backdrop; focus is trapped inside while open and returns to the cart button on close
- Footer shows the subtotal and "Lanjut ke Pembayaran"; shipping is calculated at checkout, and the drawer says so

### Checkout

- Steps: Alamat, then Pengiriman (courier and service), then Pembayaran (voucher and final total). Progress shown as text: "Langkah 2 dari 3".
- Mobile: a sticky bottom bar always shows the current total and the step's primary button
- The shipping cost is visible before the pay button; nothing about the price is hidden behind a click
- Voucher field: input plus "Pakai" button; a valid code shows the discount line, an invalid one shows the reason from the server

### Tracking Timeline

Vertical list of courier events, newest first. Each row: date and time (Caption, Text Secondary) and description (Body Small). Only the newest event has a filled #C026D3 dot; older events use a #8A8A8A outline dot. If tracking cannot be loaded, show the tracking number with a link to the courier's site.

### Toast

- Bottom of the screen above the sticky bar on mobile, top right on desktop
- `role="status"` for success and info (auto-dismiss after 5s), `role="alert"` for errors (stays until dismissed)
- One sentence that states what happened: "Produk ditambahkan ke keranjang"

### Empty, Loading, and Error States

Every screen that shows data has all three:

- **Empty**: says why it is empty and gives the one action that fills it. Cart: "Keranjang masih kosong." plus "Lihat Produk". Orders: "Belum ada pesanan." plus "Mulai Belanja". Filtered catalog: "Tidak ada produk yang cocok dengan filter ini." plus "Hapus Filter".
- **Loading**: skeletons that match the real layout (a product grid loads as product card skeletons), no full-page spinner
- **Error**: says what failed and what to do next: "Ongkir gagal dimuat. Coba lagi atau pilih kurir lain." plus "Coba Lagi"

### Admin Panel

- Same color, type, and focus tokens as the storefront; denser spacing: Body Small 14px for table text, table rows 48px, page padding 24px
- Lists are tables whose first columns are the fields the admin acts on: for orders, order number, status chip, total, and age of the order
- Exactly one Primary button per screen, for that screen's main action (for example "Input Resi"); everything else uses Secondary or Ghost
- No product hover shadow, no promo colors; Secondary and Tertiary are storefront-only
- Destructive actions (cancel order) use the Destructive button and a confirmation dialog that names the consequence: "Pesanan dibatalkan dan stok dikembalikan."

## Do's and Don'ts

- **Do** use high-quality product photography with a consistent 1:1 aspect ratio across grids.
- **Do** make the primary CTA ("Pilih Ukuran" on cards, "Tambah ke Keranjang" on the product page) the most visually prominent element.
- **Do** show low-stock cues near the CTA, using the real stock number only.
- **Do** keep the cart drawer accessible from every page; never force a full page redirect.
- **Do** keep the checkout total and the primary button visible at all times on mobile.
- **Don't** use more than one animated element per viewport; competing motion distracts from products.
- **Don't** show countdowns, "limited time" labels, or other urgency cues that are not backed by real data.
- **Don't** place product descriptions in font sizes below Body Small (14px); readability drives trust.
- **Don't** hide the price or shipping estimate behind a click; transparency reduces cart abandonment.
- **Don't** use fuchsia for non-interactive decorative elements; reserve it strictly for actionable targets and the selected state.
- **Don't** put white or colored body-size text on #D946EF, #22D3EE, or #FACC15; use the text colors listed in Colors.
