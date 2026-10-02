import type { Metadata, Viewport } from 'next';
import { Nunito, Poppins } from 'next/font/google';
import type { ReactNode } from 'react';
import { SITE_NAME, siteUrl } from '@/lib/site';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: 'Belanja sportswear 3ON dengan pengiriman ke seluruh Indonesia.',
  openGraph: { siteName: SITE_NAME, locale: 'id_ID', type: 'website' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" className={`${poppins.variable} ${nunito.variable}`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
