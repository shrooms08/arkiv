# Asset allowlist

GENERATED FILE. Do not edit by hand. Produced by `scripts/build-skill-reference.ts`
from `src/config/assets.ts` and `src/lib/underwriting/schema.ts`, the same
modules the underwriter and the on-chain validator use.

A thesis can only be expressed in these 14 assets. If the companies your
argument is really about are not here, the thesis is not expressible on Arkiv
today, and the honest outcome is to say so rather than to substitute a loosely
related name. The underwriter will not invent an asset, and neither should you.

Every asset is a Backed xStock wrapper, meaning a tokenized share of the
underlying US-listed security. Settlement is in USDG.

## Liquidity anchors

Broad-exposure holdings. These are what the core floor is measured against:
at least **5000 bps** of any basket must sit in this group.

| Symbol | Underlying | Role |
| --- | --- | --- |
| `GLDx` | Gold | Liquidity anchor |
| `QQQx` | Nasdaq 100 | Liquidity anchor |
| `SPYx` | S&P 500 | Liquidity anchor |
| `IWMx` | Russell 2000 | Liquidity anchor |

## Thesis expressions

The names a thesis is actually about. One of these is normally the primary
expression, which must carry at least **1500 bps**.

| Symbol | Underlying | Role |
| --- | --- | --- |
| `NVDAx` | NVIDIA | Thesis expression |
| `TSLAx` | Tesla | Thesis expression |
| `MSFTx` | Microsoft | Thesis expression |
| `AMZNx` | Amazon | Thesis expression |
| `COINx` | Coinbase | Thesis expression |
| `METAx` | Meta | Thesis expression |
| `AVGOx` | Broadcom | Thesis expression |
| `GOOGLx` | Alphabet | Thesis expression |
| `AAPLx` | Apple | Thesis expression |
| `AMDx` | AMD | Thesis expression |

## Deliberately excluded

Verified as deployed on X Layer but not usable, because each lacks a USDG
pool or has one too thin to price against. Excluded means excluded: a thesis
that needs one of these cannot be expressed, and no substitution is a fix.

- `VTIx`, wrapper totalSupply 0, no USDG pool
- `VOOx`, wrapper totalSupply 0, no USDG pool
- `SLVx`, wrapper totalSupply 0, no USDG pool
- `JPMx`, wrapper totalSupply 0, no USDG pool
- `LLYx`, wrapper totalSupply 0, no USDG pool
- `UNHx`, wrapper totalSupply 0, no USDG pool

## What the underwriter will enforce

| Rule | Value |
| --- | --- |
| Legs per basket | 2 to 8 |
| Minimum per leg | 500 bps |
| Weights must sum to | 10000 bps |
| Core floor, liquidity anchors combined | at least 5000 bps |
| Primary expression, single holding | at least 1500 bps |

These are checked server-side after generation and rejected on failure. They are
not suggestions, and they are not something your prose can negotiate around. What
your prose can do is make them easy to satisfy, which is what the skill is for.

## What the universe cannot express

The ten thesis expressions above are all US large-cap technology, plus four
broad anchors. That is the whole surface a thesis has to work with.

There is no utilities, industrials, energy, defence, materials, real estate or
consumer-staples name anywhere, allowed or excluded. A thesis about the power
grid, reshoring or defence spending has nothing to buy at all.

Financials and healthcare exist only in the excluded list, meaning `JPMx`,
`LLYx` and `UNHx` are deployed but unusable. They are no more expressible
than a sector that was never listed, and the fact that a symbol exists is not
a reason to reach for it.

Recognising this before writing is faster than discovering it in a rejection.
Non-US exposure, small caps beyond `IWMx`, bonds, credit and currencies are
all likewise absent.
