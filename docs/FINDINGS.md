# FINDINGS — X Layer recon

Verified 10 August 2026 against chain 196 at block ~67,608,000.

Everything here was read from the chain. The Backed registry was used only to
generate candidate addresses; every candidate was then probed directly. Where
something was not verified, it says UNVERIFIED.

Reproduce with the scripts described in "Method" at the bottom.

---

## 1. Chain and RPC

| Item | Value |
| --- | --- |
| Chain ID | `196` (`eth_chainId` → `0xc4`) |
| Stack | OP Stack |
| EIP-1559 | works; `--legacy` not required |

### Working RPC endpoints

| Endpoint | Batch limit | `eth_getLogs` range |
| --- | --- | --- |
| `https://rpc.xlayer.tech` | **10** calls | **100 blocks** |
| `https://xlayerrpc.okx.com` | 10 | 100 blocks |
| `https://196.rpc.thirdweb.com` | ok | 100 blocks |
| `https://xlayer.drpc.org` | ok | **10,000 blocks** (free tier) |
| `https://xlayer-rpc.publicnode.com` | — | did not respond |
| `https://xlayer.blockpi.network/v1/rpc/public` | — | requires API key |

**Operational consequence.** The public OKX RPC rejects JSON-RPC batches larger
than 10 with `-32014 too many RPC calls in batch request`, and caps `eth_getLogs`
at 100 blocks. That is too tight for the `/archive` route, which needs event
history. Use drpc for log queries, and budget for a paid RPC before mainnet.
`Multicall3` is deployed at `0xcA11bde05977b3631167028862bE2a173976CA11`, which
covers batched reads without hitting the batch limit.

### Infrastructure present

| Contract | Address | Status |
| --- | --- | --- |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | deployed, 3808 B |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | deployed, 9152 B |

### Infrastructure ABSENT

Canonical Uniswap is **not** deployed on X Layer. All of these return empty code:

- UniswapV3Factory `0x1F98431c8aD98523631AE4a59f267346ea31F984`
- SwapRouter02 `0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45`
- QuoterV2 `0x61fFE014bA17989E743c5F6cB21bF9697530B21e`
- NonfungiblePositionManager `0xC36442b4a4522E871399CD717aBDD847Ab11FE88`
- UniswapV2Factory `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f`

This contradicts the working assumption that we would build a `UniswapV3Adapter`
against a known Uniswap deployment. See §4.

---

## 2. USDG

| Field | Value |
| --- | --- |
| Address | `0x4ae46A509f6B1D9056937ba4500cB143933D2dC8` |
| Name / symbol | Global Dollar / `USDG` |
| **Decimals** | **6** |

**`USDG` has 6 decimals, not 18.** Every amount in the mint path, the cap, and
the UI must respect this. The $5,000 cap is `5_000_000_000n`, not `5000e18`.

USDG exposes `isFrozen(address)` (returned `false` for a probe address). It does
**not** expose `sanctionsList()`, `owner()`, or `paused()`. Paxos therefore has
its own freeze mechanism, independent of the Backed deny-list.

---

## 3. xStocks: base vs wrapper

The registry (`GET https://api.xstocks.fi/api/v1/token`) returns 734 tokens, of
which **717 have an X Layer deployment** — not nine. Nine was a prior shortlist,
not the universe. Both base and wrapper addresses are identical across every
chain, consistent with deterministic CREATE2 deploys.

### Rebasing confirmed

Probed on SPYx:

| | Base `0x90a2…dd48` | Wrapper `0xe7e5…b540` |
| --- | --- | --- |
| `symbol()` | `SPYx` | **`wSPYx`** |
| `decimals()` | 18 | 18 |
| `multiplier()` | `1005714560286254000` (1.0057e18) | **reverts** |

The base rebases; the wrapper does not expose `multiplier()` at all. Confirmed
across all 20 probed candidates: **every wrapper reverts on `multiplier()`**.

**On-chain wrapper naming is `w`-prefixed**: `wSPYx`, `wAAPLx`, `wNVDAx`. The
registry symbol is the base symbol (`SPYx`). Any symbol-based lookup must account
for this — which is why `assets.ts` carries both `symbol` and `onChainSymbol`,
and why matching is done by address.

### Proxy structure

Every base and every wrapper is an **EIP-1967 upgradeable proxy**.

| | Implementation | ProxyAdmin |
| --- | --- | --- |
| wSPYx | `0x76c6851ea0b2741eedcbbed240715e8817e85583` | `0x312063009e74142339edc92bcff6cfcfaa958bfa` |
| SPYx (base) | `0x65c40d624af3b18c109fbf87b7deff34cdc5f19b` | `0x696c685a02a1fc6e2aacbe26cd6695f4f4a6a085` |

Both ProxyAdmins are owned by the same address:
`0x49754062E35f7591B93cc4F9915965be89643a65`, which is a **Gnosis Safe v1.3.0,
threshold 2 of 3**:

- `0x2860a2051A93113CB6E931022b658ed1dC68D444`
- `0xe25B606f393b60ADcB85cC127A2d79F78C9Cb658`
- `0xb6Aa1F2E164f6160b1D3cf7307c9AA4aAC7690f5`

**All 20 probed wrappers share the identical ProxyAdmin** and identical 2138-byte
proxy code. This answers "who issues the wrapper": it is a single issuer-operated
deployment under one 2-of-3 Safe, not a scattering of third-party wrappers. See
`RISKS.md` for what that means for custody.

### Sanctions deny-list

| Contract | `sanctionsList()` |
| --- | --- |
| Base `SPYx` | `0x615Dd3B9445A94334C1579F68115042D77CC7c44` |
| Wrapper `wSPYx` | **reverts — no such getter** |
| USDG | reverts |

The deny-list at `0x615Dd3B9445A94334C1579F68115042D77CC7c44` is live (1864 B)
and `isSanctioned(address)` is callable, returning `false` for probe addresses.

**The wrapper does not expose a `sanctionsList()` getter.** Whether the wrapper
enforces the deny-list internally is **UNVERIFIED** — absence of a public getter
is not proof of absence of a check, and we have not read the implementation
source. Practically this means we cannot rely on the wrapper to screen anyone;
Arkiv must read the deny-list contract itself.

---

## 4. The DEX

There is no canonical Uniswap (§1). The pools that actually hold the xStocks
liquidity belong to a **Uniswap V3 fork**:

| Item | Value |
| --- | --- |
| Factory | `0x4B2ab38DBF28D31D467aA8993f6c2585981D6804` (24,535 B) |
| Factory owner | `0x6A88EF2e6511CAFfE2D006e260e7A5d1E7D4d7D7` |
| `feeAmountTickSpacing(500)` | `10` — matches Uniswap V3 exactly |
| Pool code size | 22,142 B, standard `token0`/`token1`/`fee`/`slot0`/`swap` |

Pools were found by scanning `Transfer` logs and confirmed via
`factory.getPool(USDG, wrapper, fee)`.

### Router: no single trusted entrypoint

Sampling 20 real swaps on the SPYx/USDG pool, the `sender` calling `pool.swap`
and the transaction entrypoint were spread across at least six contracts:

| Address | Swaps (of 20) | Code |
| --- | --- | --- |
| `0xd9ecccd2d9aa6cb656440ad0c121cad11778fd21` | 10 | 22,561 B |
| `0xc2402c8453f39e97113f094e3402fbbdd7e0ede3` | 3 | 2,227 B |
| `0xcc96b656b6dff0b5318d53271b82b7e7183b95d2` | 3 | 3,065 B |
| `0x722db4f285f8bd91ef7af6da397e83f7fa4e80a7` | 2 | 24,571 B |
| `0x7078c4537c04c2b2e52ddba06074dbdacf23ca15` | 2 | — |
| `0x5ce741a6e8307c8b11f2d27a75df0844f06bfef1` | 2 | 784 B |

None responded to `factory()` or `WETH9()`, so none could be positively
identified as a canonical `SwapRouter`. **UNVERIFIED: which of these, if any, is
an audited router.**

**Consequence for the adapter.** Rather than trust an unidentified router, the
adapter should call `pool.swap()` directly and pay in `uniswapV3SwapCallback`.
This was prototyped and executed successfully against all 14 live pools on a
mainnet fork (§5) — the measurements below *are* the output of that mechanism.

---

## 5. Liquidity and measured price impact

Fee tier: **every live xStocks/USDG pool is on the 0.05% (500) tier.** Only
NVDAx additionally had a 100-tier pool, and it is empty.

Impact was measured by **executing real swaps against the real pools on a
mainnet fork**, comparing the realised rate against a 10-USDG reference trade.
The pool fee cancels between the two, so the figures are **pure slippage,
excluding the 5 bp fee**. Output amounts were taken as measured `balanceOf`
deltas, never from return values.

| Symbol | Role | USDG reserve | @$1k | @$5k | @$10k |
| --- | --- | ---: | ---: | ---: | ---: |
| GLDx | core | $279,749 | 5 bp | 22 bp | 43 bp |
| QQQx | core | $252,207 | 12 bp | 59 bp | 115 bp |
| SPYx | core | $250,961 | 12 bp | 59 bp | 116 bp |
| IWMx | core | $236,278 | 13 bp | 62 bp | 123 bp |
| NVDAx | tilt | $110,762 | 17 bp | 107 bp | 394 bp |
| TSLAx | tilt | $106,799 | 41 bp | 198 bp | 380 bp |
| MSFTx | tilt | $102,582 | 43 bp | 205 bp | 393 bp |
| AMZNx | tilt | $102,404 | 43 bp | 205 bp | 393 bp |
| COINx | tilt | $101,636 | 43 bp | 206 bp | 395 bp |
| METAx | tilt | $101,432 | 43 bp | 206 bp | 395 bp |
| AVGOx | tilt | $100,704 | 43 bp | 207 bp | 397 bp |
| GOOGLx | tilt | $98,557 | 43 bp | 208 bp | 399 bp |
| AAPLx | tilt | $97,952 | 43 bp | 209 bp | 400 bp |
| AMDx | tilt | $94,219 | 58 bp | 279 bp | 527 bp |

This **confirms the prior recon**: single names ~3.9–4.0% at $10k (previously
estimated ~4.2%), index wrappers 1.15–1.23% (previously ~1.17%), and index
roughly 2.4–2.5× deeper than single names. GLDx is deeper still.

"USDG reserve" is the pool's USDG balance, not TVL. Because these are
concentrated-liquidity pools, reserve is an imperfect depth proxy — the measured
impact column is the number to trust.

### What this means for the mint cap

The table is impact for the **whole** amount into **one** pool. A real basket
splits the notional across legs. A $5,000 mint at 55% core / 45% tilt over 2
index + 5 single names sends ~$1,375 per index leg and ~$450 per single-name leg,
which lands each leg near or below its $1k column — a blended slippage on the
order of **~20 bp**.

The $5,000 cap therefore sits about an order of magnitude inside the 200 bp
blended budget. It is conservative, and that is fine for launch.

### Excluded

Verified as deployed on X Layer but **excluded — wrapper `totalSupply()` is 0 and
no USDG pool holds any balance**: `VTIx`, `VOOx`, `SLVx`, `JPMx`, `LLYx`, `UNHx`.

Registry presence is not liquidity. This is exactly why the registry was treated
as a candidate list rather than as verification.

---

## 6. OKX DEX aggregator — BLOCKED

```
GET https://web3.okx.com/api/v5/dex/aggregator/quote?chainId=196&...
→ {"msg":"Request header OK-ACCESS-KEY can not be empty.","code":"50103"}
```

No `OK-ACCESS-KEY` is present in the environment. **Routing and quotes through
the OKX aggregator are UNVERIFIED.** Until a key is supplied, the plan is to swap
directly against the V3-fork pools (§4), which is verified working.

This matters beyond convenience: the Launch Grant measures volume routed through
the OKX interface, so a key should be obtained before mainnet.

---

## 7. Final asset universe

14 assets, all verified live: **4 core** (GLDx, QQQx, SPYx, IWMx) and **10 tilt**
(NVDAx, TSLAx, MSFTx, AMZNx, COINx, METAx, AVGOx, GOOGLx, AAPLx, AMDx).

This is wider than the "two index plus five to seven single names" target. A
larger allowlist costs nothing on-chain, gives the underwriter more room to
express a thesis, and every entry cleared the same liquidity bar. Basket-level
composition limits still apply per basket.

Recorded in [`src/config/assets.ts`](../src/config/assets.ts) as the single
source of truth, with addresses generated programmatically from the verified
dataset rather than transcribed by hand.

---

## Method

1. `GET https://api.xstocks.fi/api/v1/token` → filter `deployments[].network == "XLayer"`.
2. Batched `eth_call` (chunks of 10) for `symbol`/`name`/`decimals`/`totalSupply`/`multiplier`,
   plus `eth_getStorageAt` on EIP-1967 implementation and admin slots.
3. `eth_getLogs` over `Transfer` (via drpc, 10k-block windows) to discover pools,
   then `factory.getPool(USDG, wrapper, fee)` across the 100/500/3000/10000 tiers.
4. Foundry fork test executing real `pool.swap` calls with a payment callback,
   measuring `balanceOf` deltas.

Deny-list, proxy-admin, and Safe ownership reads were done with `cast call`
against `https://rpc.xlayer.tech`.
