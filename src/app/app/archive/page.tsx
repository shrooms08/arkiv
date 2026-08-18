"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useChainId, usePublicClient } from "wagmi";

import { Badge, Button, SerialNumber } from "@ds";
import { ACTIVE_CHAIN } from "@/lib/chain/chains";
import { chainIsTestnet } from "@/lib/chain/chains";
import { useViewChainId } from "@/lib/ui/useViewChain";
import { deploymentFor } from "@/lib/chain/deployments";
import {
  ARCHIVE_PAGE_SIZE,
  fetchBasketCount,
  fetchBasketDetails,
  fetchBasketPage,
  type ArchiveEntry,
} from "@/lib/chain/archive";
import { fetchBreachFlags } from "@/lib/chain/curator";

/** Age in whole units, with the unit chosen so the number stays legible. */
function ageParts(createdAt: number): { value: string; unit: string } {
  if (!createdAt) return { value: "—", unit: "unknown" };
  const days = Math.max(0, Math.floor(Date.now() / 1000 - createdAt) / 86400);
  if (days < 31) return { value: String(Math.floor(days)), unit: days < 2 ? "day" : "days" };
  if (days < 365) return { value: String(Math.round(days / 30.4)), unit: "months" };
  return { value: (days / 365).toFixed(1), unit: "years" };
}

export default function ArchivePage() {
  const viewChainId = useViewChainId();
  const client = usePublicClient({ chainId: viewChainId });
  const chainId = useChainId();
  const deployment = deploymentFor(viewChainId);

  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breached, setBreached] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<"all" | "standing" | "breached">("all");

  /**
   * Which load is current.
   *
   * Chain changes start a new load before the previous one has resolved, and
   * the two race. The mainnet registry is empty so it answers almost instantly,
   * while testnet has seven baskets and several multicalls behind it, so the
   * STALE response routinely landed last and overwrote the fresh one. That is
   * how seven testnet theses ended up listed under a mainnet banner. Every
   * write below is gated on still being the current load.
   */
  const runId = useRef(0);

  async function loadPage(from: number, run = runId.current) {
    if (!client || !deployment) return;
    const current = () => run === runId.current;
    setLoading(true);
    setError(null);
    try {
      const count = await fetchBasketCount(client, deployment.arkiv);
      if (!current()) return;
      setTotal(count);
      const addresses = await fetchBasketPage(client, deployment.arkiv, from, ARCHIVE_PAGE_SIZE);
      const details = await fetchBasketDetails(client, addresses);
      if (!current()) return;
      setEntries((prev) => (from === 0 ? details : [...prev, ...details]));
      setOffset(from + addresses.length);

      // Breach flags are a separate multicall so a failure here cannot stop the
      // archive itself from rendering.
      try {
        const flags = await fetchBreachFlags(client, deployment.arkiv, addresses);
        if (!current()) return;
        setBreached((prev) => {
          const next = { ...prev };
          addresses.forEach((a, i) => {
            next[a.toLowerCase()] = flags[i] ?? false;
          });
          return next;
        });
      } catch {
        /* leave flags absent; rows render as standing */
      }
    } catch (e) {
      if (current()) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (current()) setLoading(false);
    }
  }

  // Keyed on the chain, and it clears first.
  //
  // Without the reset a chain change left the previous chain's rows on screen:
  // the banner said mainnet while seven testnet theses were still listed under
  // it. Rows are per-chain state, so switching chain has to discard them rather
  // than wait for the next load to overwrite them, and the effect has to depend
  // on the chain id itself rather than on objects derived from it.
  useEffect(() => {
    const run = ++runId.current;
    setEntries([]);
    setTotal(null);
    setOffset(0);
    setBreached({});
    void loadPage(0, run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewChainId, deployment?.arkiv]);

  if (!deployment) {
    return (
      <main className="app-main app-main--tight page-archive">
        <h1 className="app-display-h1">Archive</h1>
        <p className="app-lede unavailable">Arkiv is not deployed on this network.</p>
      </main>
    );
  }

  return (
    <main className="app-main app-main--tight page-archive">
      <header className="archive-header">
        <div className="archive-header__copy">
          <h1 className="app-display-h1">Archive</h1>
          <p className="app-lede">
            Every thesis filed, in the order it was filed, with the clock it is running
            against. A claim written four months ago against a twelve-month horizon is not
            history yet.
          </p>
        </div>
      </header>

      <div className="archive-filters" role="group" aria-label="Filter by claim status">
        {(["all", "standing", "breached"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`archive-filter${filter === f ? " is-selected" : ""}`}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "standing" ? "Claims that held" : "Proved wrong"}
          </button>
        ))}
        <span className="app-note">
          Ranked by claims, never by returns.
        </span>
      </div>

      <p className="app-prose archive-source-note">
        Read straight from the registry&rsquo;s on-chain array &mdash; one paginated call
        plus one multicall per page. No event scan, no indexer, and no dependency on an
        RPC tier: the public endpoint caps <code>eth_getLogs</code> at 100 blocks, which
        would make a log-derived archive stop working as the chain grows.
      </p>

      {error ? (
        <div className="app-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="app-row-head archive-row-head">
        <span className="archive-col-serial">Serial</span>
        <span className="archive-col-age">Age</span>
        <span className="archive-col-thesis">Thesis</span>
        <span className="archive-col-holdings">Holdings</span>
      </div>

      <ol className="archive-list">
        {entries.map((entry, i) => {
          const isBreached = breached[entry.address.toLowerCase()] ?? false;
          if (filter === "standing" && isBreached) return null;
          if (filter === "breached" && !isBreached) return null;
          const age = ageParts(entry.createdAt);
          return (
            <li key={entry.address} className="app-row archive-entry">
              <div className="archive-col-serial archive-cell">
                <SerialNumber index={i + 1} emphasis />
                <Badge tone={isBreached ? "verdict" : "outline"}>
                  {isBreached ? "Breached" : "Standing"}
                </Badge>
                <span className="app-label archive-address">
                  {entry.address.slice(0, 6)}…{entry.address.slice(-4)}
                </span>
              </div>

              <div className="archive-col-age archive-cell">
                <span className="archive-age">
                  <span className="archive-age__value">{age.value}</span>
                  <span className="app-label">{age.unit}</span>
                </span>
              </div>

              <div className="archive-col-thesis archive-cell">
                <Link className="archive-entry-name" href={`/app/basket/${entry.address}`}>
                  {entry.name}
                </Link>
                <div className="app-meta-row archive-entry-meta">
                  <span className="app-mono-meta">{entry.symbol}</span>
                  <span className="app-meta-sep" aria-hidden="true" />
                  <code className="app-mono-meta">
                    {entry.thesisURI || "no thesis reference"}
                  </code>
                </div>
              </div>

              <div className="archive-col-holdings archive-cell">
                <span className="app-label">Legs</span>
                <p className="app-prose archive-legs">
                  {entry.thesisWeightsBps
                    .map((bps) => `${(bps / 100).toFixed(0)}%`)
                    .join(" · ")}
                </p>
                <span className="app-note">
                  {entry.tokens.length} holding{entry.tokens.length === 1 ? "" : "s"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {entries.length === 0 && !loading ? (
        /* An empty registry is the expected state on mainnet, not a failure and
           not a load that never finished. Saying which network is empty, and
           why, is the difference between a considered empty state and a page
           that looks broken. */
        <section className="archive-empty">
          <h2 className="archive-empty__title">
            {chainIsTestnet(viewChainId)
              ? "Nothing archived yet"
              : "No theses filed on X Layer mainnet yet"}
          </h2>
          {chainIsTestnet(viewChainId) ? (
            <p className="app-prose">The registry is live and holds no baskets.</p>
          ) : (
            <>
              <p className="app-prose">
                The mainnet registry is deployed, verified and permissionless, and it is
                empty. Nothing has been filed against it because filing a basket requires
                at least 10 USDG for the first mint, and this deployment was funded for
                gas only.
              </p>
              <p className="app-prose">
                That is a funding limit, not a technical one. Any funded address can file
                the first thesis against it today, and the fee and curator economics are
                live exactly as they are on testnet.
              </p>
              <p className="app-note">
                The seven filed theses live on X Layer testnet. Switch your wallet to X
                Layer testnet, or disconnect it, and this page reads those instead:
                testnet is what the app shows by default.
              </p>
            </>
          )}
        </section>
      ) : null}

      <div className="app-meta-row">
        {total !== null && offset < total ? (
          <Button
            className="archive-more"
            variant="secondary"
            disabled={loading}
            loading={loading}
            onClick={() => loadPage(offset)}
          >
            {loading ? "Loading…" : `Load more (${total - offset} remaining)`}
          </Button>
        ) : null}
        {total !== null ? (
          <span className="app-note">
            {entries.length} of {total} records shown · serials are permanent
          </span>
        ) : null}
      </div>
    </main>
  );
}
