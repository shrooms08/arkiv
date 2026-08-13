# Arkiv

**A thesis is not a portfolio until you say what would prove it wrong.**

Arkiv turns an investment thesis written in plain English into a weighted basket of tokenised US equities, and files it on chain permanently with a serial number. Every thesis must carry a falsifier: a written condition that would show the author was mistaken. The record stays whether the thesis holds or breaks.

Built for the OKX Build X Series AI Season, AI-RWA track, on X Layer.

- Live: https://arkiv-protocol.vercel.app
- Chain: X Layer testnet, chain 1952
- Source: this repository

---

## Live deployment

Registry `0xB2e78cf1194BdFd8bb0e2C8A0BBF0d6146f7659c`

| Serial | Ticker | Basket |
|---|---|---|
| ARKIV-0001 | AIBOTTLE | `0xb88E14816Ac42B16B761Ab18d12C45A9FcA17f4a` |
| ARKIV-0002 | STICKYINF | `0x2100153203d303B82e6Ec21BDeD4bb32E455F789` |
| ARKIV-0003 | SCRATE | `0x8964db9f1FCC6D86F34600AF40D844C715971D27` |
| ARKIV-0004 | ATTENTION | `0x6a232080E2Eb3C236F866fA92c35b246D2C86192` |
| ARKIV-0005 | EDGEAI | `0xC0B56800Af8fad188ebE17Ca03896fe4764dF78C` |
| ARKIV-0006 | CAPEXPAY | `0x9FE13aB89f47936dD70608442D0af9Bb5D4AA95d` |

All 25 contracts verified on Sourcify at `https://repo.sourcify.dev/1952/<address>`, confirmed through the Sourcify API rather than from deploy logs. That includes ARKIV-0007, which a visitor filed after the initial verification run.

Economics are live on chain, not documented aspiration. `quoteMintFee(1000e6)` returns a fee of 3 USDG against 997 net. Six seed mints have booked 9.00 USDG of fee, split 4.50 to the curator and 4.50 to the protocol.

146 contract tests and 25 application tests pass.

---

## The falsifier

Every basket product answers the question "what should I buy". None of them answer "how will I know if this was wrong".

An Arkiv thesis is not accepted without a falsifier, which has four parts: the claim, the observable that would test it, the breach condition, and the horizon. Here are three of the six currently filed.

| Serial | Observable | Breaches when |
|---|---|---|
| ARKIV-0003 | Rolling 12-month total return, IWMx against SPYx | IWMx trails SPYx by more than 5 percentage points at horizon |
| ARKIV-0004 | Meta and Alphabet operating margin, ARPU, ad pricing | Both show flat or declining margins for two consecutive quarters, or both show declining ARPU |
| ARKIV-0005 | Apple on-device query share, NVIDIA data-center revenue growth | NVIDIA data-center revenue grows over 25% year on year for two consecutive quarters while Apple ships no material on-device expansion |

This matters because a thesis being wrong and a buyer losing money are different events, and almost every product in this category conflates them.

A thesis can be exactly right while the stock falls, because a court intervened or a recession arrived. A thesis can be entirely wrong while the stock rises, because something unrelated went well. Judging authors by returns rewards luck and punishes bad luck, and nobody learns anything from either.

Arkiv keeps two separate records. What the holder's position is worth tracks the underlying equities and nothing else. Whether the author was right tracks the falsifier. Curator fees are gated on the second, not the first.

---

## How it works

**Write.** A thesis in prose. No ticker picking, no weight sliders.

**Underwrite.** An AI underwriter returns a weighted basket with a rationale for each holding and a falsifier for the whole. Output is validated server side and again on chain: weights sum to 10000 bps, index and broad-exposure holdings total at least 5000 bps, the primary expression carries at least 1500 bps, 2 to 8 legs, 500 bps minimum per leg, allowlisted assets only. One retry, then a hard failure. Violations are reported, never silently repaired.

**Mint.** One transaction path swaps USDG into every leg through the DEX and issues an ERC-20 share of that basket. Redemption is in kind and unconditional.

---

## Architecture decisions that carry weight

**Wrappers only, never base tokens.** xStocks exist as a rebasing base token and a non-rebasing wrapper. The vault holds wrappers exclusively. `setAssetAllowed` probes `multiplier()` and rejects any token that rebases, so the rule enforces itself rather than depending on an operator remembering it.

**No oracle in settlement.** Shares are issued as `S × min_i(d_i / B_i)`, computed from measured swap deltas against a reserves ledger, with a `minSharesOut` bound and in-kind refund of excess to the payer. Because reserves are credited only from deltas the contract measured itself, donation and inflation attacks are inert. Dead shares are burned on the first mint of every basket. No price feed participates in issuance or redemption, so there is no oracle to manipulate and no oracle to go stale.

**Redemption is unconditional.** `redeem()` reads no fee state, no breach state, and never calls the registry. It is tested paying out in full with the fee at its 100 bps cap, the basket breached, minting paused, and the holder sanctioned. This is the exit guarantee that offsets the custody trade-off described below.

---

## Economics

A mint fee, default 30 bps with a hard cap of 100, is split with the thesis author. Default split is 5000 bps to the curator.

The part that is not conventional: **the curator's share stops on breach.** While a thesis is unbreached the author earns on every mint. Once the falsifier fires, all subsequent fees route to the protocol. Fees already accrued remain claimable, because they were earned under conditions that held at the time. Breach is permanent. A closed thesis stays closed, and an author who still believes the idea files a new one with a new falsifier and a new serial.

So the author is paid for thinking that has not yet been shown wrong. That is a transfer from buyers, and it is worth stating plainly rather than dressing up: someone paying 3 USDG on a 1,000 USDG mint is paying for the reasoning, the construction and the exit condition. It is the same shape as paying a research service, with the difference that here you can check.

Where holder returns come from is a separate and simpler question. The baskets hold real tokenised equities. If the underlying companies are worth more, holders are worth more. Nothing circular, no emissions, no yield sourced from later deposits.

---

## Track record

`curatorRecord` currently returns 6 authored, 0 breached, 6 standing.

Authors accumulate a record of claims that held, not returns that happened. That is the ranking Arkiv intends to make legible, and it is the reason breach is recorded on chain rather than in a database.

**Anyone can file a thesis. Not everyone accumulates a record.** Arkiv does not decide who is worth listening to. It makes the question answerable.

---

## Verification against mainnet

The deployment is on testnet, but the accounting is verified against real X Layer mainnet state.

Thirty fork tests run against live chain 196 pools: pool derivation, quoting, minting, and full deploy. Exit values computed by the contracts agree with values measured from real pools to within 0.1%. The mock adapter used on testnet is seeded with those measured mainnet rates at zero drift, so testnet behaviour is not an approximation of mainnet behaviour, it is a replay of it.

Recon findings that shaped the build are recorded in `docs/FINDINGS.md`. Briefly: X Layer is OP Stack rather than zkEVM since the October 2025 migration, Cancun is enabled so transient storage works, `--legacy` is not required, USDG is 6 decimals not 18, there is no canonical Uniswap deployment so the adapter talks to a V3 fork pool directly behind a three-lock callback guard, and Chainlink could not be verified on chain, which is the practical reason settlement carries no oracle at all.

---

## What we know is wrong with this

This section exists because a disclosed weakness is a smaller problem than a discovered one.

**R1, wrapper upgradeability.** The xStocks wrappers are upgradeable by a 2-of-3 Gnosis Safe controlled by the issuer. Arkiv cannot fix this and does not pretend to. If the wrapper implementation changes adversarially, baskets holding it are exposed. Disclosed, not mitigated.

**R8, single-owner deployer.** Contracts are owned by a single EOA, `0xd8157D6E2E3017cB28F05A8E9781Af0A1bD2f080`. Appropriate for a hackathon deployment, not for real funds. Multisig is the obvious next step.

**R13, single-address attestor.** Breach is called by one address, currently the deployer. The likelier failure is not a malicious breach call but a breach that should be called and is not, because nobody complains when a stream keeps paying. The mitigation is structural rather than social: the observable and its source are published at filing time, so the call is checkable against something external. The real fix is a dispute window followed by an attestation set, and that is not built.

**Custody.** Arkiv holds the wrappers and issues a share. Non-custodial competitors keep assets in the user's own wallet, which is a genuinely better property and we are not going to argue otherwise. What Arkiv offers instead is an exit guarantee that cannot be switched off: redemption reads no state that anyone can change.

**Testnet curator.** All six seed baskets list the deployer as curator. That is a deployment artifact, not a claim about authorship, and it is disclosed on every basket page.

**xStocks are not equity.** They are tracker certificates issued by Backed Assets, giving economic exposure to the underlying share. They are not shares, they carry no voting rights, and holders have a claim on the issuer rather than on the company. Anyone describing them as stock ownership is being imprecise.

**R12, a liveness bug we caught.** Redeeming an entire supply could floor a leg's balance to zero and brick subsequent mints. Dead shares burned on first mint prevent it. Recorded because the bug was real and the guard is why it is not.

**R14, duplicate thesis filing.** `createBasket` accepts any thesis URI, including one already recorded against an existing basket. Nothing on chain compares a new filing's hash to the filings already in the registry, so a caller can copy a thesis from the archive, file it, become `creatorOf` the copy, and collect the curator share on an argument they did not write. The app now reads the registry before filing, matches on thesis hash rather than on ticker or title, and routes a repeat filing into buying the existing basket instead. That closes the accidental path completely and the deliberate one not at all: anyone calling the contract directly can still do it. The real fix is rejecting a known hash in `createBasket`, which is a contract change and a redeploy, and is deliberately not being made against a live registry this close to submission. Full writeup in `docs/RISKS.md`.

**The wagmi connector trap, for anyone forking this.** `wagmi/connectors` exports `walletConnect`, so it looks available and it is not. The connector dynamically imports `@walletconnect/ethereum-provider`, which is a peer dependency this project does not install. Wiring it up type-checks, builds, deploys, and then throws the first time a user taps connect. Arkiv ships `injected()` only, deliberately: adding WalletConnect needs the dependency plus a Reown Cloud project id, and neither is exercisable in a headless browser, which is where every other claim in this repository is checked. The mobile route is the OKX Wallet browser instead, which for an X Layer app is the native answer rather than a workaround.

**A stranger found it first.** Nine hours after the registry went up, an address unaffiliated with this project, `0xDa0689785C6fDD754bc105691bC38398E4E4AfB4`, found Arkiv and ran the complete path: create, approve, mint. That is ARKIV-0007, filed 2026-08-12T23:22:12Z, and they still hold its entire supply.

The size is measured rather than estimated: their mint recorded **$1.80 of fee**, $0.90 accrued to them as curator and $0.90 to the protocol, which at 30 bps is $600 of USDG through the mint. Both figures are readable on chain today from `curatorEarnings` and `protocolEarnings`.

That run also exposed R14. The mint flow called `createBasket` unconditionally, so buying into an existing thesis produced a duplicate as a side effect rather than through any intent of theirs. Nothing about it was staged and nothing was removed afterwards. Their basket is verified alongside the seeded ones, 25 of 25. The archive is append-only, and a real filing is not deleted for being inconvenient.

---

## The core floor turned out to be an editor

CAPEXPAY, ARKIV-0006, is the clearest evidence that the constraints do useful work rather than merely blocking things.

The first version of the thesis named four beneficiaries of AI capital expenditure. It was rejected twice by validation, both times landing at 4000 bps core against a 5000 floor. This was structural rather than a model failure: clearing the floor would have left 5000 bps split four ways, and each name would have read as a token allocation rather than a conviction.

The rewrite narrowed the claim to a single category of beneficiary, enterprise software vendors with an existing procurement relationship. It cleared on one call, at exactly 5000 bps core, with MSFTx as primary expression at 3000 bps.

The constraint was not fighting the thesis. It was fighting the thesis being vague about who wins. A thesis that cannot survive a core floor has usually not decided what it thinks.

Rejections are reported, never repaired. The two failed attempts are recorded rather than hidden.

---

## Bring your own agent

`skills/arkiv-thesis/SKILL.md` is a published skill that teaches any AI agent to draft an Arkiv thesis: what a falsifiable claim looks like, which constraints the underwriter enforces, and why vagueness fails, with the CAPEXPAY case as worked evidence.

The skill deliberately does not choose assets, assign weights, or write falsifiers. Those are the underwriter's job and are enforced on chain. A skill that produced weights would be a second unvalidated underwriter, and the constraints would stop meaning anything.

---

## Where this sits

Thematic on-chain baskets are not a new category. The closest comparison is Cesto on Solana, which is further along on distribution and is non-custodial. Alvara on Ethereum has similar curator-fee rails and publishes an on-chain track record of what a curator did.

The distinction Arkiv is making is narrow and specific. Alvara records what an author did. Arkiv records whether the author was right, and prices the difference.

**You are not buying stocks. You are buying someone's argument, with the positions attached and the exit condition written down.**

---

## Running it

```bash
forge test                 # 146 contract tests
npm test                   # 25 application tests
npm run dev                # local app against testnet
```

`ANTHROPIC_MODEL` selects the underwriting model and is never hardcoded. Deployment manifests are in `deployments/`, generated from chain reads rather than local state.

A note for anyone deploying this: `vercel deploy --prod` does not move a manually created alias. The deploy reports ready, every route returns 200, and the alias serves the previous build. Repoint the alias explicitly and verify in a real browser, not with curl.

---

## Status

X Layer testnet. Every asset is a mock. Nothing here is a security, an offer, or investment advice.
