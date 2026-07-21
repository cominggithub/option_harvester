import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/TopNav";

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
      <body>
        <div className="flex h-screen flex-col overflow-hidden">
          <TopNav />
          <div id="page-content" className="min-h-0 flex-1 overflow-y-auto scroll-smooth">{children}</div>
        </div>
      </body>
    </html>
  );
}
