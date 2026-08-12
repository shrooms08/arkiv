import type { NextConfig } from "next";

const config: NextConfig = {
  // A stray lockfile above this directory otherwise makes Next infer the wrong
  // workspace root and mis-resolve the app directory.
  outputFileTracingRoot: __dirname,

  /**
   * The product moved from `/` to `/app` when `/` became the marketing page.
   * Every URL that worked before still resolves, permanently, so a link shared
   * yesterday does not 404 today. 308 rather than 307 because the move is not
   * coming back and search engines should carry the weight across.
   *
   * `/api/*` is deliberately absent: the API never moved and rewriting it would
   * break the underwriter route.
   */
  async redirects() {
    return [
      { source: "/archive", destination: "/app/archive", permanent: true },
      { source: "/basket/:address", destination: "/app/basket/:address", permanent: true },
      { source: "/underwrite/:id", destination: "/app/underwrite/:id", permanent: true },
    ];
  },

  webpack: (config) => {
    // wagmi 3.7's connectors barrel re-exports a "tempo" module that imports a
    // bare `accounts` specifier which is not a real dependency. We only use the
    // injected connector, so that code path is never reached: stub it rather
    // than pinning wagmi back for an import we do not execute.
    config.resolve.alias = { ...config.resolve.alias, accounts: false };
    return config;
  },
};

export default config;
