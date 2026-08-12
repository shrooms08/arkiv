import type { Address, PublicClient } from "viem";

import type { Deployment } from "./deployments";

const mockAdapterAbi = [
  {
    type: "function",
    name: "rate",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

/**
 * Per-leg adapter rates, where the chain is mock-priced.
 *
 * On a mock deployment the adapter is fixed-rate, so a mint's output is
 * computable exactly before it is sent. Against real pools there is no such
 * rate: output depends on depth at execution time, and the caller falls back to
 * labelling the figure as an estimate rather than quoting a number it cannot
 * stand behind.
 *
 * Returns an empty map when the deployment has no mock adapter.
 */
export async function fetchMockRates(
  client: PublicClient,
  deployment: Deployment,
  tokens: readonly Address[],
): Promise<Map<Address, bigint>> {
  const out = new Map<Address, bigint>();
  if (!deployment.mockAdapter || tokens.length === 0) return out;

  const results = await client.multicall({
    contracts: tokens.map((t) => ({
      address: deployment.mockAdapter!,
      abi: mockAdapterAbi,
      functionName: "rate" as const,
      args: [t],
    })),
    allowFailure: true,
  });

  tokens.forEach((t, i) => {
    const r = results[i];
    if (r?.status === "success" && typeof r.result === "bigint" && r.result > 0n) {
      out.set(t, r.result);
    }
  });
  return out;
}
