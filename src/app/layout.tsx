import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Kanit } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import { ConfirmProvider } from '@/components/ui/confirm-dialog';
import { I18nProvider } from '@/components/i18n/i18n-provider';
import { MuiAppProvider } from '@/components/theme/mui-provider';
import { lightSurface } from '@/theme/tokens';

const kanit = Kanit({
  subsets: ['latin', 'thai'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Fameline Queue | ระบบจองคิวรับ-ส่งสินค้า',
    template: '%s | Fameline Queue',
  },
  description: 'ระบบจองคิวรับสินค้าและส่งสินค้าหน้าคลัง Fameline',
  applicationName: 'Fameline Queue',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '48x48' },
      { url: '/favicon.png', type: 'image/png', sizes: '192x192' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

/**
 * Mobile viewport: `viewportFit: cover` lets the portal shell pad for iOS
 * safe areas, and `themeColor` tints the browser chrome to match the app
 * background in each color scheme. Zoom is intentionally left enabled.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: lightSurface.bg,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning style={{ colorScheme: 'light' }}>
      <body className={kanit.variable}>
        <I18nProvider>
          <MuiAppProvider>
            <ToastProvider>
              <ConfirmProvider>{children}</ConfirmProvider>
            </ToastProvider>
          </MuiAppProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
