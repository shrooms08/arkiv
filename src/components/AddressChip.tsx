"use client";

import { useEffect, useRef, useState } from "react";
import { useChainId } from "wagmi";

import { deploymentFor } from "@/lib/chain/deployments";

/**
 * An address, truncated, with a copy affordance and an explorer link.
 *
 * The explorer base comes from the deployment manifest rather than being
 * hardcoded, so a chip on testnet points at the testnet explorer and the same
 * component keeps working if mainnet is ever configured.
 */
export function AddressChip({
  address,
  explorer,
}: {
  address?: string;
  explorer?: string;
}) {
  const chainId = useChainId();
  const deployment = deploymentFor(chainId);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!address) return null;

  const base =
    explorer ??
    (deployment ? `${deployment.explorer}/address/` : "https://www.oklink.com/xlayer-test/address/");
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  async function copy() {
    try {
      await navigator.clipboard?.writeText(address!);
    } catch {
      // Clipboard is unavailable in insecure contexts and when permission is
      // denied. The full address is still on the element's title, so failing
      // quietly leaves the user a way through rather than a false "Copied".
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <span className="app-addrchip" title={address}>
      <span className="app-addrchip__value">{short}</span>
      <button type="button" className="app-addrchip__action" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="app-meta-sep" aria-hidden="true" />
      <a
        className="app-addrchip__action"
        href={`${base}${address}`}
        target="_blank"
        rel="noreferrer"
      >
        Explorer
      </a>
    </span>
  );
}
