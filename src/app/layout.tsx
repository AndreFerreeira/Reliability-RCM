import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Inter, Orbitron } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react';
import { I18nProvider } from '@/i18n/i18n-provider';

export const metadata: Metadata = {
  title: 'Reliability RCM',
  description: 'Analise e preveja a confiabilidade de componentes com ferramentas estatísticas e de IA.',
};

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${orbitron.variable} font-body antialiased`}>
        <I18nProvider>
          {children}
        </I18nProvider>
        <Analytics />
        <Toaster />
      </body>
    </html>
  );
}
