import type { Address, PublicClient } from "viem";

import { basketAbi } from "./abis";
import { fetchBasketCount, fetchBasketPage } from "./archive";

export interface RegistryEntry {
  /** Position in the registry's `baskets` array. Serial is this plus one. */
  index: number;
  address: Address;
  symbol: string;
  /** The `arkiv:` suffix from thesisURI, or null if it is not in that form. */
  thesisHash: string | null;
}

const THESIS_PREFIX = "arkiv:";

/**
 * Every basket in the registry, with its index and the thesis it was filed
 * against.
 *
 * One enumeration plus one multicall, which is what makes this affordable to
 * call before a mint. It answers both questions the app has about the registry:
 * what serial a basket carries, and whether a thesis has already been filed.
 *
 * Match on thesis hash, never on ticker or title. Both of those are chosen by
 * whoever files, and a second filing under an existing ticker is exactly the
 * case this exists to catch.
 */
export async function fetchRegistry(
  client: PublicClient,
  arkiv: Address,
): Promise<RegistryEntry[]> {
  const count = await fetchBasketCount(client, arkiv);
  if (count === 0) return [];

  const addresses: Address[] = [];
  const PAGE = 200;
  for (let offset = 0; offset < count; offset += PAGE) {
    addresses.push(...(await fetchBasketPage(client, arkiv, offset, Math.min(PAGE, count - offset))));
  }

  const results = await client.multicall({
    contracts: addresses.flatMap((address) => [
      { address, abi: basketAbi, functionName: "symbol" as const },
      { address, abi: basketAbi, functionName: "thesisURI" as const },
    ]),
    allowFailure: true,
  });

  return addresses.map((address, i) => {
    const symbolResult = results[i * 2];
    const uriResult = results[i * 2 + 1];
    const uri = uriResult?.status === "success" ? String(uriResult.result) : "";
    return {
      index: i,
      address,
      symbol: symbolResult?.status === "success" ? String(symbolResult.result) : "",
      thesisHash: uri.startsWith(THESIS_PREFIX) ? uri.slice(THESIS_PREFIX.length) : null,
    };
  });
}

/**
 * The first basket filed under this thesis, if any.
 *
 * First, not any: a thesis can have been filed more than once, and the original
 * filing is the record. A later duplicate is a separate basket with its own
 * serial and its own curator, and buying into it would pay the copier.
 */
export function findFiling(
  registry: readonly RegistryEntry[],
  thesisHash: string,
): RegistryEntry | undefined {
  return registry
    .filter((e) => e.thesisHash === thesisHash)
    .reduce<RegistryEntry | undefined>((a, b) => (a && a.index <= b.index ? a : b), undefined);
}
