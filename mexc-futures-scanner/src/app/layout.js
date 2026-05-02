import './globals.css';

export const metadata = {
  title: 'MEXC Futures Scanner',
  description: 'Futures limits and fee scanner for MEXC',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
