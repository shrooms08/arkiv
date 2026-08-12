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
    <div className="app-testnet-strip network-banner network-banner-testnet" role="status">
      <span className="app-testnet-dot" aria-hidden="true" />
      <span>
        X Layer testnet · every asset here is a mock · nothing on this page is a security
      </span>
    </div>
  );
}
