"use client";

import { useChainId } from "wagmi";

import { chainUsesMocks } from "@/lib/chain/chains";

/**
 * Says plainly what the assets on this network are. Deployed mocks are a fair
 * demonstration of the mechanism; mocks a visitor mistakes for real xStocks are
 * not. Shown on every page, above the fold, not in a dismissable modal.
 */
export function NetworkBanner() {
  const chainId = useChainId();
  if (!chainUsesMocks(chainId)) return null;

  return (
    <aside className="network-banner network-banner-testnet">
      <strong>Testnet — these assets are mocks.</strong> The tokens here are
      stand-ins with fixed prices and a public faucet, deployed so the mechanism
      can be used without holding anything real. On X Layer mainnet, Arkiv holds
      genuine xStocks issued by Backed against real USDG liquidity.
    </aside>
  );
}
