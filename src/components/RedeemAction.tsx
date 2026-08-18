"use client";

import { useState } from "react";
import type { Address } from "viem";
import { useAccount, useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { Button } from "@ds";
import { basketAbi } from "@/lib/chain/abis";
import { explainRevert } from "@/lib/chain/errors";
import { useChainGuard } from "@/lib/chain/guard";
import { useViewChainId } from "@/lib/ui/useViewChain";

export interface RedeemActionProps {
  basket: Address;
  /** Shares to burn. Callers pass the full balance. */
  shares: bigint;
  /** Legs, used only for the per-leg minimums array length. */
  legCount: number;
  label?: string;
  variant?: "primary" | "secondary";
  className?: string;
  onDone?: () => void;
}

/**
 * The exit, in one place.
 *
 * Both the basket page and the positions page redeem, and they call this rather
 * than each writing the transaction, so there is exactly one definition of what
 * redeeming does and no way for the two surfaces to drift into sending
 * different arguments.
 *
 * Gated on holding shares and on being on the deployment chain, and on nothing
 * else. Not on the fee, not on breach, not on pause, not on sanction state. The
 * chain check is a client-side precondition rather than a protocol gate: the
 * contract itself keeps redemption unconditional, which is R10, and a
 * transaction sent from a chain the contract is not on cannot succeed anyway.
 */
export function RedeemAction({
  basket,
  shares,
  legCount,
  label = "Redeem all, in kind",
  variant = "secondary",
  className = "",
  onDone,
}: RedeemActionProps) {
  const { address } = useAccount();
  const config = useConfig();
  const guard = useChainGuard();
  const viewChainId = useViewChainId();
  const { writeContractAsync } = useWriteContract();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function redeem() {
    if (!address || shares === 0n || !guard.ok) return;
    setError(null);
    setPending(true);
    try {
      const hash = await writeContractAsync({
        address: basket,
        abi: basketAbi,
        functionName: "redeem",
        args: [shares, address, Array.from({ length: legCount }, () => 0n)],
      });
      await waitForTransactionReceipt(config, { hash, chainId: viewChainId });
      onDone?.();
    } catch (err) {
      setError(explainRevert(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`redeem-action ${className}`.trim()}>
      <Button
        variant={variant}
        disabled={!address || shares === 0n || pending || !guard.ok}
        loading={pending}
        onClick={redeem}
      >
        {pending ? "Redeeming…" : label}
      </Button>
      {error && (
        <div className="app-error" role="alert">
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  );
}
