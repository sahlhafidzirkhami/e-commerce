import { describe, expect, it } from 'vitest';
import { isoToWibInput, wibInputToIso } from './wib';

describe('konversi WIB', () => {
  it('jam 00.00 WIB = 17.00 UTC hari sebelumnya', () => {
    expect(wibInputToIso('2026-10-01T00:00')).toBe('2026-09-30T17:00:00.000Z');
  });

  it('bolak-balik tidak menggeser jam', () => {
    expect(isoToWibInput(wibInputToIso('2026-10-31T23:59'))).toBe('2026-10-31T23:59');
  });
});
