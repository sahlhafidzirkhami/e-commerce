import argon2 from 'argon2';

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Dipanggil saat email tidak ditemukan, agar waktu respons login sama
 * dengan email yang terdaftar (mencegah tebak email lewat timing).
 */
export async function verifyAgainstDummy(plain: string): Promise<false> {
  dummyHash ??= hashPassword('dummy-password-untuk-timing');
  await verifyPassword(await dummyHash, plain);
  return false;
}
