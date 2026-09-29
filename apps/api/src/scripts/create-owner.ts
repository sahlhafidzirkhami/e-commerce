/**
 * Membuat akun OWNER (tidak ada halaman daftar admin yang terbuka untuk umum).
 *
 *   pnpm --filter api user:create-owner -- --email pemilik@toko.id --name "Nama Pemilik"
 *   pnpm --filter api user:create-owner -- --email user@ada.id --promote   # jadikan user yang ada OWNER
 *
 * Password diketik di terminal (tidak tampil, tidak masuk riwayat shell).
 */
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { parseArgs } from 'node:util';
import { emailSchema, passwordSchema, registerSchema } from '@sportswear/shared';
import { hashPassword } from '../lib/password.js';
import { prisma } from '../lib/prisma.js';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    promote: { type: 'boolean', default: false },
  },
});

// Output readline yang bisa "dibisukan" saat mengetik password.
let muted = false;
const output = new Writable({
  write(chunk: Buffer, encoding: BufferEncoding, callback) {
    if (!muted) stdout.write(chunk, encoding);
    callback();
  },
});
const rl = createInterface({ input: stdin, output, terminal: true });

async function askHidden(question: string): Promise<string> {
  stdout.write(question);
  muted = true;
  const answer = await rl.question('');
  muted = false;
  stdout.write('\n');
  return answer;
}

async function main() {
  const email = emailSchema.parse(values.email ?? '');
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    if (!values.promote) {
      throw new Error(`Email ${email} sudah terdaftar. Pakai --promote untuk menjadikannya OWNER.`);
    }
    await prisma.user.update({
      where: { id: existing.id },
      // Naikkan tokenVersion agar sesi lama login ulang dengan role baru.
      data: { role: 'OWNER', tokenVersion: { increment: 1 } },
    });
    console.log(`✔ ${email} sekarang OWNER.`);
    return;
  }

  if (!stdin.isTTY) throw new Error('Jalankan di terminal interaktif untuk mengetik password.');
  const password = passwordSchema.parse(await askHidden('Password OWNER    : '));
  const confirm = await askHidden('Ulangi password   : ');
  if (password !== confirm) throw new Error('Password tidak sama.');

  const input = registerSchema.parse({ email, password, name: values.name ?? 'Owner' });
  await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      role: 'OWNER',
      passwordHash: await hashPassword(input.password),
    },
  });
  console.log(`✔ Akun OWNER ${email} dibuat.`);
}

main()
  .catch((err: unknown) => {
    console.error(`✖ ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
