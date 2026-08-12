"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useChainId, usePublicClient } from "wagmi";

import { Badge, Button, SerialNumber } from "@ds";
import { deploymentFor } from "@/lib/chain/deployments";
import {
  ARCHIVE_PAGE_SIZE,
  fetchBasketCount,
  fetchBasketDetails,
  fetchBasketPage,
  type ArchiveEntry,
} from "@/lib/chain/archive";

/** Age in whole units, with the unit chosen so the number stays legible. */
function ageParts(createdAt: number): { value: string; unit: string } {
  if (!createdAt) return { value: "—", unit: "unknown" };
  const days = Math.max(0, Math.floor(Date.now() / 1000 - createdAt) / 86400);
  if (days < 31) return { value: String(Math.floor(days)), unit: days < 2 ? "day" : "days" };
  if (days < 365) return { value: String(Math.round(days / 30.4)), unit: "months" };
  return { value: (days / 365).toFixed(1), unit: "years" };
}

export default function ArchivePage() {
  const client = usePublicClient();
  const chainId = useChainId();
  const deployment = deploymentFor(chainId);

  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPage(from: number) {
    if (!client || !deployment) return;
    setLoading(true);
    setError(null);
    try {
      const count = await fetchBasketCount(client, deployment.arkiv);
      setTotal(count);
      const addresses = await fetchBasketPage(client, deployment.arkiv, from, ARCHIVE_PAGE_SIZE);
      const details = await fetchBasketDetails(client, addresses);
      setEntries((prev) => (from === 0 ? details : [...prev, ...details]));
      setOffset(from + addresses.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, deployment?.arkiv]);

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
          const age = ageParts(entry.createdAt);
          return (
            <li key={entry.address} className="app-row archive-entry">
              <div className="archive-col-serial archive-cell">
                <SerialNumber index={i + 1} emphasis />
                <Badge tone="outline">Open</Badge>
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
                <Link className="archive-entry-name" href={`/basket/${entry.address}`}>
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
        <p className="app-prose">Nothing archived yet.</p>
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
