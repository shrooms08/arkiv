"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits, type Address } from "viem";
import { useAccount, useChainId, useConfig, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { Button } from "@ds";
import { USDG } from "@/config/assets";
import { arkivAbi, basketAbi, erc20Abi } from "@/lib/chain/abis";
import { ACTIVE_CHAIN } from "@/lib/chain/chains";
import { deploymentFor } from "@/lib/chain/deployments";
import { explainRevert } from "@/lib/chain/errors";
import { useChainGuard } from "@/lib/chain/guard";
import { withSlippage } from "@/lib/chain/quoter";
import { SwitchNetwork } from "./SwitchNetwork";
import { Faucet } from "./Faucet";
import { RedeemAction } from "./RedeemAction";

type Step = "idle" | "approving" | "minting" | "done" | "error";

const SLIPPAGE_PRESETS = [10, 50, 100, 300];

export interface InvestPanelProps {
  basket: Address;
  symbol: string;
  /** Legs in on-chain order. */
  tokens: readonly Address[];
  /** Accounted reserves per leg, same order. */
  reserves: readonly bigint[];
  totalSupply: bigint;
  shareBalance: bigint;
  /** Adapter rate per leg where the chain is mock-priced, same order. */
  ratesPerLeg: readonly (bigint | null)[];
  onDone?: () => void;
}

/**
 * Buy and exit, in the sticky column.
 *
 * Minting into a basket that already exists is `approve` then `mint`, two
 * transactions. It is NOT `createBasket -> approve -> mint`: that sequence
 * belongs to the underwrite route, where the basket does not exist yet, and
 * calling it here would deploy a duplicate basket at a new address and mint
 * into that one instead of the one on screen.
 *
 * Nothing here shows a projected value, a return or a yield. The only forward
 * number is the share count, which is what the contract will actually issue.
 */
export function InvestPanel({
  basket,
  symbol,
  tokens,
  reserves,
  totalSupply,
  shareBalance,
  ratesPerLeg,
  onDone,
}: InvestPanelProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient({ chainId: ACTIVE_CHAIN.id });
  const config = useConfig();
  const guard = useChainGuard();
  const { writeContractAsync } = useWriteContract();
  const deployment = deploymentFor(ACTIVE_CHAIN.id);

  const [amount, setAmount] = useState("100");
  const [slippageBps, setSlippageBps] = useState(100);
  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // Fee read live from the registry, never assumed. It is owner-settable inside
  // a hard cap, so a hardcoded 30 bps would eventually size the split wrongly
  // and revert the mint on SplitMismatch.
  const { data: feeBpsRaw } = useReadContract({
    address: deployment?.arkiv,
    abi: arkivAbi,
    functionName: "feeBps",
    chainId: ACTIVE_CHAIN.id,
    query: { enabled: Boolean(deployment?.arkiv) },
  });
  const { data: curatorBpsRaw } = useReadContract({
    address: deployment?.arkiv,
    abi: arkivAbi,
    functionName: "curatorBps",
    chainId: ACTIVE_CHAIN.id,
    query: { enabled: Boolean(deployment?.arkiv) },
  });
  const { data: balanceRaw, refetch: refetchBalance } = useReadContract({
    address: deployment?.usdg,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ACTIVE_CHAIN.id,
    query: { enabled: Boolean(address && deployment?.usdg) },
  });

  const feeBps = typeof feeBpsRaw === "bigint" ? feeBpsRaw : 0n;
  const curatorBps = typeof curatorBpsRaw === "bigint" ? curatorBpsRaw : 0n;
  const balance = typeof balanceRaw === "bigint" ? balanceRaw : 0n;

  const usdgIn = useMemo(() => {
    try {
      return parseUnits(amount || "0", USDG.decimals);
    } catch {
      return 0n;
    }
  }, [amount]);

  const fee = useMemo(() => (usdgIn * feeBps) / 10_000n, [usdgIn, feeBps]);
  const netUsdgIn = usdgIn - fee;
  const curatorCut = (fee * curatorBps) / 10_000n;

  /**
   * Shares the contract would issue, from the same maths it runs:
   * `shares = S * min_i(d_i / B_i)`.
   *
   * `d_i` is what the swap delivers. On a mock deployment the adapter is
   * fixed-rate, so this is exact. Against real pools it is a quote-derived
   * estimate and is labelled as one, because the binding leg is only known
   * after the swap settles. `minSharesOut` is what actually protects the mint.
   */
  const { sharesOut, exact } = useMemo(() => {
    if (netUsdgIn <= 0n || totalSupply === 0n) return { sharesOut: 0n, exact: false };

    const weightTotal = reserves.reduce((a, b) => a + b, 0n);
    if (weightTotal === 0n) return { sharesOut: 0n, exact: false };

    let worst: bigint | null = null;
    let allRatesKnown = true;

    for (let i = 0; i < tokens.length; i++) {
      const rate = ratesPerLeg[i];
      const reserve = reserves[i] ?? 0n;
      if (rate === null || rate === undefined || reserve === 0n) {
        allRatesKnown = false;
        continue;
      }
      // Split proportional to current composition, which is how the panel sizes
      // the mint, then convert to units at the leg's rate.
      const legUsdg = (netUsdgIn * reserve) / weightTotal;
      const received = (legUsdg * rate) / 10n ** 18n;
      const candidate = (totalSupply * received) / reserve;
      if (worst === null || candidate < worst) worst = candidate;
    }

    return { sharesOut: worst ?? 0n, exact: allRatesKnown };
  }, [netUsdgIn, totalSupply, reserves, tokens, ratesPerLeg]);

  const minSharesOut = useMemo(
    () => (sharesOut === 0n ? 0n : withSlippage(sharesOut, slippageBps)),
    [sharesOut, slippageBps],
  );

  useEffect(() => {
    if (step === "done") void refetchBalance();
  }, [step, refetchBalance]);

  const wrongNetwork = guard.wrongChain;
  const busy = step === "approving" || step === "minting";
  const overBalance = usdgIn > balance;

  async function mint() {
    // Belt as well as braces: the control is disabled off-chain, and the call
    // refuses anyway, so a stale render or a mid-flight wallet switch cannot
    // put a transaction on a chain the contracts are not on.
    if (!client || !address || !deployment || !guard.ok) return;
    setMessage(null);
    try {
      // 1. Approve exactly this mint, not an unbounded allowance.
      setStep("approving");
      const approveHash = await writeContractAsync({
        address: deployment.usdg,
        abi: erc20Abi,
        functionName: "approve",
        args: [basket, usdgIn],
      });
      await waitForTransactionReceipt(config, { hash: approveHash, chainId: ACTIVE_CHAIN.id });

      // 2. Mint. The split covers the POST-FEE amount and is sized to current
      // composition, which is the same shape the share maths assumes.
      setStep("minting");
      const weightTotal = reserves.reduce((a, b) => a + b, 0n);
      let assigned = 0n;
      const split = tokens.map((_, i) => {
        if (i === tokens.length - 1) return netUsdgIn - assigned;
        const part = (netUsdgIn * (reserves[i] ?? 0n)) / (weightTotal || 1n);
        assigned += part;
        return part;
      });

      const mintHash = await writeContractAsync({
        address: basket,
        abi: basketAbi,
        functionName: "mint",
        args: [usdgIn, split, tokens.map(() => 0n), minSharesOut, address],
      });
      await waitForTransactionReceipt(config, { hash: mintHash, chainId: ACTIVE_CHAIN.id });

      setStep("done");
      onDone?.();
    } catch (err) {
      setStep("error");
      setMessage(explainRevert(err));
    }
  }

  const money = (v: bigint) => Number(formatUnits(v, USDG.decimals)).toFixed(2);
  const shares = (v: bigint) => Number(formatUnits(v, 18)).toFixed(4);

  return (
    <aside className="invest" aria-label="Invest">
      <div className="invest__head">
        <h2 className="invest__title">Mint {symbol}</h2>
        <span className="app-label">testnet USDG</span>
      </div>

      <Faucet />

      <div className="invest__field">
        <div className="invest__field-head">
          <label className="app-label" htmlFor="invest-amount">
            Amount
          </label>
          <span className="app-note">
            Balance {money(balance)}{" "}
            <button
              type="button"
              className="invest__max"
              onClick={() => setAmount(formatUnits(balance, USDG.decimals))}
              disabled={balance === 0n}
            >
              Max
            </button>
          </span>
        </div>
        <input
          id="invest-amount"
          className="mint-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="invest__field">
        <span className="app-label" id="invest-slip">
          Max slippage
        </span>
        <div className="mint-slippage-row" role="group" aria-labelledby="invest-slip">
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
        </div>
      </div>

      <dl className="invest__rows">
        <div className="invest__row">
          <dt>Shares out</dt>
          <dd>
            {shares(sharesOut)} {symbol}
            {!exact && <span className="app-note"> n/a (mock)</span>}
          </dd>
        </div>
        <div className="invest__row">
          <dt>Minimum accepted</dt>
          <dd>{shares(minSharesOut)}</dd>
        </div>
        <div className="invest__row invest__row--fee">
          <dt>
            Mint fee <span className="app-note">{(Number(feeBps) / 100).toFixed(2)}%</span>
          </dt>
          <dd>{money(fee)}</dd>
        </div>
        <div className="invest__row">
          <dt>
            To the author{" "}
            <span className="app-note">{(Number(curatorBps) / 100).toFixed(0)}% of fee</span>
          </dt>
          <dd>{money(curatorCut)}</dd>
        </div>
        <div className="invest__row invest__row--total">
          <dt>Buys legs</dt>
          <dd>{money(netUsdgIn)}</dd>
        </div>
      </dl>

      <p className="app-note invest__note">
        The author&rsquo;s share stops permanently if this thesis is ever breached.
        Redemption charges nothing, at any fee setting.
      </p>

      {!isConnected && <p className="app-prose">Connect a wallet to mint.</p>}
      <SwitchNetwork guard={guard} action="minting" />
      {isConnected && overBalance && (
        <p className="unavailable">Amount is above your balance.</p>
      )}

      <Button
        className="invest__submit"
        size="lg"
        disabled={!isConnected || wrongNetwork || busy || usdgIn === 0n || overBalance}
        loading={busy}
        onClick={mint}
      >
        {step === "approving"
          ? "Approving USDG…"
          : step === "minting"
            ? "Minting…"
            : `Mint ${symbol}`}
      </Button>

      <ol className="invest__stages" aria-label="Transaction stages">
        <li className={step === "approving" ? "is-active" : ""}>1. Approve USDG</li>
        <li className={step === "minting" ? "is-active" : ""}>2. Mint shares</li>
      </ol>

      {step === "done" && <p className="mint-success">Minted.</p>}
      {step === "error" && (
        <div className="app-error" role="alert">
          <p style={{ margin: 0 }}>{message}</p>
        </div>
      )}

      <div className="invest__exit">
        <div className="invest__exit-head">
          <span className="app-label">Your position</span>
          <span className="invest__position">
            {shares(shareBalance)} {symbol}
          </span>
        </div>
        <RedeemAction
          className="invest__redeem"
          basket={basket}
          shares={shareBalance}
          legCount={tokens.length}
          onDone={onDone}
        />
        <p className="app-note">
          Redemption pays your pro-rata slice of every leg in kind. It touches no pool and
          can never be paused.
        </p>
      </div>
    </aside>
  );
}
