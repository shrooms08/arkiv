import type { Address } from "viem";

import { BasketView } from "@/components/BasketView";
import { basketIndexFor } from "@/lib/chain/deployments";
import { allRecords } from "@/lib/underwriting/lookup";
import manifest from "../../../../../deployments/xlayer-testnet.json";

export const dynamic = "force-dynamic";

/**
 * Resolve the filed record for a basket address.
 *
 * Address to ticker comes from the committed deployment manifest, ticker to
 * record from the underwriting log, so the falsifier, the rationales and the
 * filing date render without an extra chain read. A basket with no matching
 * record still renders, just without them.
 */
function recordForAddress(address: string) {
  const baskets = (manifest.baskets ?? []) as { symbol: string; address: string }[];
  const hit = baskets.find((b) => b.address.toLowerCase() === address.toLowerCase());
  if (!hit) return undefined;

  const record = allRecords().find((r) => r.thesis.ticker === hit.symbol);
  if (!record) return undefined;

  const rationales: Record<string, string> = {};
  for (const h of record.thesis.holdings) rationales[h.symbol] = h.rationale;

  return {
    thesisHash: record.thesisHash,
    index: basketIndexFor(hit.symbol) ?? 0,
    title: record.thesis.title,
    summary: record.thesis.summary,
    primaryExpression: record.thesis.primaryExpression,
    rationales,
    falsifier: record.thesis.falsifier,
    filedOn: record.createdAt,
  };
}

export default async function BasketPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  return (
    <main className="app-main page-basket">
      <BasketView address={address as Address} record={recordForAddress(address)} />
    </main>
  );
}
