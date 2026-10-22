import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from './providers';

export const metadata: Metadata = {
  title: 'Hexa Maps — Open-Source Navigation & International Highway Shields',
  description:
    'Interactive vector maps, country-aware highway shield rendering, multimodal turn-by-turn routing, real-time community traffic incidents, and offline PWA regions.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/hexa-logo.svg',
    apple: '/icons/hexa-logo.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F59E0B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
