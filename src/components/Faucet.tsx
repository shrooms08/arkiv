"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useChainId, useConfig, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { Button } from "@ds";
import { erc20Abi } from "@/lib/chain/abis";
import { deploymentFor } from "@/lib/chain/deployments";
import { explainRevert } from "@/lib/chain/errors";

const faucetAbi = [
  { type: "function", name: "faucet", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

/**
 * Testnet USDG, in the mint flow rather than on another page.
 *
 * Anything that makes someone give up before they mint costs more than any
 * feature does — so the faucet lives where the need arises, and the gas faucet
 * is linked right next to it because a visitor with no OKB is just as stuck.
 */
export function Faucet() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const deployment = deploymentFor(chainId);
  const { writeContractAsync } = useWriteContract();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: balance, refetch } = useReadContract({
    address: deployment?.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && deployment?.mockUsdg) },
  });

  if (!deployment?.mockUsdg) return null;

  async function claim() {
    setPending(true);
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: deployment!.mockUsdg!,
        abi: faucetAbi,
        functionName: "faucet",
      });
      await waitForTransactionReceipt(config, { hash });
      await refetch();
    } catch (e) {
      setError(explainRevert(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <aside className="faucet">
      <div className="faucet__head">
        <span className="app-label">Need testnet funds?</span>
        {balance !== undefined ? (
          <span className="faucet-balance app-mono-meta">
            You hold ${Number(formatUnits(balance as bigint, 6)).toLocaleString()} mUSDG
          </span>
        ) : null}
      </div>
      <div className="app-meta-row">
        <Button
          className="faucet-claim"
          variant="secondary"
          size="sm"
          disabled={!isConnected || pending}
          loading={pending}
          onClick={claim}
        >
          {pending ? "Claiming…" : "Get 10,000 test USDG"}
        </Button>
        <a
          className="faucet-gas-link app-note"
          href="https://www.okx.com/xlayer/faucet"
          target="_blank"
          rel="noreferrer"
        >
          Need OKB for gas?
        </a>
      </div>
      {error ? (
        <p className="app-error faucet-error" role="alert">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
