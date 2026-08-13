import type { MetadataRoute } from "next";

/**
 * Add to Home Screen.
 *
 * A manifest is the whole requirement for installability. There is deliberately
 * NO service worker: a cached app shell would serve a stale build from the
 * visitor's own device, and unlike a stale CDN alias that cannot be fixed by
 * repointing anything. The install is a shortcut to the live site, which is
 * exactly what is wanted.
 *
 * Colours are the token values, not approximations of them: bone is the canvas
 * and near-black is the chrome.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arkiv, an archive of investment theses",
    short_name: "Arkiv",
    description:
      "Write a thesis in plain English. An underwriter turns it into a weighted basket of tokenized equities and files the condition that would prove it wrong.",
    // The product, not the marketing page. Someone who installs this wants the app.
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#EFEDE6",
    theme_color: "#14161A",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable variants carry the safe-zone padding Android crops into, so the
      // glyph is not clipped by whatever shape the launcher applies.
      { src: "/brand/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
