---
name: arkiv-thesis
description: Helps someone write an investment thesis in prose for Arkiv, an archive of theses on X Layer where an underwriter turns a written belief into a weighted basket of tokenized equities plus a falsifier. Use when a user wants help drafting, sharpening or pressure-testing a thesis paragraph before submitting it. Produces prose only, never allocations.
---

# Writing an Arkiv thesis

Arkiv is an archive of investment theses. Someone writes what they believe in
plain English, an underwriter turns it into a weighted basket of tokenized US
equities, and every basket carries a falsifier: an observable and a condition
that would prove the claim wrong. The record keeps its serial number after it
resolves, including when it was wrong.

Your job is to help the user write **the paragraph**. That is the whole job.

## What this skill does not do

Read this before writing anything, because the natural instinct is to be more
helpful than you should be here.

Do **not**:

- Choose assets or name tickers
- Assign weights or percentages
- Write the falsifier, the observable or the breach condition
- Produce JSON, a table, or any structured output
- Call any Arkiv endpoint, contract or API

Allocation and falsifier generation are the underwriter's job. They are
enforced server-side and again on-chain: weights must sum to 10000 bps, the core
floor and primary expression minimums are checked after generation, and a basket
that fails is rejected rather than repaired. If you hand the user a set of
weights, you have built a second underwriter that nothing validates, and the
on-chain constraints stop meaning anything the moment someone trusts your
numbers over the system's.

The deliverable is **one paragraph of prose** the user pastes into the write box
at `/app` on Arkiv. Nothing else.

If the user explicitly asks you for weights anyway, tell them plainly that the
underwriter assigns those and that guessing them here would not survive
validation, then offer to sharpen the paragraph instead.

## What a thesis is

A causal claim about why a set of companies will do better or worse than the
market currently expects, stated plainly enough that a specific future
observation could contradict it.

Three parts, and all three have to be there:

1. **A mechanism.** Not what will happen, but *why* it will happen. What is the
   chain of cause and effect?
2. **A direction.** Who benefits, who suffers, and relative to what.
3. **A reason the market has not priced it.** What does the author believe that
   the consensus does not?

A paragraph missing the mechanism is a mood. A paragraph missing the direction
is an observation. A paragraph missing the third part is usually a description
of something everyone already knows.

## The constraints the underwriter will enforce

The user's prose does not have to satisfy these directly, but a thesis that
cannot be expressed inside them will be rejected, and the rejection will arrive
after the user has already committed to the idea. Writing with them in mind is
faster than discovering them.

- **Core floor.** Liquidity anchors, meaning broad index and commodity exposure,
  must total at least **5000 bps** of the basket. Half of any basket is
  structural.
- **Primary expression.** At least **1500 bps** must sit in the single holding
  the thesis is most about.
- **Shape.** Between 2 and 8 legs, minimum 500 bps each, summing to 10000.
- **Universe.** Only assets on the allowlist. See `reference/allowlist.md`.

The core floor is the constraint that shapes the writing, and it is worth
understanding as an editor rather than an obstacle. Half the basket is already
spoken for, so the remaining half has to carry the entire argument. A thesis
about one thing has 5000 bps to say it with. A thesis about four things has
1250 bps each, which reads as a sector allocation rather than a conviction, and
tends to fail.

## Why vagueness fails: the CAPEXPAY case

This is documented rather than illustrative. It happened, and it is the clearest
teaching material in the archive.

The author wanted to write about the AI capital expenditure bill coming due, and
who converts that spending into revenue.

**The first version named four categories of beneficiary.** It was submitted
twice and rejected both times, landing at 4000 bps of core against a 5000 bps
floor. The cause was structural, not stylistic: naming four beneficiaries forced
the underwriter to split the non-core half four ways, and at roughly 1250 bps
each every name read as a token allocation rather than a conviction. To clear the
floor it would have had to cut something, and the prose gave it no basis to
choose which.

**The rewrite narrowed the claim to one category of beneficiary**: enterprise
software vendors that already hold a procurement relationship with the customer
they now want to sell inference to. Same underlying belief, one expression of it.

It cleared on a single call, at exactly 5000 bps core, with the primary
expression at 3000 bps. See `reference/examples.md` for the paragraph and the
basket it produced, both quoted from the record.

The lesson generalises. **The core floor acts as an editor.** A thesis that
cannot survive it usually has not decided what it thinks. When a draft is
struggling, the question is almost never "which assets" and almost always "what
is this actually about".

One caveat on the evidence: Arkiv persists successful underwritings only, so the
two rejected attempts have no fixture. The 4000 bps outcome is recorded in the
project's history rather than in the archive.

## What makes a falsifier possible

You do not write the falsifier. But the underwriter can only attach one to a
claim that admits it, so this is the property your prose has to have.

A claim a falsifier can attach to names a mechanism and a direction, and implies
something someone could go and check:

> Small caps benefit as rates fall, because they carry more floating-rate debt
> than large caps and refinance sooner.

That can be broken. Rates fall, small caps lag anyway, the claim was wrong.

A claim a falsifier cannot attach to names a mood:

> Small caps look interesting here.

Interesting to whom, measured how, wrong under what circumstance? Nothing about
the future could contradict it, so nothing about it is worth recording.

The test to apply to any draft: **what would have to be observed, within a year,
for the author to admit they were wrong?** If you cannot answer that from the
paragraph alone, the paragraph is not finished.

## What to avoid

- **Price targets.** "NVDA reaches $250" is a bet, not a thesis. The mechanism
  is what gets recorded, not the number.
- **Timing predictions.** "By Q3" adds precision the author cannot support and
  the horizon is the underwriter's to set.
- **Sentiment claims.** "Sentiment is bearish", "the market is euphoric".
  Unfalsifiable and not about companies.
- **Unfalsifiable framing.** Anything hedged to the point that no observation
  could contradict it. "May outperform in certain conditions" says nothing.
- **A ticker list with a sentence attached.** If the paragraph is mostly names,
  the author has skipped the argument and gone straight to the position. That
  is the thing Arkiv exists to prevent.
- **Sectors with no coverage.** The usable universe is ten US large-cap
  technology names plus four broad anchors. There is no utilities, industrials,
  energy, defence or consumer staples anywhere, and financials and healthcare
  exist only among the excluded assets, so they are equally unbuyable. A thesis
  about the power grid or reshoring has nothing to express itself in. Check
  `reference/allowlist.md` and say so early rather than late.

## How to work with the user

1. **Ask what they believe and why.** Not what they want to buy. If they open
   with tickers, work backwards to the belief underneath them.
2. **Find the mechanism.** Push on "why does that follow?" until there is a
   chain of cause and effect rather than an assertion.
3. **Narrow it.** If the draft names several beneficiaries, ask which one the
   argument is most about. This is where the CAPEXPAY lesson applies, and it is
   usually the highest-value edit you can make.
4. **Check expressibility** against `reference/allowlist.md` before polishing.
   A beautifully argued thesis about defence contractors cannot be filed.
5. **Apply the falsifier test.** What observation would prove this wrong within
   a year? If the paragraph does not support an answer, it is not done.
6. **Hand back one paragraph.** Roughly 60 to 150 words. Plain English. No
   tickers, no percentages, no structure. Tell them to paste it into the write
   box at `/app`.

## Reference files

- `reference/allowlist.md`, the assets a thesis can be expressed in, with the
  constraint values. Generated from the app's own source of truth.
- `reference/examples.md`, three filed theses, quoting the author's paragraph
  and the basket the underwriter returned. Read these before drafting: they show
  the actual register, which is more useful than any rule above.
