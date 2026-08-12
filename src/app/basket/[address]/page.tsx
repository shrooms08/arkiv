import type { Address } from "viem";

import { BasketView } from "@/components/BasketView";
import { basketIndexFor } from "@/lib/chain/deployments";
import { allRecords } from "@/lib/underwriting/lookup";
import manifest from "../../../../deployments/xlayer-testnet.json";

export const dynamic = "force-dynamic";

/**
 * Resolve the filed record for a basket address.
 *
 * The address→ticker mapping comes from the committed deployment manifest and
 * the ticker→record mapping from the underwriting log, so the falsifier can be
 * rendered on this page without an extra chain read. A basket with no matching
 * record simply renders without one rather than blocking the page.
 */
function recordForAddress(address: string) {
  const baskets = (manifest.baskets ?? []) as { symbol: string; address: string }[];
  const hit = baskets.find((b) => b.address.toLowerCase() === address.toLowerCase());
  if (!hit) return undefined;
  const record = allRecords().find((r) => r.thesis.ticker === hit.symbol);
  if (!record) return undefined;
  return {
    thesisHash: record.thesisHash,
    input: record.input,
    index: basketIndexFor(hit.symbol) ?? 0,
    primaryExpression: record.thesis.primaryExpression,
    falsifier: record.thesis.falsifier,
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
