export const metadata = {
  title: "MEXC Futures Scanner",
  description: "MEXC futures risk tiers and zero-fee scanner",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
