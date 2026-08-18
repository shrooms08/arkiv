# Arkiv

**A thesis is not a portfolio until you say what would prove it wrong.**

Arkiv turns an investment thesis written in plain English into a weighted basket of tokenised US equities, and files it on chain permanently with a serial number. Every thesis must carry a falsifier: a written condition that would show the author was mistaken. The record stays whether the thesis holds or breaks.

Built for the OKX Build X Series AI Season, AI-RWA track, on X Layer.

- Live: https://arkiv-protocol.vercel.app
- Mainnet: X Layer, chain 196
- Testnet: X Layer, chain 1952, where the seven filed theses live
- Source: this repository

---

## Deployments

### X Layer mainnet, chain 196

| Contract | Address |
|---|---|
| Arkiv registry | `0x2CcfAb7975eAA9160F378A2f0a2a2B8F15b24946` |
| XLayerV3Adapter | `0x219Bd7965C2218596C49F8be9eA99565d56Fc6D0` |
| ArkivQuoter | `0x8D23AB81e47E5477E14D6308E5c606626dCbBE75` |

3 of 3 verified on Sourcify, creation and runtime match, confirmed through the Sourcify API rather than from deploy logs. State read from chain: `feeBps` 30, `curatorBps` 5000, attestor set, paused false.

The registry is live and permissionless against the real xStocks universe. **No baskets are seeded on it**, because seeding requires USDG this deployment does not have. That is stated plainly rather than worked around. Any funded address can file the first mainnet thesis today.

Total deployment cost was 0.000149785 OKB, about 1.6 US cents.

### X Layer testnet, chain 1952

Registry `0xB2e78cf1194BdFd8bb0e2C8A0BBF0d6146f7659c`

| Serial | Ticker | Basket |
|---|---|---|
| ARKIV-0001 | AIBOTTLE | `0xb88E14816Ac42B16B761Ab18d12C45A9FcA17f4a` |
| ARKIV-0002 | STICKYINF | `0x2100153203d303B82e6Ec21BDeD4bb32E455F789` |
| ARKIV-0003 | SCRATE | `0x8964db9f1FCC6D86F34600AF40D844C715971D27` |
| ARKIV-0004 | ATTENTION | `0x6a232080E2Eb3C236F866fA92c35b246D2C86192` |
| ARKIV-0005 | EDGEAI | `0xC0B56800Af8fad188ebE17Ca03896fe4764dF78C` |
| ARKIV-0006 | CAPEXPAY | `0x9FE13aB89f47936dD70608442D0af9Bb5D4AA95d` |
| ARKIV-0007 | STICKYINF | `0x860C6f1f85CA33da119F33356bAbA7EDf1d7F72A` |

25 of 25 verified on Sourcify at `https://repo.sourcify.dev/1952/<address>`, including ARKIV-0007, which this team did not deploy. See below.

Economics are live on chain, not documented aspiration. `quoteMintFee(1000e6)` returns a fee of 3 USDG against 997 net.

146 contract tests and 34 application tests pass.

---

## A stranger used it before we told anyone

Nine hours after the testnet registry went up, an address unconnected to this project filed a thesis and minted through the full path. Nothing about that run was staged and nothing has been removed.

What is measurable, and checkable on chain right now: their basket booked 0.90 USDG to the curator and 0.90 USDG to the protocol. At 30 bps that implies 600 USDG minted. Read `curatorEarnings` and `protocolEarnings` on `0x860C6f1f85CA33da119F33356bAbA7EDf1d7F72A` to confirm. We do not publish the transaction shape because we did not measure it, and the share count does not match a single first mint.

That run also exposed a real economics bug. See R14.

---

## The falsifier

Every basket product answers "what should I buy". None of them answer "how will I know if this was wrong".

An Arkiv thesis is not accepted without a falsifier: the claim, the observable that would test it, the breach condition, and the horizon. Three of the seven currently filed:

| Serial | Observable | Breaches when |
|---|---|---|
| ARKIV-0003 | Rolling 12-month total return, IWMx against SPYx | IWMx trails SPYx by more than 5 percentage points at horizon |
| ARKIV-0004 | Meta and Alphabet operating margin, ARPU, ad pricing | Both show flat or declining margins for two consecutive quarters, or both show declining ARPU |
| ARKIV-0005 | Apple on-device query share, NVIDIA data-center revenue growth | NVIDIA data-center revenue grows over 25% year on year for two consecutive quarters while Apple ships no material on-device expansion |

This matters because a thesis being wrong and a buyer losing money are different events, and almost every product in this category conflates them.

A thesis can be exactly right while the stock falls, because a court intervened or a recession arrived. A thesis can be entirely wrong while the stock rises, because something unrelated went well. Judging authors by returns rewards luck and punishes bad luck, and nobody learns anything from either.

Arkiv keeps two separate records. What a holder's position is worth tracks the underlying equities and nothing else. Whether the author was right tracks the falsifier. Curator fees are gated on the second, not the first.

---

## How it works

**Write.** A thesis in prose. No ticker picking, no weight sliders.

**Underwrite.** An AI underwriter returns a weighted basket with a rationale for each holding and a falsifier for the whole. Output is validated server side and again on chain: weights sum to 10000 bps, index and broad-exposure holdings total at least 5000 bps, the primary expression carries at least 1500 bps, 2 to 8 legs, 500 bps minimum per leg, allowlisted assets only. One retry, then a hard failure. Violations are reported, never silently repaired.

**Mint.** One path swaps USDG into every leg through the DEX and issues an ERC-20 share of that basket. Redemption is in kind and unconditional.

---

## Architecture decisions that carry weight

**Wrappers only, never base tokens.** xStocks exist as a rebasing base token and a non-rebasing wrapper. The vault holds wrappers exclusively. `setAssetAllowed` probes `multiplier()` and rejects any token that rebases, so the rule enforces itself rather than depending on an operator remembering it.

This is not theoretical. Static calls against the live mainnet registry and real Backed assets:

| Token | `multiplier()` | Drift from parity | Result |
|---|---|---|---|
| GLDx base | 1000000000000000000 | 0.0000% | reverts `RebasingToken(address)` |
| SPYx base | 1005714560286254000 | +0.5715% | reverts `RebasingToken(address)` |
| NVDAx base | 1000918075849099600 | +0.0918% | reverts `RebasingToken(address)` |
| all 14 wrappers | no such function | n/a | accepted |

The drift is the point. Those tokens have already rebased away from parity in production, so the error the guard prevents is live rather than hypothetical.

**No oracle in settlement.** Shares are issued as `S × min_i(d_i / B_i)`, computed from measured swap deltas against a reserves ledger, with a `minSharesOut` bound and in-kind refund of excess to the payer. Because reserves are credited only from deltas the contract measured itself, donation and inflation attacks are inert. Dead shares are burned on the first mint of every basket. No price feed participates in issuance or redemption.

**Redemption is unconditional.** `redeem()` reads no fee state, no breach state, and never calls the registry. Tested paying out in full with the fee at its 100 bps cap, the basket breached, minting paused, and the holder sanctioned.

---

## Economics

A mint fee, default 30 bps with a hard cap of 100, is split with the thesis author. Default split is 5000 bps to the curator.

The part that is not conventional: **the curator's share stops on breach.** While a thesis is unbreached the author earns on every mint. Once the falsifier fires, all subsequent fees route to the protocol. Fees already accrued remain claimable, because they were earned under conditions that held at the time. Breach is permanent. A closed thesis stays closed, and an author who still believes the idea files a new one with a new falsifier and a new serial.

The author is paid for thinking that has not yet been shown wrong. That is a transfer from buyers, and it is worth stating plainly: someone paying 3 USDG on a 1,000 USDG mint is paying for the reasoning, the construction and the exit condition. The same shape as paying a research service, with the difference that here you can check.

Where holder returns come from is simpler. The baskets hold real tokenised equities. If the underlying companies are worth more, holders are worth more. Nothing circular, no emissions, no yield sourced from later deposits.

---

## Track record

`curatorRecord` returns authored, breached and standing per author.

Authors accumulate a record of claims that held, not returns that happened. That is why breach is recorded on chain rather than in a database.

**Anyone can file a thesis. Not everyone accumulates a record.** Arkiv does not decide who is worth listening to. It makes the question answerable.

Being honest about what this currently shows: six of the seven filed theses were authored by the deployer, all within days, with horizons of six to twelve months. None can have resolved yet. The mechanism is live; the data is not yet informative.

---

## Verification against mainnet state

Thirty fork tests run against live chain 196 pools: pool derivation, quoting, minting, and full deploy. Exit values computed by the contracts agree with values measured from real pools to within 0.1%. The mock adapter used on testnet is seeded with those measured mainnet rates at zero drift, so testnet behaviour is a replay of mainnet behaviour rather than an approximation of it.

The mainnet deployment script simulated end to end against live chain 196 state before any funds moved. All 14 `registerPair` calls proved their pools and all 14 `setAssetAllowed` calls accepted their wrappers.

Recon findings are in `docs/FINDINGS.md`. Briefly: X Layer is OP Stack rather than zkEVM since the October 2025 migration, Cancun is enabled so transient storage works, `--legacy` is not required, USDG is 6 decimals not 18, there is no canonical Uniswap deployment so the adapter talks to a V3 fork pool directly behind a three-lock callback guard, and Chainlink could not be verified on chain, which is the practical reason settlement carries no oracle at all.

---

## What we know is wrong with this

This section exists because a disclosed weakness is a smaller problem than a discovered one.

**R1, wrapper upgradeability.** The xStocks wrappers are upgradeable by a 2-of-3 Gnosis Safe controlled by the issuer. Two of three keyholders can replace the implementation of every token in the vault, which could freeze balances or zero the holdings. Arkiv's accounting would stay correct and would faithfully report holdings that were no longer worth anything. This is the standing condition of holding any Backed xStock on any chain. Disclosed, not mitigated.

**R8, single-owner deployer.** Contracts are owned by a single EOA. Appropriate for a hackathon deployment, not for real funds. Multisig is the obvious next step.

**R13, single-address attestor.** Breach is called by one address, currently the deployer. The likelier failure is not a malicious breach call but a breach that should be called and is not, because nobody complains when a stream keeps paying. The observable and its source are published at filing time so the call is checkable against something external. The real fix is machine resolution for arithmetic falsifiers plus a dispute window and an attestation set for the rest. Not built.

**R14, duplicate thesis filing.** The contract permits the same thesis to be filed twice, and the second filer becomes curator of the duplicate, earning a stream on work they did not do. The app now reads the registry before filing and matches on thesis hash, routing a repeat filing into the existing basket. A caller going directly to the contract can still clone. The fix is rejecting a known hash in `createBasket` on a future deployment. This was found because a visitor did it accidentally on day one. ARKIV-0007 stays on chain.

**Custody.** Arkiv holds the wrappers and issues a share. Non-custodial competitors keep assets in the user's own wallet, which is a genuinely better property and we are not going to argue otherwise. What Arkiv offers instead is an exit guarantee that cannot be switched off.

**Testnet curator.** Six of seven seed baskets list the deployer as curator. A deployment artifact, not a claim about authorship, disclosed on every basket page.

**xStocks are not equity.** They are tracker certificates issued by Backed Assets, giving economic exposure to the underlying share. They are not shares, they carry no voting rights, and holders have a claim on the issuer rather than on the company.

**R12, a liveness bug we caught.** Redeeming an entire supply could floor a leg's balance to zero and brick subsequent mints. Dead shares burned on first mint prevent it.

---

## The core floor turned out to be an editor

CAPEXPAY, ARKIV-0006, is the clearest evidence that the constraints do useful work rather than merely blocking things.

The first version of the thesis named four beneficiaries of AI capital expenditure. It was rejected twice by validation, both times landing at 4000 bps core against a 5000 floor. Structural rather than a model failure: clearing the floor would have left 5000 bps split four ways, and each name would have read as a token allocation rather than a conviction.

The rewrite narrowed the claim to a single category of beneficiary. It cleared on one call, at exactly 5000 bps core, with MSFTx as primary expression at 3000 bps.

The constraint was not fighting the thesis. It was fighting the thesis being vague about who wins. A thesis that cannot survive a core floor has usually not decided what it thinks.

Rejections are reported, never repaired. Arkiv persists only successful underwritings, so the two failed attempts have no fixture. That outcome is project history, not an archive record, and it is not dressed as one.

---

## Bring your own agent

`skills/arkiv-thesis/SKILL.md`, also served at https://arkiv-protocol.vercel.app/skills/arkiv-thesis/SKILL.md

A published skill that teaches any AI agent to draft an Arkiv thesis: what a falsifiable claim looks like, which constraints the underwriter enforces, and why vagueness fails, with the CAPEXPAY case as worked evidence.

The skill deliberately does not choose assets, assign weights, or write falsifiers. Those are the underwriter's job and are enforced on chain. A skill that produced weights would be a second unvalidated underwriter, and the constraints would stop meaning anything.

---

## On mobile

X Layer charges gas in OKB, and mobile browsers provide no injected wallet. Rather than adding WalletConnect, Arkiv points people at the OKX Wallet browser, which arrives on the right chain, holds the OKB that pays for gas, and connects without a pairing step.

Reading needs no wallet at all. The archive, every thesis, every falsifier, and every basket's live composition and exit value all work without connecting anything.

---

## Two traps for anyone forking this

**A local anvil fork keeps chain id 196.** It writes real-looking hashes and receipts into `broadcast/Deploy.s.sol/196/`, indistinguishable from a real mainnet deployment by inspection. What separates them is that the addresses have no code on the public RPC, the hashes do not resolve there, and the receipts sit thousands of blocks behind the real head. Check the chain, not the artifact.

**`wagmi/connectors` exports `walletConnect` whether or not you have the peer dependency.** It dynamically imports `@walletconnect/ethereum-provider`, so wiring it without installing that package type-checks, builds, deploys, and throws at the first tap. Worse than a dead button.

**And a deployment one:** `vercel deploy --prod` does not move a manually created alias. The deploy reports ready, every route returns 200, and the alias serves the previous build. Repoint explicitly and verify in a real browser, not with curl.

---

## Where this sits

Thematic on-chain baskets are not a new category. The closest comparison is Cesto on Solana, which is further along on distribution and is non-custodial. Alvara on Ethereum has similar curator-fee rails and publishes an on-chain track record of what a curator did.

The distinction Arkiv is making is narrow and specific. Alvara records what an author did. Arkiv records whether the author was right, and prices the difference.

**You are not buying stocks. You are buying someone's argument, with the positions attached and the exit condition written down.**

---

## Next

- Machine-resolvable falsifiers. Arithmetic breach conditions such as ARKIV-0003's should resolve permissionlessly from on-chain data, leaving the attestor for claims that genuinely need off-chain judgment
- Reject duplicate thesis hashes in `createBasket`
- Multisig ownership
- Routing through the OKX DEX aggregator rather than pool-direct
- A subscription phase before a basket goes live, so a newly filed thesis has a reason for anyone to be first in

---

## Running it

```bash
forge test                 # 146 contract tests
npm test                   # 34 application tests
npm run dev                # local app
CHAIN=196 ./verify.sh      # Sourcify verification, either chain
```

`ANTHROPIC_MODEL` selects the underwriting model and is never hardcoded. Deployment manifests are in `deployments/`, generated from chain reads rather than local state.

---

## Status

Mainnet registry is live and unseeded. Testnet carries the seven filed theses and every asset there is a mock. Nothing here is a security, an offer, or investment advice.