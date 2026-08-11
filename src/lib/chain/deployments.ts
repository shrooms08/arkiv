import type { Address } from "viem";

/**
 * Deployed protocol addresses, per chain.
 *
 * Written by `contracts/script/Deploy.s.sol` and pasted here (or supplied via
 * env for a local fork, which gets fresh addresses on every restart). Empty
 * means "not deployed on this chain" and the UI says so rather than rendering a
 * broken mint button.
 */
export interface Deployment {
  arkiv: Address;
  adapter: Address;
  quoter: Address;
  /** Block the registry was deployed at — the floor for archive log scans. */
  deployBlock: bigint;
}

function fromEnv(): Deployment | undefined {
  const arkiv = process.env.NEXT_PUBLIC_ARKIV_ADDRESS as Address | undefined;
  const adapter = process.env.NEXT_PUBLIC_ADAPTER_ADDRESS as Address | undefined;
  const quoter = process.env.NEXT_PUBLIC_QUOTER_ADDRESS as Address | undefined;
  if (!arkiv || !adapter || !quoter) return undefined;
  return {
    arkiv,
    adapter,
    quoter,
    deployBlock: BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? "0"),
  };
}

const DEPLOYMENTS: Record<number, Deployment | undefined> = {
  // Mainnet: not deployed yet. Env override is how a local fork is pointed at.
  196: fromEnv(),
  195: undefined,
};

export function deploymentFor(chainId: number | undefined): Deployment | undefined {
  if (chainId === undefined) return undefined;
  return DEPLOYMENTS[chainId];
}
