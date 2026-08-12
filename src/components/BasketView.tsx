"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, useChainId, usePublicClient } from "wagmi";

import {
  AllocationRibbon,
  Badge,
  FalsifierBlock,
  RoleLabel,
  SerialNumber,
  WeightNumeral,
  type RibbonSegment,
} from "@ds";
import { AddressChip } from "@/components/AddressChip";
import { CoverImage } from "@/components/CoverImage";
import { InvestPanel } from "@/components/InvestPanel";
import { USDG, assetByAddress, assetBySymbol } from "@/config/assets";
import { explainRevert } from "@/lib/chain/errors";
import { ACTIVE_CHAIN } from "@/lib/chain/chains";
import { deploymentFor, symbolFor } from "@/lib/chain/deployments";
import { fetchBasketState, type BasketState } from "@/lib/chain/archive";
import { fetchCurator, type CuratorRecord } from "@/lib/chain/curator";
import { fetchExitValuesFor, valueComposition, valueOfLeg, type LegExitValue } from "@/lib/chain/exitValue";
import { fetchMockRates } from "@/lib/chain/rates";
import { resolveCover } from "@/lib/ui/covers";
import { dsRole } from "@/lib/ui/roles";

export interface BasketRecord {
  thesisHash: string;
  index: number;
  title: string;
  summary: string;
  primaryExpression: string;
  rationales: Record<string, string>;
  falsifier: {
    claim: string;
    observable: string;
    breachCondition: string;
    horizon: string;
  };
  filedOn?: string;
}

/** Whole days since an ISO date, or null when unknown. */
function daysSince(iso?: string): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/** Months in a horizon string like "12M". Falls back to 12. */
function horizonMonths(h: string): number {
  const m = /^(\d+)\s*M$/i.exec(h.trim());
  return m ? Number(m[1]) : 12;
}

export function BasketView({
  address,
  record,
}: {
  address: Address;
  record?: BasketRecord;
}) {
  const client = usePublicClient({ chainId: ACTIVE_CHAIN.id });
  const chainId = useChainId();
  const { address: account } = useAccount();
  const deployment = deploymentFor(ACTIVE_CHAIN.id);

  const [state, setState] = useState<BasketState | null>(null);
  const [prices, setPrices] = useState<Map<Address, LegExitValue> | null>(null);
  const [rates, setRates] = useState<Map<Address, bigint> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [curator, setCurator] = useState<
    { curator: Address; record: CuratorRecord; breached: boolean } | null
  >(null);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      const s = await fetchBasketState(client, address, account);
      setState(s);
      if (deployment) {
        setPrices(await fetchExitValuesFor(client, deployment, s.tokens));
        setRates(await fetchMockRates(client, deployment, s.tokens));
        try {
          setCurator(await fetchCurator(client, deployment.arkiv, address));
        } catch {
          // A missing curator read must not blank the page.
          setCurator(null);
        }
      }
    } catch (e) {
      setError(explainRevert(e));
    }
  }, [client, address, account, deployment]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <div className="app-error" role="alert">{error}</div>;
  if (!state) return <p className="app-prose">Loading basket…</p>;

  const legs = state.tokens.map((t, i) => ({ wrapper: t, units: state.reserves[i] ?? 0n }));
  const composition = prices ? valueComposition(legs, prices) : null;

  const nameFor = (wrapper: Address) => {
    // On a mock deployment the wrapper addresses are not the mainnet ones, so
    // resolve the symbol through the manifest first.
    const sym = deployment ? symbolFor(deployment, wrapper) : undefined;
    const asset = assetByAddress(wrapper) ?? (sym ? assetBySymbol(sym) : undefined);
    return { symbol: asset?.symbol ?? sym ?? wrapper, label: asset?.label ?? "", asset };
  };

  const isPrimary = (symbol: string) => (record ? symbol === record.primaryExpression : false);

  const declared: RibbonSegment[] = legs.map((leg, i) => {
    const { symbol } = nameFor(leg.wrapper);
    return {
      id: leg.wrapper,
      label: symbol,
      weightBps: state.thesisWeightsBps[i] ?? 0,
      isPrimary: isPrimary(symbol),
    };
  });

  const current: RibbonSegment[] | undefined =
    composition && composition.priced.length > 0
      ? composition.priced.map((p) => {
          const { symbol } = nameFor(p.wrapper);
          return { id: p.wrapper, label: symbol, weightBps: p.bps, isPrimary: isPrimary(symbol) };
        })
      : undefined;

  let drift: { symbol: string; delta: number } | null = null;
  if (current) {
    for (const d of declared) {
      const c = current.find((x) => x.id === d.id);
      if (!c) continue;
      const delta = c.weightBps - d.weightBps;
      if (!drift || Math.abs(delta) > Math.abs(drift.delta)) drift = { symbol: d.label, delta };
    }
  }

  const age = daysSince(record?.filedOn);
  const months = record ? horizonMonths(record.falsifier.horizon) : 12;
  const progress = age === null ? 0 : Math.min(1, age / (months * 30.44));
  const breached = curator?.breached ?? false;
  const resolved = breached || progress >= 1;

  const art = resolveCover(state.symbol);
  const ratesPerLeg = state.tokens.map((t) => rates?.get(t) ?? null);

  return (
    <div className="basket-layout">
      <div className="basket-main">
        {/* Hero. Cover beside the title, not above it: it is the largest piece
            of non-text ink on the page and it carries the density. */}
        <header className="basket-hero">
          <div className="basket-hero__figure">
            <CoverImage
              cover={art}
              priority
              fallback={{
                ticker: state.symbol,
                index: record?.index ?? 0,
                horizon: record?.falsifier.horizon,
                segments: declared,
              }}
            />
          </div>

          <div className="basket-hero__copy">
            <div className="app-meta-row">
              {record && <SerialNumber index={record.index} emphasis />}
              {record && <span className="app-meta-sep" aria-hidden="true" />}
              <span className="app-mono-meta">{state.symbol}</span>
              <Badge tone={resolved ? "verdict" : "outline"}>
                {breached ? "Breached" : resolved ? "Resolved" : "Standing"}
              </Badge>
            </div>

            <h1 className="app-display-h1 basket-name">{record?.title ?? state.name}</h1>

            {record && (
              <div className="basket-summary">
                <p className={`app-prose${expanded ? "" : " basket-summary--clamped"}`}>
                  {record.summary}
                </p>
                <button
                  type="button"
                  className="basket-summary__toggle"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? "Show less" : "Show more"}
                </button>
              </div>
            )}

            <AddressChip address={address} />
          </div>
        </header>

        {/* The falsifier sits where a returns figure sits on every competitor
            product, and replaces it. Above the fold, never behind a tab. */}
        {record && (
          <section className="basket-section">
            <div className="app-rule-heading app-rule-heading--emphasis">
              <h2>What would prove this wrong</h2>
              <span className="app-note">
                {age === null ? "filed" : `filed ${age} day${age === 1 ? "" : "s"} ago`} ·{" "}
                {record.falsifier.horizon} horizon
              </span>
            </div>
            <FalsifierBlock
              index={record.index}
              claim={record.falsifier.claim}
              observable={record.falsifier.observable}
              breachCondition={record.falsifier.breachCondition}
              horizon={record.falsifier.horizon}
              progress={progress}
              resolved={resolved}
              breached={breached}
              filedOn={record.filedOn?.slice(0, 10)}
            />
          </section>
        )}

        {curator && (
          <section className="basket-section basket-curator">
            <div className="app-rule-heading">
              <h2>Filed by</h2>
              <span className="app-note">a record, not a score</span>
            </div>
            <div className="basket-curator__body">
              <AddressChip address={curator.curator} />
              <dl className="basket-curator__figures">
                <div>
                  <dt className="app-label">Standing</dt>
                  <dd>{curator.record.standing}</dd>
                </div>
                <div>
                  <dt className="app-label">Breached</dt>
                  <dd>{curator.record.breached}</dd>
                </div>
                <div>
                  <dt className="app-label">Filed</dt>
                  <dd>{curator.record.authored}</dd>
                </div>
              </dl>
            </div>
            <p className="app-prose">
              Claims that held, across every thesis this author has filed. Not returns: a
              return is mostly the market&rsquo;s and mostly luck, while a falsifier
              published in advance that did not trigger is evidence about the author.
            </p>
            <p className="app-note">
              On testnet the curator is the deployer for all six baskets, because the
              archive was seeded from a script. On a real deployment it is whoever calls
              createBasket.
            </p>
          </section>
        )}

        <section className="basket-section">
          <div className="app-rule-heading">
            <h2>Declared against current</h2>
            {drift ? (
              <span className="app-note">
                largest drift {drift.delta >= 0 ? "+" : ""}
                {(drift.delta / 100).toFixed(1)}pp on {drift.symbol}
              </span>
            ) : (
              <span className="app-note">current composition unavailable</span>
            )}
          </div>
          <AllocationRibbon
            segments={declared}
            compareSegments={current}
            primaryCaption="Declared at filing"
            compareCaption="Current, by exit value"
          />
          <p className="app-prose">
            The two bands are the same basket at two moments. Where the segments stop
            matching, the position has moved away from the argument that justified it. No
            rebalancing has been performed, because a filed thesis is a record and not a
            mandate.
          </p>
        </section>

        <section className="basket-section">
          <div className="app-rule-heading">
            <h2>Holdings</h2>
            <span className="app-note">
              exit values from on-chain pool depth, not a reference price
            </span>
          </div>

          {legs.map((leg, i) => {
            const { symbol, label, asset } = nameFor(leg.wrapper);
            const price = prices?.get(leg.wrapper);
            const value = price ? valueOfLeg(leg.units, price.usdgPerUnit) : null;
            const share = composition?.priced.find((p) => p.wrapper === leg.wrapper);
            const primary = isPrimary(symbol);
            const rationale = record?.rationales[symbol];
            return (
              <article
                key={leg.wrapper}
                className={`basket-holding${primary ? " basket-holding--primary" : ""}`}
              >
                <div className="basket-holding__row">
                  <span className="basket-holding__ident">
                    <span className="basket-leg__symbol">{symbol}</span>
                    <span className="app-note">{label}</span>
                    <RoleLabel role={dsRole(asset?.role)} isPrimaryExpression={primary} />
                  </span>

                  <span className="basket-holding__weights">
                    <span className="basket-holding__weight">
                      <span className="app-label">Declared</span>
                      <WeightNumeral
                        weightBps={state.thesisWeightsBps[i] ?? 0}
                        size="sm"
                        verdict={primary}
                        className="basket-weight"
                      />
                    </span>
                    <span className="basket-holding__weight">
                      <span className="app-label">Current</span>
                      <span className="basket-holding__current">
                        {share ? `${(share.bps / 100).toFixed(1)}%` : "—"}
                      </span>
                    </span>
                    <span className="basket-holding__weight">
                      <span className="app-label">Exit value</span>
                      <span className="basket-holding__current">
                        {value === null || value === undefined ? (
                          <span className="unavailable" title={price?.unavailableReason}>
                            unavailable
                          </span>
                        ) : (
                          `$${Number(formatUnits(value, USDG.decimals)).toFixed(2)}`
                        )}
                      </span>
                    </span>
                  </span>
                </div>

                {rationale && <p className="app-prose basket-holding__why">{rationale}</p>}

                <div className="app-meta-row">
                  <span className="app-label">Units held</span>
                  <span className="app-mono-meta">
                    {Number(formatUnits(leg.units, 18)).toFixed(6)}
                  </span>
                  <AddressChip address={leg.wrapper} />
                </div>
              </article>
            );
          })}

          {composition && composition.unpriced.length > 0 && (
            <p className="unavailable">
              {composition.unpriced.length} of {legs.length} legs could not be priced and
              are excluded from the current-share column.
            </p>
          )}
          <p className="app-prose">
            Exit value is what these holdings could be sold for right now, quoted against
            the same pools the basket redeems into. It is not a reference market price, and
            it already contains the depth you would actually hit.
          </p>
        </section>
      </div>

      <div className="basket-aside">
        <InvestPanel
          basket={address}
          symbol={state.symbol}
          tokens={state.tokens}
          reserves={state.reserves}
          totalSupply={state.totalSupply}
          shareBalance={state.shareBalance}
          ratesPerLeg={ratesPerLeg}
          onDone={load}
        />
      </div>
    </div>
  );
}
