import { randomBytes, randomInt } from 'node:crypto';

/** Tanpa I, L, O, U agar tidak tertukar saat dibacakan ke CS. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SUFFIX_LENGTH = 6;

/** Tanggal dalam zona waktu Indonesia Barat (UTC+7), format YYMMDD. */
function wibDate(now: Date): string {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const yy = String(wib.getUTCFullYear()).slice(2);
  const mm = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wib.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** Contoh: 3ON-261001-K7Q2M9. */
export function generateOrderNumber(
  now: Date,
  random: (max: number) => number = randomInt,
): string {
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) suffix += ALPHABET[random(ALPHABET.length)];
  return `3ON-${wibDate(now)}-${suffix}`;
}

/** Token tautan status pesanan untuk pembeli tamu. */
export function generateAccessToken(): string {
  return randomBytes(24).toString('base64url');
}
