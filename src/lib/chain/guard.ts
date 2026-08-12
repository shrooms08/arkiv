"use client";

import { useCallback, useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";

import { ACTIVE_CHAIN, isActiveChain } from "./chains";

export interface ChainGuard {
  /** The chain the WALLET is on. undefined when nothing is connected. */
  connectedChainId: number | undefined;
  isConnected: boolean;
  /** Writes are only safe when this is true. */
  ok: boolean;
  /** Connected, but somewhere the contracts do not exist. */
  wrongChain: boolean;
  switching: boolean;
  error: string | null;
  switchToActive: () => void;
}

/**
 * Whether it is safe to send a transaction.
 *
 * Read `chainId` from `useAccount`, not from `useChainId`. They are different
 * numbers and the difference is the bug this exists to close: `useChainId`
 * returns the chain wagmi's config is pointed at, which is constrained to the
 * configured list, so a wallet sitting on Ethereum leaves it reporting X Layer
 * testnet, every write control stays enabled, and the transaction is built for
 * a chain the wallet is not on. It then dies at gas estimation, which tells the
 * user nothing about what actually went wrong. `useAccount().chainId` is the
 * connector's real chain, including chains the app was never configured with.
 *
 * The bar is the deployment chain exactly, not "a supported chain". X Layer
 * mainnet is configured so pages can render there, but nothing is deployed on
 * it, so a write from it fails for the same reason a write from Ethereum does.
 */
export function useChainGuard(): ChainGuard {
  const { chainId: connectedChainId, isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const [error, setError] = useState<string | null>(null);

  const switchToActive = useCallback(() => {
    setError(null);
    switchChain(
      { chainId: ACTIVE_CHAIN.id },
      {
        onError: (e) => {
          // A wallet that does not know this chain answers 4902, and the
          // connector follows up with wallet_addEthereumChain from the chain
          // definition, which carries rpc, explorer and native currency. What
          // reaches here is a real refusal: the user declined, or the wallet
          // rejected the add outright.
          const message = e instanceof Error ? e.message : String(e);
          setError(
            /rejected|denied|4001/i.test(message)
              ? `Switch declined. Arkiv can only transact on ${ACTIVE_CHAIN.name}.`
              : `Could not switch: ${message}`,
          );
        },
      },
    );
  }, [switchChain]);

  const ok = isConnected && isActiveChain(connectedChainId);

  return {
    connectedChainId,
    isConnected,
    ok,
    wrongChain: isConnected && !isActiveChain(connectedChainId),
    switching: isPending,
    error,
    switchToActive,
  };
}
