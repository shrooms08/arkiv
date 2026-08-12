/**
 * Typed mirror of `tokens.css`.
 *
 * Values are identical to the CSS custom properties, so anything consuming
 * these in TS lands on the same pixel as anything consuming the variables.
 * `cssVar()` returns the `var(--…)` reference, which is what components use —
 * the literals here exist for tooling, tests and documentation.
 */

export const space = {
  unit: "0.25rem",
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
  28: "7rem",
  40: "10rem",
} as const;

export const layout = {
  containerMax: "80rem",
  containerContent: "76rem",
  containerMarketing: "72rem",
  containerProse: "42rem",
  gridGap: space[6],
  gridGapTight: space[3],
  gridCols: 3,
  sectionY: space[28],
  sectionYMobile: space[16],
  sectionGutter: space[6],
} as const;

export const breakpoints = {
  sm: "40rem",
  md: "48rem",
  lg: "64rem",
  xl: "80rem",
  "2xl": "96rem",
} as const;

export const fonts = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  display:
    '"Saira Condensed", "Archivo Narrow", "Roboto Condensed", "Helvetica Neue Condensed", "Liberation Sans Narrow", ui-sans-serif, system-ui, sans-serif',
} as const;

/** px values are the measured reference sizes; rem is what ships. */
export const type = {
  displayXl: { rem: "5.5rem", px: 88, leading: 1.05 },
  displayL: { rem: "3.5rem", px: 56, leading: 1.05 },
  displayM: { rem: "2.625rem", px: 42, leading: 1.05 },
  h1: { rem: "1.875rem", px: 30, leading: 1.2 },
  h2: { rem: "1.5rem", px: 24, leading: 1.33 },
  h3: { rem: "1.25rem", px: 20, leading: 1.4 },
  h4: { rem: "1.125rem", px: 18, leading: 1.56 },
  body: { rem: "1rem", px: 16, leading: 1.5 },
  small: { rem: "0.875rem", px: 14, leading: 1.43 },
  micro: { rem: "0.75rem", px: 12, leading: 1.33 },
  nano: { rem: "0.625rem", px: 10, leading: 1.5 },
} as const;

export const weight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const tracking = {
  display: "-0.02em",
  normal: "0",
  label: "0.05em",
  caps: "0.1em",
} as const;

export const radius = {
  xs: "0.25rem",
  sm: "0.5rem",
  md: "0.625rem",
  lg: "0.75rem",
  xl: "1.125rem",
  "2xl": "1.5rem",
  full: "9999px",
} as const;

export const border = {
  width: "1px",
  widthEmphasis: "2px",
} as const;

export const elevation = {
  flat: "none",
  overlay:
    "0 10px 15px -3px oklch(0 0 0 / 0.2), 0 4px 6px -4px oklch(0 0 0 / 0.2)",
  modal: "0 25px 50px -12px oklch(0 0 0 / 0.5)",
} as const;

export const motion = {
  instant: "0.1s",
  fast: "0.15s",
  base: "0.2s",
  slow: "0.3s",
  slower: "0.5s",
  easeStandard: "cubic-bezier(0.4, 0, 0.2, 1)",
  easeOut: "cubic-bezier(0, 0, 0.2, 1)",
} as const;

export const density = {
  rowHeight: "3.5rem",
  rowHeightComfortable: "4rem",
  cardPadding: space[5],
  cardMinHeight: "25rem",
  iconSm: "1.25rem",
  iconMd: "1.5rem",
  iconLg: "2rem",
  ribbonHeight: "2.75rem",
  ribbonHeightPrimary: "3.5rem",
} as const;

/** Raw brand values in OKLCH, converted from the stated hex. */
export const palette = {
  purple500: { oklch: "oklch(0.5400 0.2404 288.29)", hex: "#7141EE" },
  purple600: { oklch: "oklch(0.4800 0.2100 288.29)", hex: "#6038CA" },
  purple700: { oklch: "oklch(0.4200 0.1800 288.29)", hex: "#4F2FA7" },
  nearBlack: { oklch: "oklch(0.1998 0.0086 264.36)", hex: "#14161A" },
  nearBlackLifted: { oklch: "oklch(0.2800 0.0086 264.36)", hex: "#27292D" },
  nearBlackDeep: { oklch: "oklch(0.1400 0.0086 264.36)", hex: "#07090D" },
  bone: { oklch: "oklch(0.9457 0.0096 93.57)", hex: "#EFEDE6" },
  offWhite: { oklch: "oklch(0.9668 0.0054 95.10)", hex: "#F5F4F0" },
} as const;

/**
 * Semantic tokens. Components reference these names, never `palette`.
 *
 * One colour, one meaning. Three colours, two jobs: **ink is structure**
 * (actions, links, chrome, borders — anything that is interface) and
 * **purple is verdict** (primary expression, falsifier, breach, thesis
 * expression — and nothing else). There is no third accent to reach for,
 * so purple stays rare enough that seeing it means something.
 */
export const semantic = [
  "color-ink",
  "color-ink-hover",
  "color-ink-active",
  "color-ink-muted",
  "color-ink-subtle",
  "color-ink-inverse",
  "color-ink-wash",
  "color-verdict",
  "color-verdict-hover",
  "color-verdict-active",
  "color-verdict-foreground",
  "color-verdict-subtle",
  "color-verdict-border",
  "color-canvas",
  "color-surface",
  "color-surface-raised",
  "color-surface-sunken",
  "color-rule",
  "color-rule-strong",
  "color-field",
  "color-field-border",
  "color-ring",
  "color-breach",
  "color-breach-surface",
  "color-resolved",
] as const;

export type SemanticToken = (typeof semantic)[number];

/** `cssVar("color-verdict")` -> `"var(--color-verdict)"`. */
export function cssVar(token: SemanticToken | string): string {
  return `var(--${token})`;
}

export const tokens = {
  space,
  layout,
  breakpoints,
  fonts,
  type,
  weight,
  tracking,
  radius,
  border,
  elevation,
  motion,
  density,
  palette,
  semantic,
} as const;

export default tokens;
