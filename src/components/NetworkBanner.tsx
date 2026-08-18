"use client";

import { chainIsTestnet } from "@/lib/chain/chains";
import { useViewChainId } from "@/lib/ui/useViewChain";

/**
 * Says plainly what the reader is looking at, on every page and above the fold.
 *
 * Two networks, two different honest warnings, and they are not
 * interchangeable. On testnet the risk is mistaking a mock for a real xStock.
 * On mainnet the assets ARE real, so that warning would be false and the risks
 * that matter are different ones: unaudited code, a single EOA owner, and an
 * empty registry.
 *
 * Never dismissable. A visitor who scrolls past it once should still be told on
 * the next page.
 */
export function NetworkBanner() {
  const viewChainId = useViewChainId();

  if (chainIsTestnet(viewChainId)) {
    return (
      <div className="app-testnet-strip network-banner network-banner-testnet" role="status">
        <span className="app-testnet-dot" aria-hidden="true" />
        <span>
          X Layer testnet · every asset here is a mock · nothing on this page is a security
        </span>
      </div>
    );
  }

  return (
    <div className="app-testnet-strip network-banner network-banner-mainnet" role="status">
      <span className="app-testnet-dot" aria-hidden="true" />
      <span>
        X Layer mainnet · real assets · unaudited, owned by a single EOA · no baskets filed
        yet · do not deposit funds you cannot afford to lose
      </span>
    </div>
  );
}
