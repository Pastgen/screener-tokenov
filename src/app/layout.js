import "./globals.css";

export const metadata = {
  title: "MEXC Futures Scanner",
  description: "MEXC Futures max size, leverage and zero fee scanner"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
