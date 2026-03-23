import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';

// ── Font ──────────────────────────────────────────────────────────────────────

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'IPL Fantasy Auction',
  description:
    'Create private leagues, run live auctions for IPL players, and compete with friends',
};

// ── Root Layout ───────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.className} dark`}>
      <body className="bg-[#0A0E1A] text-white min-h-screen">
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
