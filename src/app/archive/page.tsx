"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useChainId, usePublicClient } from "wagmi";

import { deploymentFor } from "@/lib/chain/deployments";
import {
  ARCHIVE_PAGE_SIZE,
  fetchBasketCount,
  fetchBasketDetails,
  fetchBasketPage,
  type ArchiveEntry,
} from "@/lib/chain/archive";

function age(createdAt: number): string {
  if (!createdAt) return "unknown age";
  const days = Math.floor((Date.now() / 1000 - createdAt) / 86400);
  if (days < 1) return "written today";
  if (days === 1) return "1 day old";
  return `${days} days old`;
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
      <main className="page-archive">
        <h1>Archive</h1>
        <p className="unavailable">Arkiv is not deployed on this network.</p>
      </main>
    );
  }

  return (
    <main className="page-archive">
      <h1>Archive</h1>
      <p className="muted">
        Every thesis ever written, in the order they were written.
        {total !== null ? ` ${total} basket${total === 1 ? "" : "s"}.` : ""}
      </p>
      <p className="muted archive-source-note">
        Read straight from the registry&rsquo;s on-chain array &mdash; one paginated call
        plus one multicall per page. No event scan, no indexer, and no dependency on an
        RPC tier: the public endpoint caps <code>eth_getLogs</code> at 100 blocks, which
        would make a log-derived archive stop working as the chain grows.
      </p>

      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}

      <ol className="archive-list">
        {entries.map((entry) => (
          <li key={entry.address} className="archive-entry">
            <h2 className="archive-entry-name">
              <Link href={`/basket/${entry.address}`}>{entry.name}</Link>{" "}
              <span className="muted">{entry.symbol}</span>
            </h2>
            <p className="muted archive-entry-meta">
              {age(entry.createdAt)} &middot; {entry.tokens.length} holdings &middot;{" "}
              <code>{entry.thesisURI || "no thesis reference"}</code>
            </p>
          </li>
        ))}
      </ol>

      {entries.length === 0 && !loading ? <p className="muted">Nothing archived yet.</p> : null}

      {total !== null && offset < total ? (
        <button className="archive-more" disabled={loading} onClick={() => loadPage(offset)}>
          {loading ? "Loading…" : `Load more (${total - offset} remaining)`}
        </button>
      ) : null}
    </main>
  );
}
