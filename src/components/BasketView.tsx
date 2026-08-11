"use client";

import { useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useAccount, useChainId, useConfig, usePublicClient, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";

import { ROLE_LABEL, USDG, assetByAddress } from "@/config/assets";
import { basketAbi } from "@/lib/chain/abis";
import { explainRevert } from "@/lib/chain/errors";
import { deploymentFor } from "@/lib/chain/deployments";
import { fetchBasketState, type BasketState } from "@/lib/chain/archive";
import { fetchExitValues, valueComposition, valueOfLeg, type LegExitValue } from "@/lib/chain/exitValue";

export function BasketView({ address }: { address: Address }) {
  const client = usePublicClient();
  const chainId = useChainId();
  const config = useConfig();
  const { address: account } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const deployment = deploymentFor(chainId);

  const [state, setState] = useState<BasketState | null>(null);
  const [prices, setPrices] = useState<Map<Address, LegExitValue> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  async function load() {
    if (!client) return;
    try {
      const s = await fetchBasketState(client, address, account);
      setState(s);
      if (deployment) {
        setPrices(await fetchExitValues(client, deployment.quoter, s.tokens));
      }
    } catch (e) {
      setError(explainRevert(e));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, address, account, deployment?.quoter]);

  if (error) return <div className="error" role="alert">{error}</div>;
  if (!state) return <p className="muted">Loading basket…</p>;

  const legs = state.tokens.map((t, i) => ({ wrapper: t, units: state.reserves[i] ?? 0n }));
  const composition = prices ? valueComposition(legs, prices) : null;

  async function redeem() {
    if (!account || !state) return;
    setRedeeming(true);
    try {
      const hash = await writeContractAsync({
        address,
        abi: basketAbi,
        functionName: "redeem",
        args: [state.shareBalance, account, state.tokens.map(() => 0n)],
      });
      await waitForTransactionReceipt(config, { hash });
      await load();
    } catch (e) {
      setError(explainRevert(e));
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <>
      <h1 className="basket-name">{state.name}</h1>
      <p className="muted basket-meta">
        <span className="basket-symbol">{state.symbol}</span> ·{" "}
        <code className="basket-address">{address}</code>
      </p>

      <section className="basket-composition">
        <h2>Thesis weights vs. what you actually hold</h2>
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th>Role</th>
              <th className="numeric">Thesis weight</th>
              <th className="numeric">Units held</th>
              <th className="numeric">Exit value</th>
              <th className="numeric">Current share</th>
            </tr>
          </thead>
          <tbody>
            {legs.map((leg, i) => {
              const asset = assetByAddress(leg.wrapper);
              const price = prices?.get(leg.wrapper);
              const value = price ? valueOfLeg(leg.units, price.usdgPerUnit) : null;
              const share = composition?.priced.find((p) => p.wrapper === leg.wrapper);
              return (
                <tr key={leg.wrapper} className="basket-leg">
                  <td>
                    <strong>{asset?.symbol ?? leg.wrapper}</strong>
                    <br />
                    <span className="muted">{asset?.label}</span>
                  </td>
                  <td className="muted">{asset ? ROLE_LABEL[asset.role] : "—"}</td>
                  <td className="numeric">{(state.thesisWeightsBps[i] ?? 0) / 100}%</td>
                  <td className="numeric">{Number(formatUnits(leg.units, 18)).toFixed(6)}</td>
                  <td className="numeric">
                    {value === null || value === undefined ? (
                      <span className="unavailable" title={price?.unavailableReason}>
                        unavailable
                      </span>
                    ) : (
                      `$${Number(formatUnits(value, USDG.decimals)).toFixed(2)}`
                    )}
                  </td>
                  <td className="numeric">
                    {share ? `${(share.bps / 100).toFixed(2)}%` : <span className="unavailable">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="muted exit-value-note">
          Exit value is what these holdings could be sold for right now, quoted against
          the same on-chain pools the basket redeems into &mdash; <strong>not</strong> a
          reference market price. It already contains the depth you would actually hit, so
          it will differ from the equity&rsquo;s quoted price. That difference is real
          information, not an error.
        </p>
        {composition && composition.unpriced.length > 0 && (
          <p className="unavailable">
            {composition.unpriced.length} of {legs.length} legs could not be priced and are
            excluded from the current-share column.
          </p>
        )}
        <p className="muted">
          Thesis weights are immutable and were declared at creation. What one share is
          backed by, in units, does not move when other people mint &mdash; so any drift
          between the two columns is the legs&rsquo; prices moving, which is the
          performance of the thesis.
        </p>
      </section>

      <section className="basket-position">
        <h2>Your position</h2>
        <p className="basket-balance">
          {Number(formatUnits(state.shareBalance, 18)).toFixed(6)} {state.symbol}
        </p>
        <button
          className="basket-redeem"
          disabled={!account || state.shareBalance === 0n || redeeming}
          onClick={redeem}
        >
          {redeeming ? "Redeeming…" : "Redeem all (in kind)"}
        </button>
        <p className="muted">
          Redemption pays out your pro-rata slice of every leg as tokens. It touches no
          pool, so it is not exposed to liquidity at all, and it can never be paused.
        </p>
      </section>
    </>
  );
}
