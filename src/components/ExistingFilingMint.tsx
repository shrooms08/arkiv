"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Address } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { SerialNumber } from "@ds";
import { InvestPanel } from "@/components/InvestPanel";
import { ACTIVE_CHAIN } from "@/lib/chain/chains";
import { useViewChainId } from "@/lib/ui/useViewChain";
import { deploymentFor } from "@/lib/chain/deployments";
import { explainRevert } from "@/lib/chain/errors";
import { fetchBasketState, type BasketState } from "@/lib/chain/archive";
import { fetchMockRates } from "@/lib/chain/rates";
import type { RegistryEntry } from "@/lib/chain/registry";

/**
 * Buying into a thesis that has already been filed.
 *
 * This renders the basket page's own invest panel rather than a second mint
 * implementation. That is not just tidiness: minting into an existing basket is
 * different arithmetic from filing a new one. A first mint sets the basis, so
 * shares follow directly from the amount paid. A later mint is bounded by the
 * worst leg against existing reserves, `S * min(d_i / B_i)`, and the split has
 * to be sized to current composition rather than to declared weights. Running
 * the first-mint estimate against an existing basket would compute a share
 * floor the mint cannot meet and revert on slippage.
 *
 * Reusing the component means there is one definition of that arithmetic.
 */
export function ExistingFilingMint({
  filing,
  serial,
}: {
  filing: RegistryEntry;
  serial: number;
}) {
  const viewChainId = useViewChainId();
  const client = usePublicClient({ chainId: viewChainId });
  const { address } = useAccount();
  const deployment = deploymentFor(viewChainId);

  const [state, setState] = useState<BasketState | null>(null);
  const [rates, setRates] = useState<Map<Address, bigint> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client || !deployment) return;
    try {
      const s = await fetchBasketState(client, filing.address, address);
      setState(s);
      setRates(await fetchMockRates(client, deployment, s.tokens));
    } catch (e) {
      setError(explainRevert(e));
    }
  }, [client, deployment, filing.address, address]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="existing-filing">
      <div className="existing-filing__notice">
        <span className="app-label">Already filed</span>
        <p className="existing-filing__text">
          This thesis is already on the record as{" "}
          <SerialNumber index={serial} emphasis />, filed by whoever wrote it first. You
          are buying into that basket rather than filing a second copy, so the original
          author keeps earning from it.
        </p>
        <Link className="app-note" href={`/app/basket/${filing.address}`}>
          Open {filing.symbol}, ARKIV-{String(serial).padStart(4, "0")}
        </Link>
      </div>

      {error && (
        <div className="app-error" role="alert">
          {error}
        </div>
      )}

      {state ? (
        <InvestPanel
          basket={filing.address}
          symbol={state.symbol}
          tokens={state.tokens}
          reserves={state.reserves}
          totalSupply={state.totalSupply}
          shareBalance={state.shareBalance}
          ratesPerLeg={state.tokens.map((t) => rates?.get(t) ?? null)}
          onDone={load}
        />
      ) : (
        !error && <p className="app-prose">Reading the existing basket…</p>
      )}
    </div>
  );
}
