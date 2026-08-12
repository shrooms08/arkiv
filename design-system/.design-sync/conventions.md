# Building with Arkiv

Arkiv is the design system for a **thesis archive**: investment theses filed with a
claim that can be checked and found wrong. That subject matter drives the visual
rules below — they are not decoration.

## Setup: the `.ark` root class is required

There is no provider and no theme object. Styling comes from two stylesheets plus one
root class. **Wrap every screen — and every isolated component you render — in an
element carrying `className="ark"`.** `.ark` sets `font-family: var(--font-sans)` and
`color: var(--color-ink)`; without it your content falls back to browser-default
Times-ish type on black, which is the single most common way an Arkiv screen comes out
looking wrong.

```jsx
<div className="ark">
  <Nav brand="Arkiv" links={[{ href: "/archive", label: "Archive" }]} />
  <main className="ark-container ark-section">…</main>
</div>
```

`Nav`, `Footer` and `Accordion` emit `.ark` on their own roots, so they survive without
the wrapper — everything else does not. Nesting `.ark` is harmless.

## Styling idiom: tokens and a small layout vocabulary. Never literals.

The system's own rule is **no literal values** — every declaration resolves through a
custom property. Hold yourself to it: write `gap: var(--space-4)`, never `gap: 16px`.

**Layout classes you may use directly** (these are the only ones):

| Class | What it does |
|---|---|
| `ark` | root: base font + ink colour. Required. |
| `ark-stack` | column flex, `gap: var(--space-4)` |
| `ark-container` | centred, `max-width: var(--container-max)`, responsive gutter |
| `ark-section` | vertical section rhythm (`--section-y-mobile` → `--section-y`) |
| `ark-cardgrid` | the responsive card grid for `BasketCard` lists |

**Every other `ark-*` class is component-internal** (`ark-btn__spinner`,
`ark-falsifier__part--breach`, `ark-basketcard__metric`…). Do not write them and do not
invent new ones — style your own glue with inline `style` using tokens instead.

**Token families**, all defined in the token sheet:

- spacing `--space-0 … --space-40` (4px base), `--section-y`, `--section-gutter`
- containers `--container-prose | --container-content | --container-marketing | --container-max`
- type `--text-nano | --text-micro | --text-small | --text-body | --text-h4 … --text-h1 | --text-display-m | --text-display-l | --text-display-xl`
- fonts `--font-sans | --font-mono | --font-display`; weights `--weight-regular | -medium | -semibold | -bold`; `--leading-*`, `--tracking-*`
- surfaces `--color-canvas | --color-surface | --color-surface-raised | --color-surface-sunken`
- ink `--color-ink | --color-ink-muted | --color-ink-subtle | --color-ink-inverse`
- rules `--color-rule | --color-rule-strong`; radii `--radius-xs … --radius-2xl | --radius-full`
- **structure** (blue, the neutral interactive colour): `--color-structure`, `-hover`, `-active`, `-subtle`, `-border`, `-foreground`
- **verdict** (gold): `--color-verdict`, `-active`, `-hover`, `-subtle`, `-border`, `-foreground`; plus `--color-breach`, `--color-breach-surface`, `--color-resolved`

### Gold means "a claim that can be checked"

`verdict` is the system's one loaded colour. Use it for the falsifier, the breach
condition, and the primary expression — never as a third emphasis rank above
`secondary`. A screen with gold scattered across it has lost the distinction the whole
archive is built on. Blue (`structure`) is the ordinary interactive colour.

Related: the metric slot on a `BasketCard` carries the primary expression and the
falsifier horizon — **never a return figure**. Putting performance where the claim
belongs turns the archive into a leaderboard.

## Two composition traps

- **`Card` is `display: flex; flex-direction: column`.** A lone child stretches to full
  card width, so a single `<Button>` renders as a full-bleed bar. Wrap controls:
  `<div style={{ display: "flex", gap: "var(--space-3)" }}>`.
- **`CardHeader` / `CardBody` / `CardFooter` apply their own padding.** When you use the
  slots, leave `Card` at its default `padded={false}`; passing `padded` double-insets.

`className` on a component is an **escape hatch for layout only** — margins, widths,
grid placement. Never pass visual values through it; that is what the variant props and
tokens are for.

## Where the truth is

Read these before styling anything — they beat this summary:

- `_ds/<folder>/styles.css` and its `@import` closure — the real token sheet, the
  component stylesheet, and the `@font-face` rules for the display face.
- `components/general/<Name>/<Name>.prompt.md` — per-component API plus the DS author's
  own rationale for each component.
- `components/general/<Name>/<Name>.d.ts` — the prop contract.

## An idiomatic screen

```jsx
<div className="ark">
  <Nav brand="Arkiv" links={links} />
  <main className="ark-container ark-section ark-stack" style={{ gap: "var(--space-8)" }}>
    <header className="ark-stack" style={{ gap: "var(--space-2)" }}>
      <h1 style={{ fontSize: "var(--text-h1)", fontWeight: "var(--weight-semibold)" }}>
        Archive
      </h1>
      <p style={{ color: "var(--color-ink-muted)", maxWidth: "var(--container-prose)" }}>
        Every thesis filed with a falsifier, and what happened to it.
      </p>
    </header>

    <div className="ark-cardgrid">
      {theses.map((t) => (
        <BasketCard
          key={t.ticker}
          index={t.index}
          name={t.title}
          ticker={t.ticker}
          thesis={t.summary}
          symbols={t.symbols}
          primaryExpression={t.primaryExpression}
          horizon={t.horizon}
          confidence={t.confidence}
          segments={t.segments}
        />
      ))}
    </div>
  </main>
  <Footer note="An archive of investment theses." />
</div>
```

Library components carry the design; `ark-stack` / `ark-container` / `ark-cardgrid` plus
token-valued inline styles carry your own layout. That split is the whole convention.
