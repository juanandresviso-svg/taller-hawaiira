import '@fontsource-variable/archivo';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './globals.css';
import RegistrarSW from './registrar-sw';

export const metadata = {
  title: 'Taller Hawaiira',
  description: 'Pedidos, producción y alertas del taller Hawaiira Studio',
  appleWebApp: { capable: true, title: 'Taller', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png' },
};
export const viewport = { themeColor: '#FFFFFF', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
