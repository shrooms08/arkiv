# Deployments

Canonical record of where Arkiv is deployed. Committed deliberately: `.env.local`
holds the RPC URL and keys and is gitignored, but **the addresses must be in the
repo**, because a submission nobody else can reproduce is not a submission.

| File | Chain | Assets |
| --- | --- | --- |
| `xlayer-testnet.json` | 1952 | Mocks — fixed-rate adapter, faucet USDG |
| `xlayer-mainnet.json` | 196 | Real xStocks wrappers issued by Backed |

`status` is `not-deployed` until a broadcast succeeds; it is filled from the
Foundry broadcast artefact rather than typed by hand, so the recorded addresses
are the ones that were actually mined.

**Chain 1952 is X Layer testnet**, verified against `testrpc.xlayer.tech`. An
earlier revision of the frontend assumed 195, which is wrong.
