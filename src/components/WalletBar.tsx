"use client";

import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";

import { chainHasUniverse, xLayer } from "@/lib/chain/chains";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

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
        <button
          className="wallet-connect"
          disabled={!injected || isPending}
          onClick={() => injected && connect({ connector: injected })}
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </button>
      </span>
    );
  }

  // A wrong-network prompt rather than a silently broken mint button: on X Layer
  // testnet the xStocks pools do not exist at all, so there is nothing to mint.
  if (!chainHasUniverse(chainId)) {
    return (
      <span className="wallet-bar wallet-wrong-network">
        <span className="muted">Wrong network</span>{" "}
        <button className="wallet-switch" onClick={() => switchChain({ chainId: xLayer.id })}>
          Switch to X Layer
        </button>
      </span>
    );
  }

  return (
    <span className="wallet-bar">
      <span className="wallet-address">{address ? short(address) : ""}</span>{" "}
      <button className="wallet-disconnect" onClick={() => disconnect()}>
        Disconnect
      </button>
    </span>
  );
}
