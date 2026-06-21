import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Option Harvester — S&P 500 Monitor",
  description:
    "A sector-by-sector snapshot of the S&P 500 and large ETFs: price, market capitalization, and volume.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
