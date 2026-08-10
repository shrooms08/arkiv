# Arkiv contracts

Basket construction over Backed xStocks wrappers on X Layer (chain 196).

```
src/
  Arkiv.sol             registry + factory: allowlist, mint cap, adapter, pause
  Basket.sol            one thesis: ERC-20 shares, USDG mint, in-kind redemption
  XLayerV3Adapter.sol   direct pool.swap() with a three-lock callback guard
  config/XLayerConfig.sol   verified addresses, mirrors ../src/config/assets.ts
```

## Setup

```bash
git submodule update --init --recursive   # forge-std, pinned at v1.9.6
forge build
```

## Tests

```bash
forge test                       # everything, including fork tests
forge test --no-match-path 'test/fork/*'   # unit only, no RPC needed
```

Fork tests run against live chain 196 at a pinned block. They use the public
endpoint by default, which is slow and rate-limited — `foundry.toml` sets
conservative retries to compensate. Set `XLAYER_RPC_URL` to use a dedicated
endpoint instead:

```bash
XLAYER_RPC_URL=https://... forge test
```

## Deploy

```bash
forge script script/Deploy.s.sol --rpc-url xlayer --broadcast
```

The broadcasting account owns both contracts while they are configured, because
`registerPair` and `setAssetAllowed` are `onlyOwner`. Set `ARKIV_OWNER` to hand
over afterwards — it goes through `Ownable2Step`, so the recipient must call
`acceptOwnership()`.

Registration is a real check, not a formality: a pool must both CREATE2-derive
to an address holding code *and* be confirmed by the factory's own `getPool`, so
a deploy against a wrong factory, a wrong init code hash or a stale pool list
reverts here rather than at the first mint.

## Design notes

Everything load-bearing is documented at its definition. The three things worth
knowing before reading:

- **Shares are price-free.** `shares = S · minᵢ(dᵢ / Bᵢ)`, computed from measured
  balance deltas, never from a swap's return value. There is no oracle in the
  settlement path.
- **The excess is refunded in kind.** The worst leg binds, so the other legs
  over-deliver; that surplus goes back to the minter rather than to existing
  holders.
- **Donations are inert, and that is load-bearing.** Accounting runs on an
  internal `reserves` ledger, not `balanceOf`, so a direct transfer into a vault
  cannot move share pricing. `DEAD_SHARES` and `Arkiv.minFirstMint` back this up
  independently — see R12 in `../docs/RISKS.md`.
- **The swap callback is the sharp edge.** `uniswapV3SwapCallback` pays out of
  the adapter's balance. See the three locks in `XLayerV3Adapter.sol` and
  `test/CallbackGuard.t.sol`, where each is exercised in isolation against a
  deliberately pre-funded adapter.

Dependencies are OpenZeppelin v5.1.0 (`ERC20`, `Ownable2Step`, `SafeERC20`,
`ReentrancyGuardTransient`) and `forge-std` v1.9.6, both pinned submodules.

See [`../docs/RISKS.md`](../docs/RISKS.md) for what this design does not fix.
