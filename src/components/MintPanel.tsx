"use client";

import { useEffect, useMemo, useState } from "react";
import { parseUnits, formatUnits, type Address } from "viem";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { useConfig } from "wagmi";

import { Button } from "@ds";
import { USDG, assetBySymbol } from "@/config/assets";
import { arkivAbi, basketAbi, erc20Abi } from "@/lib/chain/abis";
import { ACTIVE_CHAIN } from "@/lib/chain/chains";
import { deploymentFor, wrapperFor } from "@/lib/chain/deployments";
import { useChainGuard } from "@/lib/chain/guard";
import { fetchRegistry, findFiling, type RegistryEntry } from "@/lib/chain/registry";
import { fetchMintQuotes, withSlippage, type LegQuote } from "@/lib/chain/quoter";
import { Faucet } from "./Faucet";
import { ExistingFilingMint } from "./ExistingFilingMint";
import { SwitchNetwork } from "./SwitchNetwork";
import { splitFor } from "@/lib/chain/impact";
import { explainRevert } from "@/lib/chain/errors";
import type { Thesis } from "@/lib/underwriting/schema";

type Step = "idle" | "creating" | "approving" | "minting" | "done" | "error";

const SLIPPAGE_PRESETS = [10, 50, 100, 300];

export function MintPanel({
  thesis,
  thesisHash,
  onAmountChange,
}: {
  thesis: Thesis;
  thesisHash: string;
  /** Reports the typed amount so a collapsed action bar can display it. */
  onAmountChange?: (display: string) => void;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const guard = useChainGuard();
  // undefined while the registry is being read, null when this thesis is new.
  const [existing, setExisting] = useState<RegistryEntry | null | undefined>(undefined);
  const client = usePublicClient({ chainId: ACTIVE_CHAIN.id });
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();

  const deployment = deploymentFor(ACTIVE_CHAIN.id);

  // The fee is read from the registry, never assumed. It is owner-settable
  // within a hard cap, so a hardcoded 30 bps here would eventually size the
  // split wrongly and revert the mint on SplitMismatch.
  const { data: feeBpsRaw } = useReadContract({
    address: deployment?.arkiv,
    abi: arkivAbi,
    functionName: "feeBps",
    chainId: ACTIVE_CHAIN.id,
    query: { enabled: Boolean(deployment?.arkiv) },
  });
  const feeBps = typeof feeBpsRaw === "bigint" ? feeBpsRaw : 0n;

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

  // Fee first, then split the remainder — the same order the contract uses.
  const fee = useMemo(() => (usdgIn * feeBps) / 10_000n, [usdgIn, feeBps]);
  const netUsdgIn = useMemo(() => usdgIn - fee, [usdgIn, fee]);

  const legs = useMemo(
    () =>
      thesis.holdings.map((h, i) => ({
        symbol: h.symbol,
        usdgIn: splitFor(thesis.holdings, netUsdgIn)[i] ?? 0n,
      })),
    [thesis.holdings, netUsdgIn],
  );

  // Live per-leg impact from the quoter, re-quoted whenever the size changes.
  // Only meaningful where real pools exist: the testnet adapter is fixed-rate
  // with no depth, so there is no impact to measure and the table says so
  // rather than printing a 0 bp that looks like a measurement.
  useEffect(() => {
    if (!client || !deployment?.quoter || usdgIn === 0n) {
      setQuotes(null);
      return;
    }
    const quoter = deployment.quoter;
    let cancelled = false;
    fetchMintQuotes(client, quoter, legs)
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
      <section className="app-panel mint-panel mint-unavailable">
        <h2 className="mint-panel__heading">Mint</h2>
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
    const aw = (wrapperFor(deployment, a.symbol) ?? "").toLowerCase();
    const bw = (wrapperFor(deployment, b.symbol) ?? "").toLowerCase();
    return aw < bw ? -1 : aw > bw ? 1 : 0;
  });

  // Has this exact thesis already been filed? Matching on hash, never on ticker
  // or title, because both are chosen by whoever files and a second filing under
  // an existing ticker is precisely the case being caught.
  useEffect(() => {
    let live = true;
    (async () => {
      if (!client || !deployment) return;
      try {
        const registry = await fetchRegistry(client, deployment.arkiv);
        const hit = findFiling(registry, thesisHash);
        if (live) setExisting(hit ?? null);
      } catch {
        // A failed lookup must not block filing. The worst case is the old
        // behaviour, which is a duplicate, and that is better than a dead panel.
        if (live) setExisting(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [client, deployment, thesisHash]);

  async function run() {
    // The three-transaction flow refuses at its own entry point too, so a
    // wallet that changes chain between render and click cannot start it.
    if (!guard.ok) return;
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
          ordered.map((h) => wrapperFor(deployment!, h.symbol)!),
          ordered.map((h) => h.weightBps),
          `arkiv:${thesisHash}`,
        ],
      });
      const receipt = await waitForTransactionReceipt(config, { hash: createHash, chainId: ACTIVE_CHAIN.id });

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
        address: deployment!.usdg,
        abi: erc20Abi,
        functionName: "approve",
        args: [basket, usdgIn],
      });
      await waitForTransactionReceipt(config, { hash: approveHash, chainId: ACTIVE_CHAIN.id });

      // 3. Mint, with floors derived from the live quotes.
      setStep("minting");
      const orderedSplit = splitFor(ordered, netUsdgIn);
      const minAmountsOut = ordered.map((h) => {
        const q = quotes?.find((x) => x.symbol === h.symbol);
        return q?.unitsOut ? withSlippage(q.unitsOut, slippageBps) : 0n;
      });
      // Shares are bounded by the WORST leg, so the share floor is derived from
      // the whole basket rather than from any single leg's tolerance.
      const minSharesOut =
        thesisSupplyGuess(netUsdgIn, slippageBps);

      const mintHash = await writeContractAsync({
        address: basket,
        abi: basketAbi,
        functionName: "mint",
        args: [usdgIn, orderedSplit, minAmountsOut, minSharesOut, address],
      });
      await waitForTransactionReceipt(config, { hash: mintHash, chainId: ACTIVE_CHAIN.id });

      setStep("done");
    } catch (err) {
      setStep("error");
      setMessage(explainRevert(err));
    }
  }

  useEffect(() => {
    onAmountChange?.(amount ? `${amount} USDG` : "");
  }, [amount, onAmountChange]);

  const wrongNetwork = guard.wrongChain;
  const busy = step === "creating" || step === "approving" || step === "minting";

  // Already on the record. Buy into it rather than filing a second copy: the
  // duplicate would make this caller the curator of someone else's thesis and
  // divert the curator stream to them.
  if (existing) {
    return (
      <section className="app-panel app-panel--raised mint-panel">
        <ExistingFilingMint filing={existing} serial={existing.index + 1} />
      </section>
    );
  }

  return (
    <section className="app-panel app-panel--raised mint-panel">
      <div className="app-rule-heading" style={{ borderBlockEnd: "none", paddingBlockEnd: 0 }}>
        <h2 className="mint-panel__heading">Mint</h2>
        <span className="app-label">testnet USDG</span>
      </div>

      <Faucet />

      <fieldset className="mint-controls">
        <label className="app-label" htmlFor="amount">
          Amount (USDG)
        </label>
        <input
          id="amount"
          className="mint-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <span className="app-label" id="slippage-label">
          Max slippage
        </span>
        <div className="mint-slippage-row" role="group" aria-labelledby="slippage-label">
          {SLIPPAGE_PRESETS.map((bps) => (
            <button
              key={bps}
              type="button"
              className={`mint-slippage-preset${slippageBps === bps ? " is-selected" : ""}`}
              aria-pressed={slippageBps === bps}
              onClick={() => setSlippageBps(bps)}
            >
              {(bps / 100).toFixed(bps < 100 ? 1 : 0)}%
            </button>
          ))}
          <input
            id="slippage"
            className="mint-slippage"
            type="range"
            min={10}
            max={500}
            step={10}
            value={slippageBps}
            onChange={(e) => setSlippageBps(Number(e.target.value))}
            aria-label={`Slippage tolerance ${(slippageBps / 100).toFixed(2)} percent`}
          />
        </div>
        <p className="app-prose">
          Sets the per-leg <code>minAmountsOut</code> floor and the{" "}
          <code>minSharesOut</code> floor. Both are enforced on-chain against
          measured balances — the share floor matters most, because your share
          count is bounded by the <em>worst</em> leg, which per-leg floors cannot see.
        </p>
      </fieldset>

      <div className="mint-quotes">
        <div className="mint-quotes__head">
          <span className="mint-col-leg">Leg</span>
          <span className="mint-col-num">USDG in</span>
          <span className="mint-col-num">Price impact</span>
        </div>
        {legs.map((leg) => {
          const q = quotes?.find((x) => x.symbol === leg.symbol);
          return (
            <div key={leg.symbol} className="mint-quotes__row mint-quote-row">
              <span className="mint-col-leg">{leg.symbol}</span>
              <span className="mint-col-num">{formatUnits(leg.usdgIn, USDG.decimals)}</span>
              <span className="mint-col-num">
                {!deployment.quoter ? (
                  <span
                    className="unavailable"
                    title="Fixed-rate mock adapter — no pool depth to measure against."
                  >
                    n/a (mock)
                  </span>
                ) : !quotes ? (
                  <span className="unavailable">quoting…</span>
                ) : q?.impactBps === null || q === undefined ? (
                  <span className="unavailable">unavailable</span>
                ) : (
                  `${q.impactBps.toFixed(0)} bp`
                )}
              </span>
            </div>
          );
        })}
        <div className="mint-quotes__row mint-quote-fee">
          <span className="mint-col-leg">
            Mint fee
            <span className="app-note mint-fee-bps"> {(Number(feeBps) / 100).toFixed(2)}%</span>
          </span>
          <span className="mint-col-num">{formatUnits(fee, USDG.decimals)}</span>
          <span className="mint-col-num app-note">taken before the split</span>
        </div>
        <div className="mint-quotes__row mint-quote-blended">
          <span className="mint-col-leg">You pay</span>
          <span className="mint-col-num">{formatUnits(usdgIn, USDG.decimals)}</span>
          <span className="mint-col-num">
            {!deployment.quoter ? (
              <span className="unavailable">n/a (mock)</span>
            ) : blendedBps === null ? (
              <span className="unavailable">unavailable</span>
            ) : (
              `${blendedBps.toFixed(0)} bp`
            )}
          </span>
        </div>
      </div>

      <p className="app-prose mint-fee-note">
        You pay <strong>{formatUnits(usdgIn, USDG.decimals)} USDG</strong>. A{" "}
        {(Number(feeBps) / 100).toFixed(2)}% mint fee of{" "}
        <strong>{formatUnits(fee, USDG.decimals)} USDG</strong> is taken first, and{" "}
        <strong>{formatUnits(netUsdgIn, USDG.decimals)} USDG</strong> buys the legs.
        Half the fee accrues to the curator who filed this thesis — and stops
        permanently if its falsifier is ever breached. Redemption charges nothing.
      </p>

      {!isConnected && <p className="app-prose">Connect a wallet to mint.</p>}
      <SwitchNetwork guard={guard} action="filing this thesis on chain" />

      <Button
        className="mint-submit"
        size="lg"
        disabled={!guard.ok || busy || usdgIn === 0n}
        loading={busy}
        onClick={run}
      >
        {step === "creating"
          ? "Creating basket…"
          : step === "approving"
            ? "Approving USDG…"
            : step === "minting"
              ? "Minting…"
              : `Mint ${thesis.ticker}`}
      </Button>

      {step === "done" && basketAddress && (
        <p className="mint-success">
          Minted. <a href={`/app/basket/${basketAddress}`}>View basket</a>
        </p>
      )}
      {step === "error" && (
        <div className="app-error mint-error" role="alert">
          <p style={{ margin: 0 }}>{message}</p>
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
