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

## Status

Contracts complete and tested against live chain state. Frontend and AI
underwriter in progress.
