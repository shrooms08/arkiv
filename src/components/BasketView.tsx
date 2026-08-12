"use client";

import { useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, useChainId, useConfig, usePublicClient, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import {
  AllocationRibbon,
  Badge,
  Button,
  FalsifierBlock,
  RoleLabel,
  SerialNumber,
  WeightNumeral,
  type RibbonSegment,
} from "@ds";
import { AddressChip } from "@/components/AddressChip";
import { USDG, assetByAddress, assetBySymbol } from "@/config/assets";
import { basketAbi } from "@/lib/chain/abis";
import { explainRevert } from "@/lib/chain/errors";
import { deploymentFor, symbolFor } from "@/lib/chain/deployments";
import { dsRole } from "@/lib/ui/roles";
import { fetchBasketState, type BasketState } from "@/lib/chain/archive";
import { fetchCurator, type CuratorRecord } from "@/lib/chain/curator";
import { fetchExitValuesFor, valueComposition, valueOfLeg, type LegExitValue } from "@/lib/chain/exitValue";

export interface BasketRecord {
  thesisHash: string;
  input: string;
  index: number;
  primaryExpression: string;
  falsifier: {
    claim: string;
    observable: string;
    breachCondition: string;
    horizon: string;
  };
}

export function BasketView({
  address,
  record,
}: {
  address: Address;
  record?: BasketRecord;
}) {
  const client = usePublicClient();
  const chainId = useChainId();
  const config = useConfig();
  const { address: account } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const deployment = deploymentFor(chainId);

  const [state, setState] = useState<BasketState | null>(null);
  const [prices, setPrices] = useState<Map<Address, LegExitValue> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [curator, setCurator] = useState<
    { curator: Address; record: CuratorRecord; breached: boolean } | null
  >(null);

  async function load() {
    if (!client) return;
    try {
      const s = await fetchBasketState(client, address, account);
      setState(s);
      if (deployment) {
        setPrices(await fetchExitValuesFor(client, deployment, s.tokens));
        // Best-effort: a missing curator read must not blank the whole page.
        try {
          setCurator(await fetchCurator(client, deployment.arkiv, address));
        } catch {
          setCurator(null);
        }
      }
    } catch (e) {
      setError(explainRevert(e));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, address, account, deployment?.quoter]);

  if (error) return <div className="app-error" role="alert">{error}</div>;
  if (!state) return <p className="app-prose">Loading basket…</p>;

  const legs = state.tokens.map((t, i) => ({ wrapper: t, units: state.reserves[i] ?? 0n }));
  const composition = prices ? valueComposition(legs, prices) : null;

  const nameFor = (wrapper: Address) => {
    // On a mock deployment the wrapper addresses are not the mainnet ones, so
    // resolve symbol via the deployment manifest first.
    const sym = deployment ? symbolFor(deployment, wrapper) : undefined;
    const asset = assetByAddress(wrapper) ?? (sym ? assetBySymbol(sym) : undefined);
    return { symbol: asset?.symbol ?? sym ?? wrapper, label: asset?.label ?? "", asset };
  };

  const declared: RibbonSegment[] = legs.map((leg, i) => {
    const { symbol } = nameFor(leg.wrapper);
    return {
      id: leg.wrapper,
      label: symbol,
      weightBps: state.thesisWeightsBps[i] ?? 0,
      isPrimary: record ? symbol === record.primaryExpression : false,
    };
  });

  const current: RibbonSegment[] | undefined = composition && composition.priced.length > 0
    ? composition.priced.map((p) => {
        const { symbol } = nameFor(p.wrapper);
        return {
          id: p.wrapper,
          label: symbol,
          weightBps: p.bps,
          isPrimary: record ? symbol === record.primaryExpression : false,
        };
      })
    : undefined;

  // Largest declared-vs-current gap, so the drift note names a leg rather than
  // asking the reader to diff two bands by eye.
  let drift: { symbol: string; delta: number } | null = null;
  if (current) {
    for (const d of declared) {
      const c = current.find((x) => x.id === d.id);
      if (!c) continue;
      const delta = c.weightBps - d.weightBps;
      if (!drift || Math.abs(delta) > Math.abs(drift.delta)) {
        drift = { symbol: d.label, delta };
      }
    }
  }

  async function redeem() {
    if (!account || !state) return;
    setRedeeming(true);
    try {
      const hash = await writeContractAsync({
        address,
        abi: basketAbi,
        functionName: "redeem",
        args: [state.shareBalance, account, state.tokens.map(() => 0n)],
      });
      await waitForTransactionReceipt(config, { hash });
      await load();
    } catch (e) {
      setError(explainRevert(e));
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <>
      <header className="basket-header">
        <div className="app-meta-row">
          {record && <SerialNumber index={record.index} emphasis />}
          {record && <span className="app-meta-sep" aria-hidden="true" />}
          <span className="app-mono-meta basket-symbol">{state.symbol}</span>
          <span className="app-meta-sep" aria-hidden="true" />
          <AddressChip address={address} />
          <Badge tone="outline">Open</Badge>
        </div>
        <h1 className="app-display-h1 basket-name">{state.name}</h1>

        {curator && (
          <div className="basket-curator">
            <div className="basket-curator__who">
              <span className="app-label">Filed by</span>
              <AddressChip address={curator.curator} />
              {curator.breached && <Badge tone="verdict">Falsifier breached</Badge>}
            </div>
            <div className="basket-curator__record">
              <span className="app-label">Their record</span>
              <span className="basket-curator__figures">
                <span>
                  <strong>{curator.record.standing}</strong> standing
                </span>
                <span>
                  <strong>{curator.record.breached}</strong> breached
                </span>
                <span>
                  <strong>{curator.record.authored}</strong> filed
                </span>
              </span>
              <span className="app-note">
                Claims that held, not returns. A falsifier published in advance that
                did not trigger is evidence; a return is mostly luck.
              </span>
            </div>
          </div>
        )}
      </header>

      <section className="app-panel app-panel--marked basket-composition">
        <div className="app-rule-heading" style={{ borderBlockEnd: "none", paddingBlockEnd: 0 }}>
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
          matching, the position has moved away from the argument that justified it — no
          rebalancing has been performed, because a filed thesis is a record, not a
          mandate.
        </p>
      </section>

      <section className="basket-holdings">
        <div className="app-rule-heading">
          <h2>Holdings and exit value</h2>
          <span className="app-note">
            values from on-chain pool depth, not a reference price
          </span>
        </div>

        <div className="app-row-head basket-row-head">
          <span className="basket-col-leg">Leg</span>
          <span className="basket-col-num">Declared</span>
          <span className="basket-col-num">Units held</span>
          <span className="basket-col-num">Exit value</span>
          <span className="basket-col-num">Current</span>
        </div>

        {legs.map((leg, i) => {
          const { symbol, label, asset } = nameFor(leg.wrapper);
          const price = prices?.get(leg.wrapper);
          const value = price ? valueOfLeg(leg.units, price.usdgPerUnit) : null;
          const share = composition?.priced.find((p) => p.wrapper === leg.wrapper);
          const isPrimary = record ? symbol === record.primaryExpression : false;
          return (
            <div
              key={leg.wrapper}
              className={`app-row basket-leg${isPrimary ? " basket-leg--primary" : ""}`}
            >
              <div className="basket-col-leg basket-leg__ident">
                <div className="app-meta-row" style={{ gap: "var(--space-2)" }}>
                  <span className="basket-leg__symbol">{symbol}</span>
                  <span className="app-note">{label}</span>
                </div>
                <RoleLabel role={dsRole(asset?.role)} isPrimaryExpression={isPrimary} />
                <AddressChip address={leg.wrapper} />
              </div>

              <span className="basket-col-num app-num">
                <WeightNumeral
                  weightBps={state.thesisWeightsBps[i] ?? 0}
                  size="sm"
                  verdict={isPrimary}
                  className="basket-weight"
                />
              </span>

              <span className="basket-col-num app-num">
                {Number(formatUnits(leg.units, 18)).toFixed(6)}
              </span>

              <span className="basket-col-num app-num">
                {value === null || value === undefined ? (
                  <span className="unavailable" title={price?.unavailableReason}>
                    unavailable
                  </span>
                ) : (
                  `$${Number(formatUnits(value, USDG.decimals)).toFixed(2)}`
                )}
              </span>

              <span className="basket-col-num app-num">
                {share ? `${(share.bps / 100).toFixed(2)}%` : <span className="unavailable">—</span>}
              </span>
            </div>
          );
        })}

        <p className="app-prose exit-value-note">
          Exit value is what these holdings could be sold for right now, quoted against
          the same on-chain pools the basket redeems into &mdash; <strong>not</strong> a
          reference market price. It already contains the depth you would actually hit, so
          it will differ from the equity&rsquo;s quoted price. That difference is real
          information, not an error.
        </p>
        {composition && composition.unpriced.length > 0 && (
          <p className="unavailable">
            {composition.unpriced.length} of {legs.length} legs could not be priced and are
            excluded from the current-share column.
          </p>
        )}
        <p className="app-prose">
          Thesis weights are immutable and were declared at creation. What one share is
          backed by, in units, does not move when other people mint &mdash; so any drift
          between the two columns is the legs&rsquo; prices moving, which is the
          performance of the thesis.
        </p>
      </section>

      <section className="app-panel app-panel--raised basket-position">
        <h2 className="basket-position__heading">Your position</h2>
        <div className="basket-position__figures">
          <span className="basket-figure">
            <span className="app-label">Shares</span>
            <span className="basket-figure__value basket-balance">
              {Number(formatUnits(state.shareBalance, 18)).toFixed(6)}
            </span>
          </span>
          <span className="basket-figure">
            <span className="app-label">Ticker</span>
            <span className="basket-figure__value">{state.symbol}</span>
          </span>
        </div>
        <Button
          className="basket-redeem"
          variant="primary"
          disabled={!account || state.shareBalance === 0n || redeeming}
          loading={redeeming}
          onClick={redeem}
        >
          {redeeming ? "Redeeming…" : "Redeem all (in kind)"}
        </Button>
        <p className="app-prose">
          Redemption pays out your pro-rata slice of every leg as tokens. It touches no
          pool, so it is not exposed to liquidity at all, and it can never be paused.
        </p>
      </section>

      {record && (
        <section className="basket-falsifier">
          <div className="app-rule-heading app-rule-heading--emphasis">
            <h2>The falsifier, as filed</h2>
            <span className="app-note">written with the thesis · unchanged since filing</span>
          </div>
          <FalsifierBlock
            index={record.index}
            claim={record.falsifier.claim}
            observable={record.falsifier.observable}
            breachCondition={record.falsifier.breachCondition}
            horizon={record.falsifier.horizon}
            progress={0}
          />
        </section>
      )}
    </>
  );
}
