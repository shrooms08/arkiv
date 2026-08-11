import type { NextConfig } from "next";

const config: NextConfig = {
  // A stray lockfile above this directory otherwise makes Next infer the wrong
  // workspace root and mis-resolve the app directory.
  outputFileTracingRoot: __dirname,

  webpack: (config) => {
    // wagmi 3.7's connectors barrel re-exports a "tempo" module that imports a
    // bare `accounts` specifier which is not a real dependency. We only use the
    // injected connector, so that code path is never reached — stub it rather
    // than pinning wagmi back for an import we do not execute.
    config.resolve.alias = { ...config.resolve.alias, accounts: false };
    return config;
  },
};

export default config;
