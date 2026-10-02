/**
 * Halaman lacak resi di situs kurir (dicek aktif 2 Okt 2026). Cek resi otomatis adalah
 * future feature; sampai itu, pembeli melacak sendiri dengan nomor resi.
 */
const TRACKING_PAGES: Readonly<Record<string, { name: string; url: string }>> = {
  jne: { name: 'JNE', url: 'https://www.jne.co.id/tracking-package' },
  jnt: { name: 'J&T Express', url: 'https://jet.co.id/track' },
  sicepat: { name: 'SiCepat', url: 'https://www.sicepat.com/' },
  wahana: { name: 'Wahana', url: 'https://www.wahana.com/tracking' },
};

export function courierName(code: string): string {
  return TRACKING_PAGES[code]?.name ?? code.toUpperCase();
}

export function courierTrackingUrl(code: string): string | null {
  return TRACKING_PAGES[code]?.url ?? null;
}
