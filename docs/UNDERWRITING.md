# UNDERWRITING

How Arkiv turns a stated belief into a basket, and what the model can and cannot
do. Published because auditable beats magic: if you are going to hold something an
AI proposed, you should be able to read the rules it was held to.

Prompt version `underwriter/2026-08-11.3`. Model read from `ANTHROPIC_MODEL`;
`claude-sonnet-4-6` at launch.

---

## What the underwriter is

A language model with a fixed asset list, a strict output schema, and a set of
rules it cannot talk its way around. You give it a thesis in plain language. It
returns a basket, a reason for each holding, and a falsifier.

## What it is not

It has **no market data feed, no prices, and no ability to verify any claim it
makes**. It is pattern-matching a stated belief onto fourteen instruments. It can
produce a confident, well-argued, wrong thesis, and nothing in this document
prevents that.

It does not know what an asset is worth. Nothing in the mint path consults it, and
no number it emits reaches the contracts — a basket's weights are validated
against the rules below and then written on-chain as declared intent, not as a
prediction. See R9 in [`RISKS.md`](./RISKS.md).

This is not investment advice.

---

## The asset universe

Fourteen assets, every one verified live on chain 196. The model is handed this
list as an enum in its output schema, so it is **structurally incapable of naming
an asset that does not exist** — a hallucinated ticker is not rejected after the
fact, it cannot be emitted.

**Core** — GLDx (Gold), QQQx (Nasdaq 100), SPYx (S&P 500), IWMx (Russell 2000).

**Tilt** — NVDAx, TSLAx, MSFTx, AMZNx, COINx, METAx, AVGOx, GOOGLx, AAPLx, AMDx.

### How core and tilt are decided

**Purely by measured pool depth, not by what the asset is.** Core assets sit in
the deepest USDG pools: $236k–$280k of reserve, 22–62 bp of slippage on a $5,000
mint. Tilt assets sit in $94k–$111k pools at 107–279 bp. The full measurements are
in [`FINDINGS.md`](./FINDINGS.md) §5, taken by executing real swaps on a mainnet
fork rather than estimating.

Two consequences worth stating plainly, because both surprise people:

- **GLDx is core.** It is the deepest pool in the universe, so gold is available
  as a liquid anchor for macro and defensive theses rather than being treated as
  an exotic.
- **IWMx is core, even though a small-cap bet is a "tilt" in ordinary usage.** The
  taxonomy tracks liquidity, not style. A small-cap thesis expressed through IWMx
  therefore consumes core budget, and needs genuine tilt holdings alongside it to
  stay inside the band below.

## The rules

Enforced in code, on the server, before anything reaches a user or a chain:

| Rule | Value | Why |
| --- | --- | --- |
| Holdings | 2–8 | Legs are the on-chain cost driver: L1 data fee scales with calldata and each leg is another swap |
| Weights sum | exactly 10000 bps | |
| Minimum per holding | 500 bps | Below 5%, a leg costs more in gas and slippage than it contributes in expression |
| Core total | at least 5000 bps | Keeps mints in deep pools so slippage stays inside the 200 bp budget. **No ceiling** — see below |
| `primaryExpression` | names a holding, ≥ 1500 bps | The named holding must be in the basket and carry real weight |
| Duplicates | none | |
| Symbols | allowlist only | |

### Why there is no core ceiling

There used to be one, at 6000 bps. It was removed, and the reason is worth
stating because it is the kind of mistake that is easy to repeat.

`core` conflates two orthogonal properties. **Liquidity depth** is why the floor
exists: it protects mint execution, and that is a safety property, enforced
on-chain in `Arkiv.createBasket`. **Thesis expression** is what the ceiling was
actually trying to preserve: stopping the underwriter from returning a boring
90%-index basket. Those are different constraints, and making them share one
number meant the rule fought itself.

It broke on the first small-cap thesis. IWMx is simultaneously the deepest pool
available *and* the single most direct expression of "small caps catch a bid", so
the basket wanted the same holding to satisfy the floor and be the point — and the
ceiling rejected it twice.

The fix is structural: the ceiling is gone, and expression is enforced directly by
`primaryExpression`. The model must name the one holding that most directly
expresses the thesis, and that holding must carry at least 1500 bps. A basket can
now be 100% index and still legal — because a 100% index basket is *less* risky,
not more — provided it names a holding that carries the view. The small-cap thesis
resolves cleanly at IWMx 5000 bps, anchor and expression at once, no contradiction.

See R11 in [`RISKS.md`](./RISKS.md).

## Non-conforming output is rejected, never repaired

If the model returns a basket that breaks a rule, it gets **one retry** with the
specific violations fed back — the exact numbers, not "try again". If the second
attempt also fails, the request hard-fails with a 422 and no basket is produced.

Nothing patches the output into legality. A basket rewritten by code to satisfy a
rule is no longer the thesis the model proposed, and an archive of quietly
corrected theses is worth nothing.

## The falsifier

The mandatory part, and the reason Arkiv exists rather than being a basket
generator. Every thesis carries four fields:

- **claim** — the single load-bearing belief. If this is false, the thesis is wrong.
- **observable** — the specific, checkable thing to watch, without inside information.
- **breachCondition** — the reading that falsifies the claim, concrete enough that
  two people would agree it happened.
- **horizon** — 1M, 3M, 6M or 12M.

A thesis nobody can be wrong about is worthless. The underwriter is instructed to
pick the observable that would change *its* mind, not the one most likely to be
confirmed, and to write the honest falsifier even when it makes the thesis look
fragile.

Example of the bar, from a recorded output:

> **claim** — Hyperscaler capex continues to grow year-over-year for at least two
> consecutive quarters, confirming that demand — not sentiment — is driving AI
> infrastructure build-out.
> **observable** — Combined capex guidance from MSFT and AMZN at their next two
> quarterly earnings calls, reported in their investor relations filings.
> **breach** — Either MSFT or AMZN guides capex flat or down year-over-year in two
> consecutive quarters, or both guide flat/down in the same quarter.

## Per-holding rationale

Each holding carries a reason *that* asset serves *that* thesis at *that* weight —
not a description of the company. A rationale that could be pasted onto any other
basket is a failure of the rationale, and the model is told to fix it or drop the
holding. Two further rules, both added after reading real output:

- **Every holding needs a positive reason to be there.** A position that exists
  only to make the weights add up means the basket has too many legs. Six holdings
  the model can defend beat seven with an apology in one of them. An earlier sample
  wrote "not a conviction position" about a 500 bps leg — that is the model telling
  you in writing that the leg is filler.
- **A rationale must name a causal mechanism, not a historical correlation.** "X
  has historically moved with Y" is an observation that may stop being true exactly
  when it matters. Say *why*: a cost structure, a contract, a supply constraint, a
  balance-sheet effect. Correlation can support an argument; it cannot be one.

## Confidence

Rated on whether the thesis can be **checked** and whether it can be **expressed**
with the available assets — not on how strongly it is felt.

- **high** — the falsifier's observables are directly measurable on a known
  schedule, and the allowlist expresses the thesis cleanly.
- **medium** — one holds but not both.
- **low** — the thesis depends on something unobservable or unscheduled, or the
  allowlist forces a distant proxy.

An earlier version had no rubric and returned "medium" for three theses out of
three, which is worse than no confidence field at all: it implies a judgement that
was not made.

## A structured-outputs limitation worth knowing

Structured outputs constrain the **shape** of a response, not string lengths. The
SDK strips `minLength`/`maxLength` from the JSON Schema before sending it and
checks them client-side afterwards — so a too-long summary is a normal, expected
outcome, not an API error.

This matters for two reasons. First, length violations must be handled as ordinary
retry material rather than as exceptions. Second, `messages.parse()` **throws** on
that client-side check, and the throw happens before `usage` can be read — so the
call's token spend disappears silently. Arkiv therefore uses `messages.create()`
plus an explicit Zod parse: usage is always captured, and a long summary costs one
retry instead of crashing the route.

## Reproducibility

Every live call appends one line to `logs/underwriting.jsonl`, keyed by
`thesisHash` (sha256 of the input thesis): model ID, prompt version, effort level,
the exact input, the full output, per-call token usage, and cost.

A basket is reproducible only against the prompt version that produced it. A
thesis archived under `underwriter/2026-08-11.1` should not be compared to one
produced under `.2` — the instructions changed, so the outputs are not
commensurable. That is why the version is recorded rather than assumed.

## Cost discipline

Development runs against **cached fixtures** in `test/fixtures/underwriting/`, not
the live API. `ARKIV_UNDERWRITER_MODE=live` is required to spend credit; anything
else serves fixtures. Recording new fixtures is a deliberate act
(`npm run underwrite:samples`), not a side effect of opening a page.

The system prompt is a stable cached prefix and the thesis varies after it, so
repeated calls read the cache rather than re-paying for the rules.

## Known limitations

- **No prices.** The model cannot weigh by valuation, momentum, or correlation. It
  reasons from the stated belief and its own priors about what the companies do.
- **Fourteen instruments.** Many theses cannot be expressed. The model is not
  allowed to say so by inventing an asset, so it will express the nearest thing it
  can — read the rationales to judge whether the mapping is honest.
- **The 5000–6000 core band is tight**, and tightest for small-cap theses, since
  IWMx is core. It is satisfiable — a recorded sample lands on exactly 5000 with a
  50% tilt — but it constrains how a rate-sensitive small-cap view can be shaped.
- **Confidence is self-reported** and carries no calibration guarantee.
