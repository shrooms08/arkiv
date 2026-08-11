import type { Metadata } from "next";
import Link from "next/link";

import { NetworkBanner } from "@/components/NetworkBanner";
import { WalletBar } from "@/components/WalletBar";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arkiv",
  description: "An archive of investment theses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <header className="site-header">
            <nav>
              <Link href="/">Arkiv</Link>
              <Link href="/archive">Archive</Link>
              <WalletBar />
            </nav>
          </header>
          <NetworkBanner />
          {children}
        </Providers>
      </body>
    </html>
  );
}
