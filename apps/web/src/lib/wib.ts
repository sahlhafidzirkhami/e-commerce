/**
 * Input `datetime-local` tidak punya zona waktu; toko memakai WIB (UTC+7).
 * Konversi dilakukan eksplisit agar hasilnya sama di laptop berzona waktu apa pun.
 */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ISO (UTC) → "YYYY-MM-DDTHH:mm" dalam WIB, untuk nilai awal input. */
export function isoToWibInput(iso: string): string {
  return new Date(new Date(iso).getTime() + WIB_OFFSET_MS).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" (WIB) → ISO UTC. */
export function wibInputToIso(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}
