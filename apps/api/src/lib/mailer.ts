/**
 * Pengiriman email via SMTP (nodemailer). Satu-satunya tempat yang menyentuh SMTP.
 * Di luar production SEMUA email dialihkan ke EMAIL_DEV_REDIRECT_TO agar pembeli sungguhan
 * (mis. dari data impor) tidak pernah menerima email dari laptop developer.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailRouting {
  production: boolean;
  redirectTo: string | undefined;
}

/** null = jangan kirim (development tanpa alamat pengalihan). */
export function routeMail(message: MailMessage, routing: MailRouting): MailMessage | null {
  if (routing.production) return message;
  if (!routing.redirectTo) return null;
  return {
    ...message,
    to: routing.redirectTo,
    subject: `[DEV → ${message.to}] ${message.subject}`,
  };
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.EMAIL_USER || !env.EMAIL_PASSWORD) return null;
  transporter ??= nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_PORT === 465,
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
  });
  return transporter;
}

export type SendOutcome = 'sent' | 'skipped';

/** Melempar error bila SMTP gagal, agar job antrean mencoba ulang. */
export async function sendMail(message: MailMessage): Promise<SendOutcome> {
  const routed = routeMail(message, {
    production: env.NODE_ENV === 'production',
    redirectTo: env.EMAIL_DEV_REDIRECT_TO,
  });
  if (!routed) {
    logger.warn(
      { to: message.to, subject: message.subject },
      'Email tidak dikirim: EMAIL_DEV_REDIRECT_TO kosong (wajib di luar production)',
    );
    return 'skipped';
  }
  const transport = getTransporter();
  if (!transport) {
    logger.warn(
      { subject: message.subject },
      'Email tidak dikirim: EMAIL_USER/EMAIL_PASSWORD kosong',
    );
    return 'skipped';
  }
  const info = await transport.sendMail({
    from: env.EMAIL_FROM ?? `3ON SportsWear <${env.EMAIL_USER}>`,
    to: routed.to,
    subject: routed.subject,
    html: routed.html,
    text: routed.text,
  });
  logger.info(
    { to: routed.to, subject: routed.subject, messageId: info.messageId },
    'Email terkirim',
  );
  return 'sent';
}
