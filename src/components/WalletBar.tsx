"use client";

import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";

import { Button } from "@ds";
import { chainHasUniverse, xLayer } from "@/lib/chain/chains";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Wallet control for the nav's action slot.
 *
 * The connect / wrong-network / connected branches are unchanged — only the
 * buttons they render come from the design system now.
 */
export function WalletBar() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    const injected = connectors[0];
    return (
      <span className="wallet-bar">
        <Button
          className="wallet-connect"
          variant="secondary"
          size="sm"
          disabled={!injected || isPending}
          onClick={() => injected && connect({ connector: injected })}
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </Button>
      </span>
    );
  }

  // A wrong-network prompt rather than a silently broken mint button: on X Layer
  // testnet the xStocks pools do not exist at all, so there is nothing to mint.
  if (!chainHasUniverse(chainId)) {
    return (
      <span className="wallet-bar wallet-wrong-network">
        <span className="app-label">Wrong network</span>
        <Button
          className="wallet-switch"
          variant="primary"
          size="sm"
          onClick={() => switchChain({ chainId: xLayer.id })}
        >
          Switch to X Layer
        </Button>
      </span>
    );
  }

  return (
    <span className="wallet-bar">
      <span className="wallet-address app-mono-meta">{address ? short(address) : ""}</span>
      <Button className="wallet-disconnect" variant="ghost" size="sm" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </span>
  );
}
