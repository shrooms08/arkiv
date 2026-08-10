# RISKS

Written 10 August 2026. Every claim traces to a verified reading in
[`FINDINGS.md`](./FINDINGS.md). Items marked UNVERIFIED are open.

Arkiv custodies third-party tokenized-equity wrappers in a vault. The honest
position is that the protocol's own accounting can be made safe, but the assets
it holds carry issuer and legal risk that no contract design can remove. Those
risks are stated here rather than discovered later.

---

## R1 — The wrappers are upgradeable. HIGH. Not mitigable by us.

Every xStocks wrapper on X Layer is an EIP-1967 proxy. All 20 probed wrappers
share one ProxyAdmin, `0x312063009e74142339edc92bcff6cfcfaa958bfa`, owned by a
**Gnosis Safe v1.3.0 with a 2-of-3 threshold**
(`0x49754062E35f7591B93cc4F9915965be89643a65`).

Two of three keyholders can replace the implementation of every token Arkiv
holds. A malicious or compromised upgrade could freeze balances, redirect
transfers, or zero the vault's holdings. Arkiv's share accounting would remain
internally consistent and would still report the vault's balance faithfully —
it simply would not be worth anything.

This is not a flaw we introduced and not one we can engineer away. It is the
standing condition of holding any Backed xStock, on any chain.

**What we do:** state it in the README and on the mint screen, in plain language,
before a user commits funds. A 2-of-3 Safe is meaningfully better than an EOA and
worth saying so — but it is still three keys.

**Good news for the "unaudited third-party wrapper" question that prompted this
check:** the wrappers are *not* a scattering of anonymous third-party contracts.
They are one issuer-operated deployment, identical bytecode, one admin. That is
the better of the two outcomes we were testing for.

**UNVERIFIED:** the wrapper implementation source has not been read. Bytecode was
compared (identical 2138 B proxies, one shared implementation per token class),
but the implementation logic itself has not been reviewed, and the Safe
keyholders have not been attributed to named entities.

---

## R2 — Symbol collision: decoy "xStocks" tokens exist. HIGH. Mitigated.

Two ERC-20s on X Layer present themselves as xStocks and hold real pools against
the genuine wrappers:

| Address | `name()` | `symbol()` | Pool fee |
| --- | --- | --- | --- |
| `0xdec2975ff2f100a6c89132a7a86fbda922af2024` | xStocks | `xStocks` | 10000 |
| `0x8a9c67dcfc00a302c4f6df212181e077f939ce25` | xStocks | `XSTOCKS` | 10000 |

Neither is a Backed token. Both appear in pools alongside `wSPYx`, so naive pool
discovery or symbol matching would find them.

Compounding this: the registry symbol is `SPYx` while the on-chain wrapper symbol
is `wSPYx`, so symbol matching is unreliable even for legitimate tokens.

**Mitigation.** The allowlist in `assets.ts` is by **address**, addresses were
generated programmatically from verified on-chain probes rather than typed, and
`isAllowed()` / `assetByAddress()` are the only sanctioned lookups. The AI
underwriter emits symbols, which are resolved through `assetBySymbol()` against
the same fixed table — it can never introduce an address.

Never add a symbol-based address lookup, and never accept a caller-supplied token
address into a basket.

---

## R3 — Sanctions screening is ours alone. MEDIUM. Mitigated, with a caveat.

The base tokens expose `sanctionsList()` → `0x615Dd3B9445A94334C1579F68115042D77CC7c44`.
**The wrappers do not expose that getter at all** — the call reverts.

We hold wrappers, not base tokens. So we cannot assume the token we custody
screens anybody.

**Mitigation.** Arkiv reads the deny-list contract directly and reverts with its
own `Sanctioned()` error before pulling funds. The list is live and
`isSanctioned(address)` is callable.

**Caveat, stated precisely:** absence of a public getter is *not* proof that the
wrapper performs no internal check. Whether wrapper transfers are screened is
**UNVERIFIED** pending an implementation-source read. Our check is therefore
belt-and-braces of unknown redundancy — which is the right posture, but it should
not be described as "the only check" or as "duplicating the token's check",
because we do not know which is true.

Separately, USDG exposes `isFrozen(address)`. Paxos can freeze USDG independently
of the Backed list. A frozen depositor will fail inside the USDG transfer, not in
our check. **UNVERIFIED:** whether that failure surfaces a clean revert reason.

---

## R4 — No identified router; we swap against pools directly. MEDIUM. Mitigated.

Canonical Uniswap is not deployed on X Layer. The pools belong to a V3 fork whose
factory is `0x4B2ab38DBF28D31D467aA8993f6c2585981D6804`. Sampling real swaps
showed at least six distinct entrypoints, none of which responded to `factory()`
or `WETH9()`, so no audited router could be positively identified.

Routing through an unidentified 22 KB contract that can be upgraded or can
misreport output would put every mint at its mercy.

**Mitigation.** The DEX adapter calls `pool.swap()` directly and pays inside
`uniswapV3SwapCallback`. This removes the router from the trust set entirely: the
only external code in the swap path is the pool itself, which we address by
constant. The mechanism was prototyped and executed successfully against all 14
live pools on a mainnet fork.

The vault additionally never trusts swap return values — it measures `balanceOf`
deltas. A lying pool cannot inflate shares; it can only give a bad price, which
the caller's own `minAmountsOut` rejects.

**Residual:** the pools themselves are third-party contracts. **UNVERIFIED:** who
controls the factory owner `0x6A88EF2e6511CAFfE2D006e260e7A5d1E7D4d7D7`. On
Uniswap V3 the factory owner can enable fee tiers and collect protocol fees but
cannot drain pools or alter existing pool logic (pools are immutable, non-proxy,
22,142 B). This bounds the exposure but has not been confirmed against this
fork's source.

---

## R5 — Thin liquidity relative to any real size. MEDIUM. Mitigated by the cap.

Single-name pools hold roughly $95k–$110k of USDG; index pools $236k–$280k.
Measured slippage on a $10,000 single-leg trade is ~3.9–4.0%.

**Mitigation.** Three layers: a $5,000 mint cap; the core-plus-tilt rule keeping
at least 50% in the deeper index pools; and caller-supplied `minAmountsOut`
enforced per leg. A $5,000 basket mint splits to roughly $450 per single-name leg,
where measured slippage is ~20–40 bp, blending to ~20 bp — an order of magnitude
inside the 200 bp budget.

**This is a real constraint on the product, not just a safety setting.** Arkiv
cannot honestly serve a $100k thesis today. The cap should be presented as a
depth-linked limit that rises with liquidity, not as an arbitrary throttle.

Redemption is in-kind, so it is not exposed to pool depth at all — a redeemer
receives tokens, and chooses their own exit. This is the main reason in-kind
redemption is the load-bearing path.

---

## R6 — Rebasing base tokens must never enter the vault. MEDIUM. Mitigated.

The base tokens rebase: `SPYx.multiplier()` reads `1.0057e18` and drifts upward,
so a transfer of `1e18` credits `999999999999999999`. Share accounting computed
from expected amounts against a rebasing balance would drift and eventually
misprice redemptions.

**Mitigation.** Wrappers only — confirmed non-rebasing, every probed wrapper
reverts on `multiplier()`. Base addresses are recorded in `assets.ts` **solely so
they can be rejected**, and are excluded from the allowlist. Deposits are USDG
and are swapped straight into wrappers, so a base token is never received in the
normal path.

Because anyone can send any token to any address, a base token can still be
*donated* to the vault. Share accounting must be driven by measured deltas of
allowlisted wrappers only, so a donated rebasing token is inert — it sits there
and is not counted. A fork test asserts exactly this.

---

## R7 — What xStocks legally are. HIGH. Disclosure only.

xStocks are **tracker certificates issued by Backed**, giving economic exposure
to an underlying equity. Holding one is **not** share ownership. Holders get no
voting rights, no direct dividend entitlement, and no shareholder claim on the
issuer of the underlying company. The position is a claim on Backed.

Arkiv is a basket-construction protocol on top of these instruments. It does not
change what they are, and it does not make them securities ownership.

**Disclosure, not mitigation.** This is stated plainly in the README and in the
UI. It is more credible to say this clearly than to leave it out.

---

## R8 — Owner is a single key for the hackathon. MEDIUM. Accepted, time-boxed.

`Arkiv` admin functions (`setAssetAllowed`, `setMintCap`, `setDexAdapter`,
`pause`) sit behind `Ownable2Step` with a plain EOA owner for the hackathon.

That key can pause the protocol and change the allowlist and the DEX adapter.
`setDexAdapter` is the sharp one: a malicious adapter could route a mint's funds
anywhere. Note it cannot touch existing holdings — redemption is in-kind and
reads balances directly, so a bad adapter cannot drain what is already in the
vault, only misroute new mints.

**Mitigation:** a multisig is the production answer, documented as such. Until
then the owner key is a stated trust assumption, not a hidden one.

---

## R9 — AI underwriting output is not investment advice. MEDIUM. Disclosure + constraints.

The underwriter is a language model. It can produce a confident, well-argued,
wrong thesis. It has no market data feed and no ability to verify its own claims.

**Constraints already enforced in code, not by the prompt:** weights must sum to
10000, core must be ≥5000 bps, every symbol must be in the fixed allowlist, no
duplicates, and non-conforming output is rejected rather than repaired.

**Disclosure:** the published rubric (`UNDERWRITING.md`) states what the model
can and cannot do, and the mandatory falsifier makes each thesis explicitly
checkable rather than merely persuasive. The falsifier is the honest core of the
product — it is what lets a user find out later that they were wrong.

Arkiv does not provide investment advice, and the UI should not imply the model
knows what an asset is worth.

---

## Open items

| # | Item | Blocker |
| --- | --- | --- |
| 1 | Read wrapper implementation source; confirm internal sanctions enforcement | explorer source access |
| 2 | Attribute the 2-of-3 Safe keyholders | — |
| 3 | Confirm V3-fork factory owner powers against source | — |
| 4 | Confirm OKX aggregator routing and quotes | `OK-ACCESS-KEY` not present |
| 5 | Confirm behaviour of a Paxos-frozen USDG holder in the mint path | — |
| 6 | Chainlink availability on X Layer (Pyth proven absent) | display NAV only; not settlement-critical |
