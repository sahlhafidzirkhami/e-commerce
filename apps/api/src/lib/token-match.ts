import { timingSafeEqual } from 'node:crypto';

/** Bandingkan token rahasia dalam waktu konstan (mencegah tebakan lewat timing). */
export function tokenMatches(expected: string, given: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
