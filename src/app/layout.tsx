import type { Metadata } from "next";

import { NetworkBanner } from "@/components/NetworkBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arkiv",
  description: "An archive of investment theses.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* `.ark` is required: it sets the sans stack and ink colour that every
          component inherits. Without it the whole app falls back to browser
          defaults, which is the single most common way an Arkiv screen renders
          wrong. It goes on <body> so it covers portals too. */}
      <body className="ark app-shell">
        <Providers>
          <NetworkBanner />
          <SiteHeader />
          {children}
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
