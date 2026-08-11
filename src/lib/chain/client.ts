import { createPublicClient, http, type PublicClient } from "viem";

import { xLayer } from "./chains";

/**
 * Transport tuned to the PUBLIC X Layer RPC, because that is what we actually
 * have. Gate 0 measured its limits directly: JSON-RPC batches larger than 10
 * are rejected with `-32014 too many RPC calls in batch request`, and it rate
 * limits hard enough to time out a burst of reads.
 *
 * These are floors, not guesses. A better endpoint simply makes the same code
 * faster; nothing here assumes a wider limit will ever be available.
 */
export const RPC_BATCH_SIZE = 10;

export function arkivTransport(url?: string) {
  return http(url || process.env.NEXT_PUBLIC_RPC_URL || xLayer.rpcUrls.default.http[0], {
    batch: { batchSize: RPC_BATCH_SIZE, wait: 16 },
    retryCount: 5,
    retryDelay: 300,
    timeout: 30_000,
  });
}

/**
 * Server-side reader. `multicall3` is set on the chain definition and was
 * verified live on chain 196 (3,809 bytes of code; `aggregate3` round-tripped
 * two real USDG reads), so `client.multicall` collapses per-basket reads into a
 * single `eth_call` instead of N requests against a 10-deep batch limit.
 */
export function publicClient(url?: string): PublicClient {
  return createPublicClient({
    chain: xLayer,
    transport: arkivTransport(url),
    batch: { multicall: { batchSize: 1024, wait: 16 } },
  }) as PublicClient;
}
