"use client";

import { Button } from "@ds";

import { ACTIVE_CHAIN, chainLabel } from "@/lib/chain/chains";
import type { ChainGuard } from "@/lib/chain/guard";

export interface SwitchNetworkProps {
  guard: ChainGuard;
  /** What the user was trying to do, so the prompt explains the blockage. */
  action?: string;
  className?: string;
}

/**
 * Replaces a write control when the wallet is on the wrong chain.
 *
 * It names both networks and both chain ids rather than saying "wrong network".
 * A user who has just been told they are on the wrong one still does not know
 * which one they are on, which one they need, or whether their wallet even has
 * it. All three are answered here, and the button does the fourth thing.
 */
export function SwitchNetwork({ guard, action, className = "" }: SwitchNetworkProps) {
  if (!guard.wrongChain) return null;

  return (
    <div className={`chain-guard ${className}`.trim()} role="status">
      <p className="chain-guard__text">
        This wallet is on <strong>{chainLabel(guard.connectedChainId)}</strong>. Arkiv is
        deployed on <strong>{ACTIVE_CHAIN.name} (chain {ACTIVE_CHAIN.id})</strong> and on{" "}
        <strong>X Layer (chain 196)</strong>
        {action ? `, so ${action} is unavailable here.` : "."}
      </p>

      <Button
        className="chain-guard__action"
        onClick={guard.switchToActive}
        loading={guard.switching}
        disabled={guard.switching}
      >
        {guard.switching ? "Check your wallet…" : `Switch to ${ACTIVE_CHAIN.name}`}
      </Button>

      <p className="app-note">
        If your wallet does not have {ACTIVE_CHAIN.name} yet, it will offer to add it.
      </p>

      {guard.error && (
        <p className="unavailable" role="alert">
          {guard.error}
        </p>
      )}
    </div>
  );
}
