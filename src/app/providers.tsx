"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

import { xLayer, xLayerTestnet } from "@/lib/chain/chains";
import { arkivTransport } from "@/lib/chain/client";

/**
 * The X Layer transport is overridable via NEXT_PUBLIC_RPC_URL, which is what
 * lets the whole flow be exercised against a local fork with real pools instead
 * of against mainnet. Batch size and retries come from `arkivTransport`, tuned
 * to the public endpoint's measured limits.
 */
const config = createConfig({
  // Testnet first: it is the deployed, clickable demonstration.
  chains: [xLayerTestnet, xLayer],
  connectors: [injected()],
  transports: {
    [xLayer.id]: arkivTransport(),
    [xLayerTestnet.id]: arkivTransport(xLayerTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
