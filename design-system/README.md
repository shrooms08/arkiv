# Arkiv design system

Tokens and React components for the thesis archive. Self-contained: nothing here
imports from the Next.js app, and the app is unchanged by this package.

```
design-system/
├── tokens/
│   ├── tokens.css        CSS custom properties — raw scale + semantic layer
│   └── tokens.ts         typed mirror of the same values
├── components/
│   ├── arkiv.css         all component styling, token references only
│   ├── Button.tsx        AllocationRibbon.tsx   Input.tsx
│   ├── Card.tsx          AssetRow.tsx           Textarea.tsx
│   ├── Badge.tsx         WeightNumeral.tsx      Nav.tsx
│   ├── SerialNumber.tsx  FalsifierBlock.tsx     Footer.tsx
│   └── RoleLabel.tsx     BasketCard.tsx         Accordion.tsx
├── fixtures/demo.ts      realistic props from test/fixtures/underwriting/
├── index.ts
├── package.json
└── tsconfig.json
```

Import order matters — the component sheet resolves every value through the
token sheet:

```tsx
import "@arkiv/design-system/tokens/tokens.css";
import "@arkiv/design-system/components/arkiv.css";
import { BasketCard, AllocationRibbon } from "@arkiv/design-system";
```

Every component exports a `*Demo` alongside it, built from the three real
underwriter fixtures. The demos use full-length summaries and rationales
deliberately: a demo built on three-word labels hides truncation and wrapping,
which is exactly where component layouts fail.

---

## What was extracted, and how

Sources fetched 2026-08-11. Layout numbers are **computed values from a real
browser at a stated viewport**, not read off a stylesheet.

| Ref | Source |
| --- | --- |
| **L** | `https://cesto.co/` rendered at 1440×1000 |
| **A** | `https://app.cesto.co/` rendered at 1440×1200, and at 390/768/1024/1280 |
| **P** | `https://app.cesto.co/product/solana-alt-szn` rendered at 1440×1400 |
| **C** | the four CSS bundles behind those pages (302,537 bytes total) |

One correction to the brief: the landing page serves CSS from
`/_next/static/chunks/`, not `/_next/static/css/`. The app *does* use
`/_next/static/css/`. Both were found by reading `<link rel="stylesheet">` from
the HTML rather than assuming a path.

### Spacing

Base unit **4px** (`--spacing: .25rem`, C). Every spacing utility is
`calc(var(--spacing) * N)`.

Padding and gap declarations ranked by frequency across the bundles (C):

| Value | ×4px | Count |
| --- | --- | --- |
| `*3`, `*4`, `*8` | 12, 16, 32px | 17 each |
| `*2` | 8px | 16 |
| `*6` | 24px | 12 |
| `*1.5` | 6px | 11 |
| `*10`, `*16` | 40, 64px | 9 each |

Section padding, computed (L): `24 / 64 / 300 / 112 / 0 / 80 / 96 / 112px` top,
`0 / 0 / 0 / 112 / 384 / 160 / 96 / 112px` bottom. The recurring desktop pair is
**112px**; the mobile base value in CSS is **64px** (`pt-16`).

Fractional steps (`*.5`, `*1.5`, `*2.5`, `*6.75`) are in use, so the scale is not
strictly integer multiples.

**Off-grid values**, worth naming because they break the 4px rhythm at the
largest gaps: `padding-top: 18.75rem` (300px), `gap: 12.5rem` (200px),
`gap: 10rem` (160px), `gap: 7.5rem` (120px). These are round *pixel* numbers
chosen against a 4px grid that would prefer 288 or 304.

### Containers and grid

Measured across five viewports (A):

| Viewport | Content width | Gutter | Columns | Gap | Card |
| --- | --- | --- | --- | --- | --- |
| 390px | UNDETERMINED — cards did not render before timeout | 16px | UNDETERMINED | — | — |
| 768px | 768px | 24px | 2 | 20px | 350×440 |
| 1024px | 1024px | 32px | 2 | 24px | 468×440 |
| 1280px | 1280px | 32px | 3 | 24px | 389×440 |
| 1440px | 1280px (capped), 1216px inner | 32px | 3 | 24px | 389×440 |

Two findings worth carrying over. The third column arrives at **1280px, not
1024** — the reference stays 2-up through the lg breakpoint. And **card height is
a constant 440px at every width**; only the width flexes.

Marketing container measured 1152px (L); prose container 672px (both L and A).

Breakpoints in `@media` (C): `40 / 48 / 64 / 80 / 96rem` = 640 / 768 / 1024 /
1280 / 1536px. All `min-width`; no `max-width` queries anywhere.

### Type

Computed ramp (L and A). px is what the browser reported.

| px | Weight | Line height | Tracking | Case | Sample |
| --- | --- | --- | --- | --- | --- |
| 88 | 500 | 92.4px (1.05) | normal | — | page display |
| 88 | 400 | 114.4px (1.3) | normal | — | section display |
| 56 | 400 | 58.8px (1.05) | normal | — | section heading |
| 30 | 600 | 36px (1.2) | −0.75px | — | app h1 |
| 24 | 300 | 32px (1.33) | normal | — | lead paragraph |
| 20 | 600 | 28px (1.4) | normal | — | card heading |
| 18 | 700 | 28px (1.56) | normal | — | list heading |
| 18 | 400 | 28px | +1.8px | upper | section label |
| 16 | 400 | 24px (1.5) | normal | — | body |
| 16 | 500 | 24px | +1.6px | upper | button |
| 14 | 400/500 | 20px (1.43) | normal | — | small / nav |
| 12 | 500/600 | 16px (1.33) | +0.6–1.2px | upper | micro label |
| 10 | 600 | 10px | +0.5px | upper | badge |

Step ratios: 88/56 = 1.571, 56/30 = 1.867, 30/24 = 1.25, 24/20 = 1.20,
20/18 = 1.111, 18/16 = 1.125, 16/14 = 1.143, 14/12 = 1.167, 12/10 = 1.20. The
ramp is **not a constant ratio** — it is near-1.2 through the body range and
jumps sharply above 30px.

**Mono** appears in exactly one role: numeric data. Allocation percentages render
at 14px/700 with `font-variant-numeric: tabular-nums` (P). Arkiv keeps mono for
serials, addresses and the falsifier's observable, and uses tabular figures on
every number that sits in a column.

Faces: the reference loads four families. **Arkiv does not adopt them** — type
faces are brand identity. `tokens.css` ships system stacks plus a condensed
display stack for `WeightNumeral`, and the ramp geometry is what carries over.

### Radii and borders

Computed radius tally (A): `8px` ×24, `9999px` ×21, `4px` ×12, `10px` ×4,
`22px` ×4, `12px` ×3, `24px` ×1. Landing (L) adds `18px` ×34 and `26px` ×2.
Card radius is **12px** (A, P).

Border width is **1px everywhere** — it is the only width either site uses.
Border colours are near-black on the dark canvas (`rgb(22,29,27)` in the app,
`rgb(31,58,49)` ×68 on the landing), i.e. a *rule slightly lighter than the
surface*, not a contrasting outline.

### Elevation

**The landing page uses zero box-shadows** (L, measured across every element).
Depth is carried entirely by a 1px rule plus a background shift.

The app uses two, both stock Tailwind, and only on overlays (A):

```
0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -4px rgba(0,0,0,0.2)
0 25px 50px -12px rgba(0,0,0,0.5)
```

Arkiv follows this: `--elevation-flat: none` is the card default, and the two
measured shadows are reserved for overlay and modal.

### Motion

Transition durations and easings, ranked by element count (L):

| Duration / easing | Count |
| --- | --- |
| `0.15s cubic-bezier(0.4, 0, 0.2, 1)` | 209 |
| `0.3s cubic-bezier(0.4, 0, 0.2, 1)` | 43 |
| `0.5s cubic-bezier(0.4, 0, 0.2, 1)` | 38 |
| `0.2s cubic-bezier(0.4, 0, 0.2, 1)` | 1 |

**Only two easing curves exist in 302KB of CSS**: `cubic-bezier(.4,0,.2,1)` and
`cubic-bezier(0,0,.2,1)`. Neither is custom.

What animates: colour, opacity, transform on hover and focus. What does not:
layout, type size, card geometry. Long durations (40s, 50s, 78s, 86s, 200s in C)
belong to ambient marquee loops, not to interaction.

`prefers-reduced-motion: reduce` is honoured — `tokens.css` collapses every
duration to `0s` under that query.

---

## Density findings

This is the actionable part. The brief's diagnosis — that Arkiv reads as
unfinished because it is too airy — is right about the symptom and, as measured,
**wrong about the cause**.

I measured "ink" three ways: area covered by rendered text runs, area covered by
images and SVG, and area covered by painted UI objects (ribbon segments, chips,
icons, badges, filled buttons).

| | Reference card (A) | Arkiv before (live) | Arkiv DS now |
| --- | --- | --- | --- |
| Region | basket card 389×440 | `<main>` 960×762 | basket card 389×400 |
| **Text ink** | 14.9–16.5% | **24.0%** | 28.1% |
| **Non-text ink** | 58.7% | **0.0%** | 9.7% |
| **Total ink** | 73.6–75.2% | **24.0%** | 37.8% |
| Content width @1440 | 1216px | **960px** | 1216px |
| Row height | n/a — uses 216×158 cards | 63px | 58px |
| Card grid | 3 cols, 24px gap | none — single-column table | 3 cols, 24px gap |

Read the middle column carefully. Arkiv already put **more text per unit area**
than the reference card does (24.0% vs 16.5%). What it had was **zero non-text
ink** — no filled shapes, no icons, no charts, no coloured regions — against the
reference's 58.7%.

So the fix is not tighter leading or smaller padding. Tightening a page that is
already text-dense makes it cramped and still empty. The fix is **objects**:
things that occupy area by being shapes rather than by being sentences. That is
precisely what `AllocationRibbon`, `WeightNumeral`, the icon stack and the
`FalsifierBlock`'s three tinted parts are for, and it is why the components
carry the weight of this package rather than the token file.

Two other numbers matter:

- **Arkiv wastes 256px of width.** Its container measured 960px at a 1440
  viewport where the reference uses 1216px. That alone reads as a draft.
- **Arkiv's asset row was 63px tall carrying six columns of plain text.** The DS
  row is 58px carrying an icon, a two-line identity, a role label and a 30px
  display numeral — more object, less height.

Targets encoded in `tokens.css`: `--row-height: 3.5rem` (56px),
`--card-min-height: 25rem` (400px), `--grid-gap: 1.5rem` (24px),
`--container-content: 76rem` (1216px).

### A bug this measurement caught

The rendered `AssetRow` measured **81px** against a `min-height` token of 56px.
Cause: no box-model reset, so `min-height` applied to the *content* box and the
24px of padding was added on top. Every component with both a token size and
padding was silently rendering larger than its token said. `arkiv.css` now ships
a `border-box` reset scoped to the system's own classes, and the row measures
58px (56px + 1px border top and bottom). Without rendering the components this
would have shipped.

---

## The four deliberate divergences

**1. The card metric slot carries the primary expression and the falsifier
horizon, never a return.**

The reference puts a return there — measured on the product page as a 107px
panel reading *"3 Month Return +132.08%"* (P). Arkiv's differentiator is a claim
that can be checked and found wrong. A return in that slot makes the falsifier
decorative: it tells the reader the scoreboard is the point, and the archive
becomes a leaderboard where the loudest number wins. `BasketCard` has no prop
that accepts a return.

**2. Weight percentages are display type, not table data.**

The reference sets its allocation percentages at **14px, weight 700,
tabular-nums** (P) — unambiguously table data. `WeightNumeral` sets them at
56/88/120px in a condensed face with tight tracking, and in `AssetRow` the
weight renders at 30px against a 14px ticker. The weight is the model's verdict
on how much of the thesis rests on one holding; it is the most consequential
number in the row, so it is the largest thing in the row.

**3. The allocation is one ribbon, not a stack of bars.**

A portfolio is one object. A stack of independent bars invites reading each leg
on its own, which is the opposite of what a basket is. `AllocationRibbon` is a
single continuous band segmented by weight, with the primary expression rendered
gold and 12px taller so it breaks the band's top edge and is findable without
reading a label. Passing `compareSegments` stacks a second aligned row, so drift
between declared and current is a **shape difference** — legible without
subtracting two numbers.

**4. Every thesis carries a serial number.**

`ARKIV-0001`, from the on-chain basket index. The product is a permanent record
and a record has a number — it is what lets a claim be cited a year later when
the horizon has passed. `SerialNumber` is mono and small on purpose: it is a
citation, not a headline.

---

## Colour

Semantic tokens over raw values, so components reference meaning:

```
--color-structure   blue #1D3FBF   oklch(0.4376 0.2028 265.92)
--color-verdict     gold #E8B75A   oklch(0.8058 0.1241 81.41)
--color-ink         near-black #14161A
--color-surface / --color-canvas   off-white #F5F4F0, bone #EFEDE6
--color-rule        near-black at 14% alpha
```

Every OKLCH value was converted from the stated hex, not eyeballed.

One colour, one meaning, enforced by naming: **structure is blue** — primary
actions, links, nav chrome, focus rings. **Verdict is gold** — the primary
expression segment and row, the falsifier block, breach states. There is no
gold "accent" usage and no blue "success" usage. `Button` has a `verdict`
variant, and it is documented as rare rather than as a third rank.

Dark mode lifts blue to `oklch(0.62 0.178 265.92)`, holding hue and chroma. At
L=0.4376 the brand blue does not read on near-black; keeping the hue keeps it
the same colour.

No reference brand colour, logo, wordmark, illustration, icon or copy is
reproduced anywhere in this package.

---

## UNDETERMINED

Values I could not measure, recorded rather than invented:

- **Mobile (390px) card size, grid columns and content width.** The app renders
  nothing measurable at that width before the load timeout — cards returned 0×0.
  Only the 16px gutter resolved. The DS uses a single column below 768px as a
  reasonable default, but it is **not** a measured value.
- **`web-h3` (42px).** The brand kit documents it; no `42px` or `2.625rem`
  font-size appears in any bundle. `--text-display-m` carries the documented
  value, flagged in `tokens.css`.
- **Reference asset-row height.** There is none to measure — holdings render as
  216×158 cards in a 3-column grid (P), not as rows. Arkiv's 56px row target is
  derived from its own content, not carried over.
- **Reference focus-ring treatment.** No `:focus-visible` rule was observed in
  the bundles. Arkiv's 2px ring at 2px offset is its own decision.

---

## Verification

- `npm run typecheck` — TypeScript strict, `noUnusedLocals`,
  `noUnusedParameters`. Exit 0.
- All 15 components bundled with esbuild and rendered in headless Chromium at
  1440×1200: **15/15 demos rendered, zero page errors, zero console errors.**
- Post-render assertions: card 389×400 with 12px radius, 1px border and
  `box-shadow: none`; ribbon primary segment 56px against 44px for plain
  segments; primary segment `oklch(0.8058 0.1241 81.41)` (verdict gold) against
  `oklch(0.3776 0.2028 265.92)` (structure blue); asset row 58px.
