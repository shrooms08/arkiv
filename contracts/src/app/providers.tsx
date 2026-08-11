"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { xLayer, xLayerTestnet } from "@/lib/chain/chains";

/**
 * A local fork serves chain 196 from 127.0.0.1, so the transport for X Layer is
 * overridable — that is what lets the whole flow be exercised against real pools
 * without touching mainnet.
 */
const config = createConfig({
  chains: [xLayer, xLayerTestnet],
  connectors: [injected()],
  transports: {
    [xLayer.id]: http(process.env.NEXT_PUBLIC_RPC_URL || xLayer.rpcUrls.default.http[0]),
    [xLayerTestnet.id]: http(),
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
