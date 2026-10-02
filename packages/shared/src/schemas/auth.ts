import { z } from 'zod';
import type { UserRole } from '../user-role.js';

/** Nomor HP Indonesia: 08…, 628…, atau +628… (10–15 digit). */
const PHONE_PATTERN = /^(\+62|62|0)8\d{7,12}$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Format email tidak valid'));

export const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE_PATTERN, 'Nomor HP tidak valid (contoh: 081234567890)');

export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(128, 'Password maksimal 128 karakter');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama terlalu panjang'),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password wajib diisi').max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Data user yang aman dikirim ke client. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
}

/** Tautan reset password berlaku selama ini (F-17). */
export const PASSWORD_RESET_TTL_MINUTES = 60;

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
