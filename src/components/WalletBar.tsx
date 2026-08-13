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
 * Four states, and the one that matters most on a phone is the fourth: a
 * browser with no wallet at all. Arkiv ships only the injected connector, so
 * there is genuinely nothing to connect to in mobile Safari or stock Chrome.
 * Saying that plainly, and naming a way through, is better than an enabled
 * button that does nothing when tapped.
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
            No wallet in this browser. Arkiv connects to an injected wallet, and mobile
            Safari and Chrome do not provide one.
          </p>
          <p className="wallet-none__text">
            Open <strong>arkiv-protocol.vercel.app</strong> inside a wallet&rsquo;s own
            browser, such as <strong>OKX Wallet</strong>, and connect there. Everything
            except signing works without a wallet: the archive, every thesis, every
            falsifier and every basket reads fine from here.
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
