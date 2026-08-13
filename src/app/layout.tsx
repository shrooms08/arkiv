import type { Metadata, Viewport } from "next";

import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arkiv",
  description:
    "An archive of investment theses. Every basket files the condition that would prove it wrong.",
  appleWebApp: {
    capable: true,
    title: "Arkiv",
    // Translucent so the app paints under the status bar, which is what makes
    // viewport-fit and the safe-area padding below actually matter.
    statusBarStyle: "black-translucent",
  },
};

/**
 * Viewport.
 *
 * `viewportFit: "cover"` is not decoration: without it `env(safe-area-inset-*)`
 * resolves to zero on iOS and the bottom tab bar sits under the home indicator.
 *
 * There is deliberately no `maximumScale` and no `userScalable: false`. Blocking
 * pinch zoom is an accessibility failure, both platforms increasingly ignore it,
 * and where a gesture genuinely conflicts the fix is `touch-action` on that one
 * element rather than disabling zoom for the whole document.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EFEDE6" },
    { media: "(prefers-color-scheme: dark)", color: "#14161A" },
  ],
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
