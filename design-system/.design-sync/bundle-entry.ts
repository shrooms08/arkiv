/**
 * Bundle entry for design-sync.
 *
 * The package's own `index.ts` deliberately ships no CSS imports — the README
 * tells host apps to import the two stylesheets themselves, in this order.
 * The uploaded bundle has no host app to do that, so this entry states the
 * same order as imports: esbuild then emits both sheets into `_ds_bundle.css`,
 * which `styles.css` @imports. That closure is all a rendered design receives.
 *
 * Tokens must come first: arkiv.css resolves every declaration through a
 * custom property that tokens.css defines.
 */

import "../tokens/tokens.css";
import "../components/arkiv.css";

export * from "../index";
