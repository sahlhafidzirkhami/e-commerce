import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth.js';

describe('registerSchema', () => {
  const valid = { name: 'Budi', email: '  Budi@Mail.COM ', password: 'rahasia123' };

  it('menormalkan email ke huruf kecil tanpa spasi', () => {
    expect(registerSchema.parse(valid).email).toBe('budi@mail.com');
  });

  it('menolak password kurang dari 8 karakter', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'pendek' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Password minimal 8 karakter');
  });

  it('nomor HP opsional, tapi harus format Indonesia bila diisi', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, phone: '081234567890' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, phone: '+6281234567890' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, phone: '12345' }).success).toBe(false);
  });

  it('menolak email tidak valid', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'bukan-email' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('password wajib diisi', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});
