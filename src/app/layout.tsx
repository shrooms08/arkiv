import type { Metadata } from "next";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arkiv",
  description:
    "An archive of investment theses. Every basket files the condition that would prove it wrong.",
};

/**
 * Root layout. Deliberately thin.
 *
 * Chrome lives in the segment layouts, because the marketing page and the
 * product have different chrome: the product carries the nav, wallet and
 * footer, the marketing page carries neither. What is shared is the document,
 * the stylesheet order and the wagmi and query providers.
 *
 * `.ark` sits on `<body>` so it covers portals too. Without it the whole app
 * falls back to browser defaults, which is the most common way an Arkiv screen
 * renders wrong.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="ark app-shell">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
