/**
 * Reset password via email (F-17). Token acak 32 byte dikirim di tautan; database hanya
 * menyimpan hash SHA-256-nya, berlaku PASSWORD_RESET_TTL_MINUTES menit dan sekali pakai.
 */
import { createHash, randomBytes } from 'node:crypto';
import { PASSWORD_RESET_TTL_MINUTES } from '@sportswear/shared';
import { env } from '../../config/env.js';
import { HttpError } from '../../lib/http-error.js';
import { sendMail, type MailMessage, type SendOutcome } from '../../lib/mailer.js';
import { hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { escapeHtml } from '../email/order-email.templates.js';
import type { SessionUser } from './auth.service.js';

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function renderPasswordResetEmail(name: string, url: string) {
  const subject = 'Atur ulang password akun 3ON SportsWear';
  const text = [
    `Halo ${name},`,
    '',
    'Kami menerima permintaan untuk mengatur ulang password akun Anda.',
    `Buka tautan ini dalam ${PASSWORD_RESET_TTL_MINUTES} menit untuk membuat password baru:`,
    url,
    '',
    'Bila Anda tidak meminta ini, abaikan email ini. Password Anda tidak berubah.',
    '',
    '3ON SportsWear',
  ].join('\n');
  const font = 'font-family:Arial,Helvetica,sans-serif;';
  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:24px 12px;background:#FAFAFA;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E5E5;border-radius:16px;"><tr><td style="padding:24px;">
<p style="${font}margin:0 0 16px;font-size:18px;font-weight:bold;color:#171717;">3ON SportsWear</p>
<h1 style="${font}margin:0 0 16px;font-size:22px;color:#171717;">Atur ulang password</h1>
<p style="${font}margin:0 0 12px;font-size:15px;line-height:1.5;color:#171717;">Halo ${escapeHtml(name)}, kami menerima permintaan untuk mengatur ulang password akun Anda.</p>
<p style="${font}margin:0 0 20px;font-size:15px;line-height:1.5;color:#171717;">Tautan berlaku ${PASSWORD_RESET_TTL_MINUTES} menit dan hanya bisa dipakai sekali.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#C026D3;border-radius:999px;">
<a href="${escapeHtml(url)}" style="${font}display:inline-block;padding:12px 28px;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">Buat Password Baru</a>
</td></tr></table>
<p style="${font}margin:20px 0 0;font-size:13px;line-height:1.5;color:#525252;">Bila Anda tidak meminta ini, abaikan email ini. Password Anda tidak berubah.</p>
</td></tr></table>
</body></html>`;
  return { subject, text, html };
}

/**
 * Selalu selesai tanpa error yang membedakan email terdaftar atau tidak; pemanggil
 * membalas dengan pesan yang sama apa pun hasilnya.
 */
export async function requestPasswordReset(
  email: string,
  now = new Date(),
  send: (message: MailMessage) => Promise<SendOutcome> = sendMail,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const token = randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000),
    },
  });
  const url = `${env.WEB_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await send({ to: user.email, ...renderPasswordResetEmail(user.name, url) });
}

const invalidToken = () =>
  HttpError.badRequest(
    'Tautan reset tidak berlaku lagi (kedaluwarsa atau sudah dipakai). Minta tautan baru.',
    'RESET_TOKEN_INVALID',
  );

/**
 * Ganti password lalu cabut semua sesi lama (tokenVersion naik). Token ditandai terpakai
 * secara compare-and-set, dan token lain milik user yang sama ikut dibatalkan.
 */
export async function resetPassword(
  token: string,
  password: string,
  now = new Date(),
): Promise<SessionUser> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  });
  if (!record || record.usedAt || record.expiresAt <= now) throw invalidToken();

  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: now },
    });
    if (count === 0) throw invalidToken();
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: now },
    });
    return tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
  });
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}
