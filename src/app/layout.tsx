import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Inter, Orbitron } from 'next/font/google'

export const metadata: Metadata = {
  title: 'Analisador de Confiabilidade',
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
