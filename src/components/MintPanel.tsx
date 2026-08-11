"use client";

import { useEffect, useMemo, useState } from "react";
import { parseUnits, formatUnits, type Address } from "viem";
import { useAccount, useChainId, usePublicClient, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useConfig } from "wagmi";

import { USDG, assetBySymbol } from "@/config/assets";
import { arkivAbi, basketAbi, erc20Abi } from "@/lib/chain/abis";
import { chainHasUniverse } from "@/lib/chain/chains";
import { deploymentFor } from "@/lib/chain/deployments";
import { fetchMintQuotes, withSlippage, type LegQuote } from "@/lib/chain/quoter";
import { splitFor } from "@/lib/chain/impact";
import { WrapperDisclosure } from "./WrapperDisclosure";
import type { Thesis } from "@/lib/underwriting/schema";

type Step = "idle" | "creating" | "approving" | "minting" | "done" | "error";

export function MintPanel({ thesis, thesisHash }: { thesis: Thesis; thesisHash: string }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();

  const deployment = deploymentFor(chainId);
  const [amount, setAmount] = useState("100");
  const [slippageBps, setSlippageBps] = useState(100);
  const [quotes, setQuotes] = useState<LegQuote[] | null>(null);
  const [blendedBps, setBlendedBps] = useState<number | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [basketAddress, setBasketAddress] = useState<Address | null>(null);

  const usdgIn = useMemo(() => {
    try {
      return parseUnits(amount || "0", USDG.decimals);
    } catch {
      return 0n;
    }
  }, [amount]);

  const legs = useMemo(
    () =>
      thesis.holdings.map((h, i) => ({
        symbol: h.symbol,
        usdgIn: splitFor(thesis.holdings, usdgIn)[i] ?? 0n,
      })),
    [thesis.holdings, usdgIn],
  );

  // Live per-leg impact from the quoter, re-quoted whenever the size changes.
  useEffect(() => {
    if (!client || !deployment || usdgIn === 0n) {
      setQuotes(null);
      return;
    }
    let cancelled = false;
    fetchMintQuotes(client, deployment.quoter, legs)
      .then((r) => {
        if (cancelled) return;
        setQuotes(r.legs);
        setBlendedBps(r.blendedBps);
      })
      .catch(() => !cancelled && setQuotes(null));
    return () => {
      cancelled = true;
    };
  }, [client, deployment, usdgIn, legs]);

  if (!deployment) {
    return (
      <section className="mint-panel mint-unavailable">
        <h2>Mint</h2>
        <p className="unavailable">
          Arkiv is not deployed on this network, so there is nothing to mint into.
        </p>
      </section>
    );
  }

  const tokens = thesis.holdings
    .map((h) => assetBySymbol(h.symbol)?.wrapper as Address)
    .filter(Boolean);
  // The contract requires strictly ascending legs; sort holdings to match.
  const ordered = [...thesis.holdings].sort((a, b) => {
    const aw = (assetBySymbol(a.symbol)?.wrapper ?? "").toLowerCase();
    const bw = (assetBySymbol(b.symbol)?.wrapper ?? "").toLowerCase();
    return aw < bw ? -1 : aw > bw ? 1 : 0;
  });

  async function run() {
    if (!client || !address) return;
    setMessage(null);

    try {
      // 1. Create the basket. Legs must be ascending by address on-chain.
      setStep("creating");
      const createHash = await writeContractAsync({
        address: deployment!.arkiv,
        abi: arkivAbi,
        functionName: "createBasket",
        args: [
          thesis.title.slice(0, 60),
          thesis.ticker,
          ordered.map((h) => assetBySymbol(h.symbol)!.wrapper as Address),
          ordered.map((h) => h.weightBps),
          `arkiv:${thesisHash}`,
        ],
      });
      const receipt = await waitForTransactionReceipt(config, { hash: createHash });

      const created = await client.readContract({
        address: deployment!.arkiv,
        abi: arkivAbi,
        functionName: "getBaskets",
        args: [
          (await client.readContract({
            address: deployment!.arkiv,
            abi: arkivAbi,
            functionName: "basketCount",
          })) - 1n,
          1n,
        ],
      });
      const basket = (created as readonly Address[])[0]!;
      setBasketAddress(basket);
      void receipt;

      // 2. Approve exactly this mint, not an unbounded allowance.
      setStep("approving");
      const approveHash = await writeContractAsync({
        address: USDG.address as Address,
        abi: erc20Abi,
        functionName: "approve",
        args: [basket, usdgIn],
      });
      await waitForTransactionReceipt(config, { hash: approveHash });

      // 3. Mint, with floors derived from the live quotes.
      setStep("minting");
      const orderedSplit = splitFor(ordered, usdgIn);
      const minAmountsOut = ordered.map((h) => {
        const q = quotes?.find((x) => x.symbol === h.symbol);
        return q?.unitsOut ? withSlippage(q.unitsOut, slippageBps) : 0n;
      });
      // Shares are bounded by the WORST leg, so the share floor is derived from
      // the whole basket rather than from any single leg's tolerance.
      const minSharesOut =
        thesisSupplyGuess(usdgIn, slippageBps);

      const mintHash = await writeContractAsync({
        address: basket,
        abi: basketAbi,
        functionName: "mint",
        args: [usdgIn, orderedSplit, minAmountsOut, minSharesOut, address],
      });
      await waitForTransactionReceipt(config, { hash: mintHash });

      setStep("done");
    } catch (err) {
      setStep("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  const wrongNetwork = !chainHasUniverse(chainId);
  const busy = step === "creating" || step === "approving" || step === "minting";

  return (
    <section className="mint-panel">
      <h2>Mint</h2>

      <WrapperDisclosure />

      <fieldset className="mint-controls">
        <label htmlFor="amount">Amount (USDG)</label>
        <input
          id="amount"
          className="mint-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <label htmlFor="slippage">
          Slippage tolerance: {(slippageBps / 100).toFixed(2)}%
        </label>
        <input
          id="slippage"
          className="mint-slippage"
          type="range"
          min={10}
          max={500}
          step={10}
          value={slippageBps}
          onChange={(e) => setSlippageBps(Number(e.target.value))}
        />
        <p className="muted">
          Sets the per-leg <code>minAmountsOut</code> floor and the{" "}
          <code>minSharesOut</code> floor. Both are enforced on-chain against
          measured balances — the share floor matters most, because your share
          count is bounded by the <em>worst</em> leg, which per-leg floors cannot see.
        </p>
      </fieldset>

      <table className="mint-quotes">
        <thead>
          <tr>
            <th>Leg</th>
            <th className="numeric">USDG in</th>
            <th className="numeric">Price impact</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg) => {
            const q = quotes?.find((x) => x.symbol === leg.symbol);
            return (
              <tr key={leg.symbol} className="mint-quote-row">
                <td>{leg.symbol}</td>
                <td className="numeric">{formatUnits(leg.usdgIn, USDG.decimals)}</td>
                <td className="numeric">
                  {!quotes ? (
                    <span className="muted">quoting…</span>
                  ) : q?.impactBps === null || q === undefined ? (
                    <span className="unavailable">unavailable</span>
                  ) : (
                    `${q.impactBps.toFixed(0)} bp`
                  )}
                </td>
              </tr>
            );
          })}
          <tr className="mint-quote-blended">
            <th>Blended</th>
            <th className="numeric">{formatUnits(usdgIn, USDG.decimals)}</th>
            <th className="numeric">
              {blendedBps === null ? (
                <span className="unavailable">unavailable</span>
              ) : (
                `${blendedBps.toFixed(0)} bp`
              )}
            </th>
          </tr>
        </tbody>
      </table>

      {!isConnected && <p className="muted">Connect a wallet to mint.</p>}
      {isConnected && wrongNetwork && (
        <p className="unavailable">Switch to X Layer to mint.</p>
      )}

      <button
        className="mint-submit"
        disabled={!isConnected || wrongNetwork || busy || usdgIn === 0n}
        onClick={run}
      >
        {step === "creating"
          ? "Creating basket…"
          : step === "approving"
            ? "Approving USDG…"
            : step === "minting"
              ? "Minting…"
              : "Create basket and mint"}
      </button>

      {step === "done" && basketAddress && (
        <p className="mint-success">
          Minted. <a href={`/basket/${basketAddress}`}>View basket</a>
        </p>
      )}
      {step === "error" && (
        <div className="error mint-error" role="alert">
          <p>{message}</p>
        </div>
      )}
      {void tokens}
    </section>
  );
}

/**
 * Floor on shares for a FIRST mint, where the contract issues a fixed basis of
 * `usdgIn * 1e12` less the dead shares. Tolerance is applied so a partially
 * filled leg still clears.
 */
function thesisSupplyGuess(usdgIn: bigint, slippageBps: number): bigint {
  const gross = usdgIn * 10n ** 12n;
  return withSlippage(gross, slippageBps);
}
