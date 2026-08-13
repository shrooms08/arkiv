"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@ds";
import { ACTIVE_CHAIN, chainLabel } from "@/lib/chain/chains";
import { useChainGuard } from "@/lib/chain/guard";

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Is there actually a wallet in this browser?
 *
 * The injected connector is always present in the wagmi config, so its
 * existence proves nothing: on mobile Safari it renders an enabled button that
 * can never connect to anything. This asks the browser instead.
 *
 * EIP-6963 announcements are counted as well as `window.ethereum`, because a
 * modern wallet may only announce and never touch the legacy global. Returns
 * null while the answer is unknown, so nothing flashes the wrong state during
 * hydration.
 */
function useInjectedProvider(): boolean | null {
  const [present, setPresent] = useState<boolean | null>(null);

  useEffect(() => {
    let found = Boolean((window as { ethereum?: unknown }).ethereum);
    const onAnnounce = () => {
      found = true;
      setPresent(true);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // One frame for announcements to arrive before committing to "no wallet".
    const t = setTimeout(() => setPresent(found), 250);
    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      clearTimeout(t);
    };
  }, []);

  return present;
}

/**
 * Wallet control for the nav's action slot.
 *
 * Four states. The fourth is a browser with no injected provider, which is
 * every mobile Safari and stock Chrome, and it points at the OKX Wallet
 * browser.
 *
 * That is not an apology for a missing connector. Arkiv is an X Layer app, and
 * the OKX Wallet browser is where an X Layer wallet already is: on the right
 * chain, holding the OKB that pays for gas, connecting with no pairing step.
 * WalletConnect would be a second-best route to the same place. What would be
 * wrong is an enabled button that does nothing when tapped, which is what this
 * replaced.
 */
export function WalletBar() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const guard = useChainGuard();
  const hasProvider = useInjectedProvider();

  if (!isConnected) {
    if (hasProvider === false) {
      return (
        <div className="wallet-bar wallet-none">
          <p className="wallet-none__text">
            <strong>Open this in OKX Wallet to sign.</strong> Arkiv runs on X Layer, and
            the OKX Wallet browser is where an X Layer wallet already lives: it arrives on
            the right chain, holds the OKB that pays for gas, and connects without a
            pairing step.
          </p>
          <p className="wallet-none__text">
            Paste <strong>arkiv-protocol.vercel.app</strong> into the browser inside OKX
            Wallet. Nothing else changes: this is the same site, the same contracts, the
            same testnet.
          </p>
          <p className="wallet-none__text">
            Reading needs no wallet at all. The archive, every thesis, every falsifier and
            every basket&rsquo;s live composition and exit value all work from right here.
            A wallet is only needed to sign.
          </p>
        </div>
      );
    }

    const injected = connectors[0];
    return (
      <span className="wallet-bar">
        <Button
          className="wallet-connect"
          variant="secondary"
          size="sm"
          disabled={!injected || isPending || hasProvider === null}
          onClick={() => injected && connect({ connector: injected })}
        >
          {isPending ? "Connecting…" : "Connect wallet"}
        </Button>
      </span>
    );
  }

  // Wrong chain. This used to offer X Layer mainnet, where nothing is deployed,
  // so following it left the wallet on a chain with no contracts on it. The
  // target is the chain the deployment is actually on.
  if (guard.wrongChain) {
    return (
      <span className="wallet-bar wallet-wrong-network">
        <span className="app-label">{chainLabel(guard.connectedChainId)}</span>
        <Button
          className="wallet-switch"
          variant="primary"
          size="sm"
          loading={guard.switching}
          onClick={guard.switchToActive}
        >
          Switch to {ACTIVE_CHAIN.name}
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
