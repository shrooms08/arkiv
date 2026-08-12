# design-sync notes — @arkiv/design-system

Repo-specific gotchas for future syncs. Read this before re-running the sync.

## Build shape

- **Shape is `package`** — there is no Storybook and no `*.stories.*` anywhere in the
  arkiv repo. Detection is pinned via `"shape": "package"` so it never re-scans.
- **The package has no `node_modules` of its own.** `react`, `react-dom`, `typescript`
  and `@types/react` all resolve from the arkiv repo root. Always pass
  `--node-modules ../node_modules`; pointing it at `design-system/node_modules`
  will fail because that directory does not exist.
- **`npm run build` does not work from inside `design-system/`** — the `tsc` binary
  is not on the package's path. Use `../node_modules/.bin/tsc -p tsconfig.json`
  (recorded as `cfg.buildCmd`).
- **The build is `emitDeclarationOnly`.** `dist/` contains only `.d.ts` files — there
  is no JS entry to point `--entry` at. The converter bundles the TypeScript source
  directly instead, via `.design-sync/bundle-entry.ts`.

## `.design-sync/bundle-entry.ts` — why it exists (do not delete)

The package's own `index.ts` deliberately ships **no CSS imports**: the README tells
host apps to import `tokens/tokens.css` then `components/arkiv.css` themselves. An
uploaded design system has no host app to do that, and the two config paths that
would normally cover it both fail here:

- `cfg.tokensGlob` only applies **inside a `cfg.tokensPkg`** (`copyTokens` returns
  early when `tokensPkg` is unset). Arkiv keeps its tokens in the *same* package, not
  a sibling one, so `tokensGlob` alone silently does nothing — `ds-bundle/tokens/`
  comes out empty and every `var(--color-*)` in the component sheet is undefined.
- `cfg.cssEntry` is **appended verbatim** into `_ds_bundle.css`, so an `@import` line
  written there would not resolve after the copy.

The fix is a bundle entry that imports both stylesheets in the documented order and
re-exports `index.ts`. esbuild then emits both sheets into `_ds_bundle.css`, which
`styles.css` `@import`s — and that closure is all a rendered design receives.
`cfg.cssEntry` is deliberately **unset**; setting it would append `arkiv.css` a
second time.

**If you see unstyled previews, check this first:** `grep -c -- "--space-1:" ds-bundle/_ds_bundle.css`
must be ≥1. If it is 0, the token layer did not ship.

## Fonts

- Saira Condensed (weights 500 and 600, SIL OFL) is vendored at `fonts/` and wired via
  `cfg.extraFonts`. It leads `--font-display`, ahead of the pre-existing Archivo
  Narrow / Roboto Condensed fallbacks. Chosen by the repo owner on 2026-08-11;
  before that the package named a display face it did not ship, so every headline
  and weight numeral rendered in a system fallback.
- Weight 500 is the one `.ark-weight` actually asks for (`--weight-medium`) at
  56/88/120px; 600 covers heavier display headings.
- Subsets shipped: latin, latin-ext, vietnamese — as published by Google Fonts.
- `fonts/OFL.txt` is the license and must ship with the woff2 files.

## Known render warns (triaged — a warn NOT in this list is new, look at it)

- `[FONT_MISSING] "Archivo Narrow", "Roboto Condensed", "Liberation Sans Narrow"` —
  **expected and correct.** These are the *fallback* families in `--font-display`,
  deliberately not vendored. The face that actually renders, Saira Condensed, ships.
  Do not "fix" this by vendoring the fallbacks.

## Authoring previews for this DS — conventions that held up

- **Every preview export wraps its content in `<div className="ark">`.** `.ark` sets
  `font-family: var(--font-sans)` and `color: var(--color-ink)`; without it a cell
  falls back to browser-default type. `Nav`, `Footer` and `Accordion` emit `.ark` on
  their own roots, so the wrapper is redundant for those three — applied uniformly
  anyway, since it also styles anything composed around them.
- **`Card` is `display: flex; flex-direction: column`.** A lone child stretches to
  full card width — a single `Button` renders as a full-bleed bar. Wrap controls in
  `<div style={{display:"flex", gap:"var(--space-3)"}}>`. This was the only authoring
  fix needed across all three waves.
- **The Card slots carry their own padding.** `CardHeader/CardBody/CardFooter` each
  apply `var(--card-padding)`, so a slotted card must stay `padded={false}` (the
  default). `padded` + slots double-insets. `CardDemo` only demonstrates the `padded`
  path, so the slot path had no canonical reference before these previews.
- **`CardHeader` is `align-items: flex-start`.** With a `WeightNumeral` (56–120px) in
  the end slot the header grows to the numeral and the title sits at the top of that
  box. Correct behaviour that reads as a large gap in a sheet — do not "fix" it.
- `ark-stack` / `ark-cardgrid` plus inline `style` with `var(--space-*)` covered every
  layout need. Where two variants render identically by design, put a mono
  `--text-nano` props caption beside each in a two-column grid — it turns an apparent
  duplicate into a readable statement.
- **`Textarea showCount` requires `maxLength`** or the counter silently renders
  nothing. **`Input`'s `error` replaces the `hint` slot** rather than stacking.

## The anchor's blind spot — read this before any re-sync after a styling change

**The verification diff is driven by per-component *source* hashes, not by appearance.**
Component render hashes cover the preview `.tsx` and preview-affecting config; the
stylesheet lives in `styleSha`. So a change that repaints the entire system — a
palette swap, a token rename, a global CSS edit — leaves most components marked
`unchanged` and they skip verification entirely, even though every one of them now
*looks* different.

This bit on the 2026-08-12 repalette sync: 7 of 18 components came back `unchanged`
purely because their preview files had not been edited, and `RoleLabel` was among
them — despite its accent logic having changed in that very commit. Its carried-forward
grade still asserted that two of its variants render identically, which was no longer
true.

**The rule: after any global styling change, force-verify the skipped set.**
```sh
node .ds-sync/package-capture.mjs --out ./ds-bundle \
  --components <the unchanged list> --spot-check-components <the same list>
```
Then Read every fresh sheet and re-grade. Carried-forward grades are trustworthy for
source-scoped changes; they are not trustworthy when the paint changed underneath them.

## Card presentation — and the review sheet's blind spot

`cfg.overrides` carries `cardMode: "column"` for **BasketCard, Card, CardHeader, Nav
and RoleLabel**. Do not remove these without re-checking.

**The lesson worth carrying forward:** the per-component review sheet
(`_screenshots/review/*.png`, what `package-capture.mjs` produces and what grading reads)
gives each story a wide content column — roughly 630–900px. The **product's** card grid
is much narrower. So a story can grade `good` on the review sheet and still be cropped
in the DS pane. Three separate authoring passes concluded "no `cardMode` needed" from
the review sheets; `package-validate.mjs`'s `[GRID_OVERFLOW]` check then flagged five
components. **Trust `[GRID_OVERFLOW]` over the review sheet for width questions** — it
is the only signal that models the real grid cell. Grades are unaffected by the
override, so the fix is a targeted `preview-rebuild.mjs --components …` and no regrade.

`Footer`, `AllocationRibbon` and `AssetRow` were checked and genuinely do fit.

## Design-system findings (reported, not fixed — these belong to the DS authors)

- ~~`AssetRow`'s wrapper address breaks across two lines under width pressure.~~
  **FIXED 2026-08-12 in `components/arkiv.css`.** `.ark-assetrow__meta` is a flex row of
  `__name` (which has `text-overflow: ellipsis`) and `__addr` (which had neither
  `white-space: nowrap` nor `flex: none`), so the truncated mono address split —
  `0xF62a…` / `6958` — reading as corrupted data and pushing the row past its measured
  height. `.ark-assetrow__addr` now carries `white-space: nowrap; flex: none;`, so the
  name absorbs the squeeze instead. Verified from a fresh capture: every address renders
  on one line and rows are single-height again. **This is a real source change made
  during a sync** — if `arkiv.css` is ever regenerated or reverted from another branch,
  check this rule survived.
- ~~Gold is described as rare, but two paths spend it freely.~~ **FIXED 2026-08-12
  in the black/bone/purple repalette.** `RoleLabel` gave the accent to every
  `satellite`, so a six-holding basket showed five accented labels; it is now
  `isPrimaryExpression` only. `BadgeDemo` tagged `Primary expression` as `verdict`
  though a holding is not a checkable claim; it is now `structure`. Verified from
  computed colour: accented role labels went 3/6 → 2/6 and verdict badges 2 → 1.
- ~~`AllocationRibbon` drops the accent from the primary expression in even positions.~~
  **FIXED 2026-08-12 in `components/arkiv.css`.** `.ark-ribbon__seg:nth-child(even)`
  (specificity 0,2,0) outranked `.ark-ribbon__seg--primary` (0,1,0), so the alternating
  ink tint repainted the accent whenever the primary expression landed in an even
  position — the segment kept its 56px height and top-edge break but lost its colour.
  It failed for roughly half of all baskets and was equally broken under the old gold
  palette, so it long predates the repalette; it was simply never noticed because no
  preview happened to exercise an even-position primary until `BasketCard/ArchiveGrid`
  (AIBOTTLE, NVDAx at position 2). Fixed by scoping the tint with
  `:not(.ark-ribbon__seg--primary)` rather than escalating specificity — the tint
  exists to separate adjacent *ink* segments and the primary is never one. Verified by
  rendering a primary segment at both parities: both now resolve `#7141EE`.
  **Watch for the general shape of this bug:** any `:nth-child`/`:hover` rule in this
  stylesheet outranks a plain modifier class, so a state modifier can be silently
  overridden without any build or render check failing.
- **The Badge preview and `BadgeDemo` are separate files and drift apart.** The
  accent-leak fix in `components/Badge.tsx` did not touch
  `.design-sync/previews/Badge.tsx`, which independently tagged "Primary expression"
  as `verdict` and rendered a cell named `VerdictIsRare` containing four purple badges.
  Fixed in the same sync. When a component's demo is corrected, check its preview too —
  the preview is what ships as the card and what the design agent learns from.
- **A third accent leak is still open, and it is a design decision, not a bug.**
  Form validation errors use `--color-breach` — `.ark-field__hint--error` and the
  `[aria-invalid="true"]` border on `Input`/`Textarea`. Under the one-accent palette
  that paints form errors in verdict purple, which is not one of the four verdict
  cases. It was equally off-rule when the accent was gold; the repalette only made
  it conspicuous. The palette has no error colour, so the options are: paint errors
  in `--color-ink` and let the border plus the message carry it; accept errors as a
  fifth verdict case; or add a dedicated danger colour and stop being a three-colour
  system. Left as-is pending the DS owner's call.
- **`Input` has no read-only treatment.** `readOnly` passes through to the `<input>`
  and renders at full ink, identical to an editable filled field; only `disabled` gets
  the 0.5-opacity treatment. There is currently no way to show an inert chain-derived
  value short of disabling it.
- **`AllocationRibbon`'s `labelThresholdBps` (default 800) is unreachable on the
  shipped fixtures** — the smallest fixture leg is 1000bps, so the hide-label-until-hover
  path never fires. The `SixLegsWithDrift` preview raises the threshold to 2000 to
  exercise it. A sub-800bps fixture leg would make the default path demonstrable.
- **`SerialNumber`'s `emphasis` is a single ink step** (`--color-ink-subtle` →
  `--color-ink-muted`) and is indistinguishable in isolation. If it is meant to mark
  "the record you are reading", the delta is probably too small to carry that alone.
- **The stated "four verdict cases" is narrower than what the stylesheet implements.**
  The rule names the `AllocationRibbon` primary segment, `FalsifierBlock`, breach state
  and the thesis-expression `RoleLabel`. But three more component-level modifiers also
  paint the accent, all marking the primary expression: `.ark-weight--verdict` (the
  `WeightNumeral verdict` prop), `.ark-assetrow__weight--verdict`, and
  `.ark-basketcard__metric-value--verdict`. These are the DS's own CSS, not preview
  authoring choices. In `CardHeader/WeightInHeader` the effect is inverted relative to
  the rule — the large numeral is purple while the sanctioned `RoleLabel` beside it is
  muted ink. Either the rule should read "the primary expression, wherever it is marked"
  or these modifiers should drop to ink. Needs the DS owner's call; not changed.
- **Footer chrome is deliberately soft, not drifted.** `.ark-footer` fills with
  `--color-surface-sunken` and its links use `--color-ink-muted` (~#5B5E63) — both real
  tokens, no literals. It reads softer than the conventions header's "chrome is
  near-black" phrasing implies, at ~5.7:1. Flagged so a future reader does not mistake
  it for a leak.
- ~~`RoleLabel` renders `satellite` and `core + isPrimaryExpression` identically.~~
  **Resolved 2026-08-12 as a side effect of the accent fix above.** A plain
  `satellite` and the primary expression still share the words "Thesis expression",
  but only the primary expression now carries purple, so the two are visually
  distinct. The `EveryRole` preview's mono props caption is still worth keeping.

- `FalsifierBlock`'s JSDoc says a resolved block "drops the purple entirely", but
  `.ark-falsifier--resolved` in `components/arkiv.css` only neutralises the border,
  card background, header background and title colour plus the horizon fill. The
  **breach-condition panel keeps its gold surface and gold text** in the resolved
  state. The previews render this faithfully; if the intent is what the JSDoc says,
  the stylesheet needs a `--resolved` rule for `.ark-falsifier__part--breach`.
- `--font-display-stretch: 87.5%` was written for *synthetic* condensing of a normal
  -width fallback. Now that a genuinely condensed face leads the stack, the token is
  redundant for the primary face (Saira Condensed has no width axis, so the value is
  ignored rather than double-applied). Harmless today; worth a deliberate decision
  if the display stack is ever revisited.

## Grouping

All 18 components land in a single `general` group. Group names come from
`category:` frontmatter in a per-component doc, and this package ships no per-component
docs — so introducing groups means adding `.md` files, which would **replace** the
synthesized `.prompt.md` (props table + JSDoc + preview examples) with whatever those
files contain. At 18 components a flat list is browsable, and the synthesized prompt
is worth more to the design agent than a category label. If the component count grows,
write real per-component docs (with `category:` frontmatter) rather than empty stubs.

## Re-sync risks — what can silently go stale

- **`.design-sync/bundle-entry.ts` duplicates the README's import order.** If the
  package ever changes which stylesheets a host app must import, or adds a third
  sheet, this file must be updated to match or the new sheet will not reach designs.
- **`componentSrcMap` excludes 15 `*Demo` exports by name.** Every component in this
  package ships a matching `<Name>Demo`. A *new* component will add a new `*Demo`
  export that is **not** in the exclusion list, and it will show up as a component in
  the design picker. Add the new `<Name>Demo: null` entry when components are added.
- **Previews import fixture data from the package** (`scrate`, `aibottle`, `stickyinf`,
  `segmentsFor`, `driftedSegmentsFor`) rather than inlining copies. That is deliberate
  and does not rot — but it does mean `fixtures/demo.ts` is a preview dependency, so
  removing an export from it will break preview compilation.
- **The display font was fetched from Google Fonts over the network** at sync time and
  vendored into the repo. It is now a committed repo asset — a future sync does not
  re-fetch it, and must not need network access for fonts.
- **Playwright/chromium was installed into `.ds-sync/node_modules`**, which is
  gitignored. A fresh clone re-installs it; budget ~200MB and a prompt.
- **`.design-sync/conventions.md` names ~57 tokens, 5 layout classes and 9 components
  explicitly.** All were verified against the compiled `_ds_bundle.css` and the built
  `components/general/*` tree at sync time. If a token is renamed or a layout helper
  removed, the header will confidently teach the design agent vocabulary that no longer
  resolves, and it will ship silently unstyled output. Re-run that verification on every
  sync — the conventions step does this automatically and reports drift.
- Hover, focus and drag states are not representable in static previews and are
  deliberately absent from every preview file. Enumerated so their absence is never
  mistaken for a gap: `Input`/`Textarea` hover and focus rings; **`Textarea --thesis:focus`**
  (the one bespoke treatment — an elevation-overlay shadow plus surface swap, so the
  field lifts off the page; its JSDoc sells this as the variant's whole point and no
  static sheet can show it); `Card.interactive` hover and focus-visible; `Accordion`
  open/close transitions and marker rotation (both end states are covered);
  `AllocationRibbon` segment hover-lift, narrow-segment label reveal and
  `onSegmentClick` focus ring; `AssetRow` row hover and the 1200ms "Copied" flash
  (the component deliberately swallows clipboard failures, so there is no error state
  either); `Nav`/`Footer` link hover and focus-visible.
- **`CardBody` with no `CardFooter` under it has no bottom padding.** Every preview
  here ends with a footer, so that case is deliberately unexercised — it needs its own
  cell if a future sync wants it covered.
