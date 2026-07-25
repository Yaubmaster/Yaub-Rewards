import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Yaub Rewards',
  description:
    'Refiere clientes, los agentes de IA de Yaub cierran la venta, y tú cobras la comisión.',
  icons: { icon: '/rewards/yaub-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

// Aplica el tema antes del primer pintado para que no haya destello en blanco
// al entrar en modo oscuro. Si no hay preferencia guardada, sigue al sistema.
const TEMA_INICIAL = `try{var t=localStorage.getItem('rewards_tema');
if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.dataset.tema='dark';}
}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
