"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits, type Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { Badge, SerialNumber } from "@ds";
import { AddressChip } from "@/components/AddressChip";
import { CoverImage } from "@/components/CoverImage";
import { RedeemAction } from "@/components/RedeemAction";
import { SwitchNetwork } from "@/components/SwitchNetwork";
import { WalletBar } from "@/components/WalletBar";
import { USDG, assetByAddress, assetBySymbol } from "@/config/assets";
import { ACTIVE_CHAIN } from "@/lib/chain/chains";
import { deploymentFor, symbolFor } from "@/lib/chain/deployments";
import { explainRevert } from "@/lib/chain/errors";
import { useChainGuard } from "@/lib/chain/guard";
import { useViewChainId } from "@/lib/ui/useViewChain";
import {
  fetchHeldBaskets,
  fetchPositionDetails,
  inKindFor,
  type HeldBasket,
  type PositionDetail,
} from "@/lib/chain/positions";
import { fetchExitValuesFor, valueOfLeg, type LegExitValue } from "@/lib/chain/exitValue";
import { resolveCover } from "@/lib/ui/covers";

/** Thesis text for a ticker, from the committed fixtures. No chain call. */
export interface ThesisMeta {
  ticker: string;
  title: string;
  horizon: string;
  filedOn?: string;
}

function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function horizonMonths(h: string | undefined): number {
  const m = /^(\d+)\s*M$/i.exec((h ?? "").trim());
  return m ? Number(m[1]) : 12;
}

export function PositionsView({ theses }: { theses: ThesisMeta[] }) {
  const { address, isConnected } = useAccount();
  const guard = useChainGuard();
  // Reads are pinned to the deployment chain, never the wallet's, so a
  // wrong-chain visitor still sees the page rather than an empty one.
  const viewChainId = useViewChainId();
  const client = usePublicClient({ chainId: viewChainId });
  const deployment = deploymentFor(viewChainId);

  const [held, setHeld] = useState<HeldBasket[] | null>(null);
  const [details, setDetails] = useState<PositionDetail[] | null>(null);
  const [prices, setPrices] = useState<Map<Address, LegExitValue> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client || !deployment || !address) return;
    setError(null);
    setHeld(null);
    setDetails(null);
    setPrices(null);
    try {
      // Stage one. Balances land first and rows paint immediately from the
      // manifest and the fixtures, so nothing waits on the slowest read.
      const h = await fetchHeldBaskets(client, deployment, address);
      setHeld(h);
      if (h.length === 0) return;

      // Stage two. Detail reads touch only the baskets actually held.
      const d = await fetchPositionDetails(client, deployment, h);
      setDetails(d);

      // Stage three. Exit values are the slowest, and the least important.
      const legs = Array.from(new Set(d.flatMap((p) => p.tokens)));
      setPrices(await fetchExitValuesFor(client, deployment, legs));
    } catch (e) {
      setError(explainRevert(e));
    }
  }, [client, deployment, address]);

  useEffect(() => {
    void load();
  }, [load]);

  const metaFor = (ticker: string) => theses.find((t) => t.ticker === ticker);

  // ---- states -------------------------------------------------------------

  if (!isConnected) {
    return (
      <section className="positions-state">
        <h2 className="positions-state__title">Connect to see your positions</h2>
        <p className="app-prose">
          Positions are read from the connected wallet, from the registry on{" "}
          {ACTIVE_CHAIN.name}. Arkiv stores nothing about you and there is no account to
          create: connect and the page reads your share balance in every filed basket.
        </p>
        <WalletBar />
        <p className="app-note">
          Nothing to connect yet? The{" "}
          <Link href="/app/archive">archive</Link> is readable without a wallet.
        </p>
      </section>
    );
  }

  if (guard.wrongChain) {
    return (
      <section className="positions-state">
        <h2 className="positions-state__title">Your positions live on another network</h2>
        <SwitchNetwork guard={guard} action="reading your positions" />
      </section>
    );
  }

  if (error) {
    return (
      <div className="app-error" role="alert">
        {error}
      </div>
    );
  }

  if (held === null) {
    return <p className="app-prose">Reading your balances…</p>;
  }

  if (held.length === 0) {
    return (
      <section className="positions-state">
        <h2 className="positions-state__title">You do not hold any theses yet</h2>
        <p className="app-prose">
          Nothing here is a failure state. A position appears once you mint into a filed
          basket, and disappears when you redeem all of it. Balances are read straight from
          chain, so this page has nothing to be out of date about.
        </p>
        <div className="positions-state__actions">
          <Link className="ark-btn ark-btn--primary" href="/app/archive">
            Read the archive
          </Link>
          <Link className="app-note" href="/app">
            or write a thesis of your own
          </Link>
        </div>
      </section>
    );
  }

  // Rows paint from `held` alone. `details` fills them in when it arrives.
  const byAddress = new Map((details ?? []).map((d) => [d.address, d]));

  const rows = held
    .map((h) => {
      const d = byAddress.get(h.address);
      const ticker = d?.symbol ?? "";
      const meta = ticker ? metaFor(ticker) : undefined;
      return { held: h, detail: d, ticker, meta };
    })
    // A breached thesis is the only thing on this page that demands a decision.
    // Everything else is passive, so it sorts below, by serial for stability.
    .sort((a, b) => {
      const ab = a.detail?.breached ? 1 : 0;
      const bb = b.detail?.breached ? 1 : 0;
      if (ab !== bb) return bb - ab;
      return a.held.index - b.held.index;
    });

  const totalExit = rows.reduce((sum, r) => {
    if (!r.detail || !prices) return sum;
    return (
      sum +
      inKindFor(r.detail).reduce((s, leg) => {
        const v = valueOfLeg(leg.units, prices.get(leg.wrapper)?.usdgPerUnit ?? null);
        return s + (v ?? 0n);
      }, 0n)
    );
  }, 0n);

  const breachedCount = rows.filter((r) => r.detail?.breached).length;

  return (
    <>
      <div className="positions-summary">
        <span className="positions-summary__item">
          <span className="app-label">Theses held</span>
          <span className="positions-summary__value">{rows.length}</span>
        </span>
        <span className="positions-summary__item">
          <span className="app-label">Arguments broken</span>
          <span
            className={`positions-summary__value${breachedCount > 0 ? " positions-summary__value--verdict" : ""}`}
          >
            {details ? breachedCount : "—"}
          </span>
        </span>
        <span className="positions-summary__item">
          <span className="app-label">Total exit value</span>
          <span className="positions-summary__value">
            {prices ? `$${Number(formatUnits(totalExit, USDG.decimals)).toFixed(2)}` : "—"}
          </span>
        </span>
      </div>
      <p className="app-note positions-summary__note">
        Exit value is what these holdings would sell for right now against the same pools
        they redeem into. Arkiv does not record what you paid, so there is no gain or loss
        figure here and any that existed would be invented.
      </p>

      <ul className="positions-list">
        {rows.map((r) => (
          <PositionRow
            key={r.held.address}
            held={r.held}
            detail={r.detail}
            meta={r.meta}
            prices={prices}
            deploymentSymbol={(w) => (deployment ? symbolFor(deployment, w) : undefined)}
            onRedeemed={load}
          />
        ))}
      </ul>
    </>
  );
}

function PositionRow({
  held,
  detail,
  meta,
  prices,
  deploymentSymbol,
  onRedeemed,
}: {
  held: HeldBasket;
  detail: PositionDetail | undefined;
  meta: ThesisMeta | undefined;
  prices: Map<Address, LegExitValue> | null;
  deploymentSymbol: (wrapper: Address) => string | undefined;
  onRedeemed: () => void;
}) {
  const [open, setOpen] = useState(false);

  const ticker = detail?.symbol ?? "";
  // Registry index plus one, from the live enumeration. Never from the ticker:
  // two baskets can share one, and the duplicate would wear the original's
  // serial.
  const serial = held.index + 1;
  const breached = detail?.breached ?? false;
  const age = daysSince(meta?.filedOn);
  const months = horizonMonths(meta?.horizon);
  const elapsed = age === null ? null : Math.min(1, age / (months * 30.44));

  const legs = detail ? inKindFor(detail) : [];
  const exitTotal =
    prices && detail
      ? legs.reduce((s, leg) => {
          const v = valueOfLeg(leg.units, prices.get(leg.wrapper)?.usdgPerUnit ?? null);
          return s + (v ?? 0n);
        }, 0n)
      : null;

  const cover = ticker ? resolveCover(ticker) : { kind: "procedural" as const };
  const shares = Number(formatUnits(held.shares, 18)).toFixed(4);

  return (
    <li className={`position${breached ? " position--breached" : ""}`}>
      <div className="position__figure">
        <CoverImage
          cover={cover}
          sizes="8rem"
          fallback={{
            ticker: ticker || "…",
            index: serial,
            horizon: meta?.horizon,
            segments: (detail?.tokens ?? []).map((t, i) => ({
              id: t,
              label: t.slice(0, 6),
              weightBps: Number(detail?.reserves[i] ?? 0n) || 1,
            })),
          }}
        />
      </div>

      <div className="position__body">
        <div className="app-meta-row">
          {serial > 0 && <SerialNumber index={serial} emphasis />}
          <span className="app-mono-meta">{ticker || "reading…"}</span>
        </div>

        <h3 className="position__title">
          {meta?.title ?? detail?.name ?? "Loading thesis…"}
        </h3>

        {/* The falsifier verdict, given more weight than the money. A holder
            owns an argument, and whether it still stands is the only thing on
            this page that can require them to do something. */}
        <div className="position__verdict">
          <Badge tone={breached ? "verdict" : "outline"}>
            {detail ? (breached ? "Argument broken" : "Standing") : "Reading…"}
          </Badge>
          <span className="app-note">
            {age === null ? "filed" : `filed ${age} day${age === 1 ? "" : "s"} ago`}
            {meta?.horizon ? ` · ${meta.horizon} horizon` : ""}
            {elapsed !== null ? ` · ${Math.round(elapsed * 100)}% elapsed` : ""}
          </span>
          {breached && (
            <p className="position__breach-note">
              The condition this thesis filed against itself has been met. It keeps its
              serial and stays in the archive, and the author stops earning from it.
            </p>
          )}
        </div>

        <dl className="position__figures">
          <div>
            <dt className="app-label">Shares held</dt>
            <dd className="position__num">
              {shares} {ticker}
            </dd>
          </div>
          <div>
            <dt className="app-label">Exit value</dt>
            <dd className="position__num">
              {exitTotal === null
                ? "—"
                : `$${Number(formatUnits(exitTotal, USDG.decimals)).toFixed(2)}`}
            </dd>
          </div>
        </dl>

        {legs.length > 0 && (
          <div className="position__inkind">
            <button
              type="button"
              className="position__toggle"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide" : "Show"} what redeeming pays out, {legs.length} legs
            </button>
            {open && (
              <ul className="position__legs">
                {legs.map((leg) => {
                  const sym = assetByAddress(leg.wrapper)?.symbol;
                  const label = sym ?? deploymentSymbol(leg.wrapper) ?? leg.wrapper.slice(0, 10);
                  const asset = sym ? assetBySymbol(sym) : undefined;
                  return (
                    <li key={leg.wrapper} className="position__leg">
                      <span className="position__leg-sym">{label}</span>
                      <span className="app-note">{asset?.label ?? ""}</span>
                      <span className="position__leg-units">
                        {Number(formatUnits(leg.units, 18)).toFixed(6)}
                      </span>
                      <AddressChip address={leg.wrapper} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="position__actions">
        <Link className="app-note" href={`/app/basket/${held.address}`}>
          Open basket
        </Link>
        <RedeemAction
          basket={held.address}
          shares={held.shares}
          legCount={detail?.tokens.length ?? 0}
          label="Redeem all"
          onDone={onRedeemed}
        />
      </div>
    </li>
  );
}
