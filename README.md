# Arkiv

An archive of investment theses, on X Layer.

Someone writes down what they believe, in weights they have to commit to and a
falsifier they have to state. It becomes a basket you can mint with USDG and
redeem in kind. The weights never change, so what happens next is a record of
whether the thesis was right.

- [`docs/FINDINGS.md`](docs/FINDINGS.md) — what was verified on chain 196, and how
- [`docs/RISKS.md`](docs/RISKS.md) — what this design does not fix
- [`contracts/`](contracts/) — Foundry project, 98 tests including live-fork tests

## Read this before you mint

**The underlying tokens are upgradeable by a 2-of-3 multisig.** Every xStocks
wrapper Arkiv holds is an EIP-1967 proxy, and all of them share one ProxyAdmin
owned by a Gnosis Safe with a 2-of-3 threshold:
[`0x49754062E35f7591B93cc4F9915965be89643a65`](https://www.oklink.com/xlayer/address/0x49754062E35f7591B93cc4F9915965be89643a65).
Two of three keyholders can replace the implementation of every token in the
vault. Arkiv's accounting would remain correct and would faithfully report
holdings that were no longer worth anything. This is not a flaw Arkiv introduced
and not one it can engineer away — it is the standing condition of holding any
Backed xStock, on any chain.

**xStocks are not shares.** They are tracker certificates issued by Backed giving
economic exposure to an underlying equity. No voting rights, no direct dividend
entitlement, no shareholder claim on the underlying company. The position is a
claim on Backed. Arkiv is a basket-construction protocol on top of these
instruments; it does not change what they are.

**The AI underwriter is not investment advice.** It can produce a confident,
well-argued, wrong thesis. It has no market data feed and cannot verify its own
claims. What it cannot do is break the rules: weights must sum to 10000, index
assets must be at least 50%, every symbol must be in a fixed on-chain allowlist,
and non-conforming output is rejected rather than repaired. The mandatory
falsifier is the honest core of the product — it is what lets you find out later
that you were wrong.

## Two decisions worth stating plainly

**Redemption can never be blocked.** `redeem` is not pausable and not
sanctions-screened. Screening happens on the way in, on both the payer and the
share receiver; on the way out there is no check at all.

This asymmetry is deliberate. Redemption is in-kind and touches no pool, so a
redeemer takes their own pro-rata slice and nothing more — it cannot be used to
extract value from anyone else. Gating it would mean the owner key or a
third-party deny-list could **trap** user funds in the vault indefinitely.
Trapping people is a worse outcome than letting a screened address take back what
is already theirs.

**Rebasing tokens are refused by property, not by list.** The xStocks *base*
tokens rebase; the *wrappers* do not. Rather than maintain a deny-list of base
addresses someone has to remember to update, `Arkiv.setAssetAllowed` probes
`multiplier()` on any token being allowlisted and reverts if it answers. Every
base token answers; every wrapper reverts. The invariant "no rebasing token ever
enters the vault" is therefore self-enforcing — against operator error, and
against assets nobody has classified yet. Confirmed on-chain in both directions
across all 14 wrappers and three bases.

## A guard demanded for one reason caught a different bug

Review asked for defences against the classic first-depositor inflation attack.
That attack turned out not to reach Arkiv — it needs the vault to price shares
off `balanceOf`, and Arkiv prices off an internal `reserves` ledger that a
donation cannot move.

The dead-shares guard went in anyway, and it closed something else that was
real. A redeemer takes `floor(B_i * shares / S)`, so before this, the last
holder leaving could floor a leg to zero and permanently brick minting on
`EmptyLeg` — no attacker, no donation, just an empty basket. With 1000 dead
shares the residue is `ceil(B_i * 1000 / S)`, at least 1 wei whenever the leg is
non-empty, so **every leg stays non-zero for the life of the basket**.

Written up as R12 in [`docs/RISKS.md`](docs/RISKS.md), with a direct test and a
fuzz across twelve orders of magnitude of reserve size.

## Where it runs

**Live: https://arkiv-protocol.vercel.app**

**X Layer testnet (chain 1952)** is the live, clickable deployment. Connect, use
the faucet, mint, redeem. The assets there are **mocks**, and the app says so on
every page.

All 21 contracts are deployed and **verified on Sourcify**, including the three
per-basket `Basket` contracts that actually hold the funds. Every address lives
in [`deployments/xlayer-testnet.json`](deployments/xlayer-testnet.json), written
from the broadcast artefact and the chain rather than typed, and read directly by
the frontend — so a clone resolves the same addresses the live site uses.

| Contract | Address |
| --- | --- |
| Arkiv (registry + factory) | [`0x2A775aaE9c11Cf0ae9543f0EB7778976EB69008f`](https://www.oklink.com/xlayer-test/address/0x2A775aaE9c11Cf0ae9543f0EB7778976EB69008f) |
| MockUSDG (6dp, public faucet) | [`0x219Bd7965C2218596C49F8be9eA99565d56Fc6D0`](https://www.oklink.com/xlayer-test/address/0x219Bd7965C2218596C49F8be9eA99565d56Fc6D0) |
| MockDexAdapter | [`0x964314bBb3038Ec181834859d81878704630F83a`](https://www.oklink.com/xlayer-test/address/0x964314bBb3038Ec181834859d81878704630F83a) |
| MockSanctionsList | [`0x2A5Ff16591CcAa115a8b20C1F7Fe31207C8A4038`](https://www.oklink.com/xlayer-test/address/0x2A5Ff16591CcAa115a8b20C1F7Fe31207C8A4038) |
| Basket — AIBOTTLE | [`0x1255Bdbf41109121146F5A9Fb802F07A2209aa7a`](https://www.oklink.com/xlayer-test/address/0x1255Bdbf41109121146F5A9Fb802F07A2209aa7a) |
| Basket — STICKYINF | [`0x09fA6b33cb49b2110101DAa5f9b80c2cC4B591Bf`](https://www.oklink.com/xlayer-test/address/0x09fA6b33cb49b2110101DAa5f9b80c2cC4B591Bf) |
| Basket — SCRATE | [`0x1bE0574A8C6299D9856E03F0e5Fb9A3CD9c2Ce62`](https://www.oklink.com/xlayer-test/address/0x1bE0574A8C6299D9856E03F0e5Fb9A3CD9c2Ce62) |

The 14 mock wrappers are in the manifest. Sourcify source for any of them:
`https://repo.sourcify.dev/1952/<address>`.

Each basket was minted into with $500 of mock USDG and half redeemed during the
deploy, so every contract listed has demonstrably worked rather than merely
compiled.

They are mocks for a reason that is worth stating rather than hiding: **X Layer
testnet has no xStocks, no USDG and no pools.** There is nothing real to swap
into. A "testnet deployment" against the real asset universe is not something
that exists to be built.

So the same contracts are verified two ways:

- **Mechanism** — deployed to testnet against mocks, where anyone can exercise
  create → mint → hold → redeem end to end.
- **Real assets** — the identical code is exercised against the *real* mainnet
  pools by the fork tests at a pinned block (`contracts/test/fork/`). A $5,000
  mint blends to 18 bp of slippage; exit values agree with mint-implied prices to
  within 0.1%; the swap callback is attacked from an EOA and holds. 27 of the 109
  tests run against live chain-196 state.

The mock adapter's prices are the exit values **measured from those real pools** —
GLDx $397.98, SPYx $777.05, NVDAx $223.73 — not round numbers. And `MockWrapper`
deliberately does **not** implement `multiplier()`: Arkiv's allowlist probes for
that function and refuses anything that answers, because the real xStocks *base*
tokens rebase and must never enter a vault. A mock that got the property wrong
would fail to allowlist and abort the deploy. The mock has to be honest for the
deployment to work at all.

Mainnet launch follows the competition, as its terms require. The mainnet deploy
script is in the repo, working, and untested against the live chain.

## Who controls it

The Arkiv owner is a **single EOA**. It can pause minting, change the allowlist,
and swap the DEX adapter. It cannot touch existing holdings — redemption is
in-kind, pays from each basket's own accounted reserves, and is never pausable.

A multisig is the production answer, and the standard should be the same 2-of-3
we disclose for the wrappers above. Until then this is a stated trust assumption
rather than a hidden one. See R8 in [`docs/RISKS.md`](docs/RISKS.md).

## Status

Contracts complete, 109 tests. Underwriter live. Deployed and verified on
X Layer testnet (21 contracts, three baskets seeded and exercised), app live at
https://arkiv-protocol.vercel.app. Mainnet launch follows the competition.
