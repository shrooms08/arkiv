"use client";

import { useAccount } from "wagmi";

import { ACTIVE_CHAIN, isDeployedChain } from "@/lib/chain/chains";

/**
 * Which chain the app should READ from.
 *
 * Arkiv is deployed on X Layer testnet and X Layer mainnet. A visitor with no
 * wallet, or a wallet on some third chain, reads the default, which is testnet:
 * that is where the filed theses are and it is the demo. A wallet on either
 * deployed chain reads that one, so connecting on mainnet shows mainnet.
 *
 * The important property is preserved from when there was only one deployment:
 * a wallet on a chain Arkiv is not on never blanks the page. It falls back to
 * the default rather than reading a chain with no registry on it.
 */
export function useViewChainId(): number {
  const { chainId } = useAccount();
  return isDeployedChain(chainId) ? chainId! : ACTIVE_CHAIN.id;
}
