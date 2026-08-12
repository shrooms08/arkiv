/**
 * Cover art resolution, in one place.
 *
 * Paths only. The PNGs are committed under `public/covers/` and the WebP files
 * are generated from them at build time by `scripts/build-covers.mjs`, wired as
 * `prebuild`. Nothing here reads image bytes.
 *
 * The descriptions below were written from the images themselves. Alt text
 * describes the picture, not the thesis: a screen reader hearing the basket
 * title twice learns nothing, and the title is already adjacent in the markup.
 */

/**
 * Tickers with committed art, and what each image actually shows.
 *
 * These six are hand-generated art for the six seed baskets and nothing else.
 * There is no art pipeline behind user submissions, so a thesis someone files
 * today has no photograph and never will. That is not a gap to fill later, it
 * is the normal case, and `ProceduralCover` is what serves it.
 *
 * Listed rather than probed because these render on the server, where a missing
 * file must degrade to the procedural cover rather than to a broken image.
 */
const ART: Record<string, string> = {
  AIBOTTLE:
    "Illustration of a wide purple river narrowing to a thin stream as it forces through a gap in a canyon wall, with small figures watching from the floor below",
  STICKYINF:
    "A vast concrete block suspended on a cable above an orange pool in a dug-out basin, one figure standing at the water's edge, a city skyline on the horizon",
  SCRATE:
    "An enormous industrial press hanging in the sky above a flat plain, shedding a stream of rubble onto the ground while a single figure watches",
  ATTENTION:
    "An empty concrete auditorium of grey seats with a handful of scattered occupants rendered as glitching, pixelated figures",
  EDGEAI:
    "A small lantern glowing in a dark field, casting a long beam of light toward a windowless concrete warehouse, with one figure standing between them",
  CAPEXPAY:
    "The bare steel frame of an unfinished warehouse, with a single wooden door standing free in the middle of the floor and a worker holding its handle",
};

export interface PhotoCover {
  kind: "photo";
  png: string;
  webp: string;
  webp720: string;
  alt: string;
}

export interface ProceduralCoverChoice {
  kind: "procedural";
}

export type ResolvedCover = PhotoCover | ProceduralCoverChoice;

/**
 * Which cover a record gets. The single decision point for every surface.
 *
 * The rule, and it has exactly one exception, which is that there is none:
 *
 *   1. A ticker with a committed file renders the photograph.
 *   2. Everything else renders ProceduralCover.
 *   3. Nothing ever renders a blank or reserved strip.
 *
 * Cards, the basket detail hero and the underwrite hero all call this rather
 * than each re-deriving it, because three copies of a rule is three places for
 * it to drift and the third copy is where a blank strip gets shipped.
 */
export function resolveCover(ticker: string): ResolvedCover {
  const key = ticker.toUpperCase();
  const alt = ART[key];
  if (!alt) return { kind: "procedural" };
  return {
    kind: "photo",
    png: `/covers/${key}.png`,
    webp: `/covers/${key}.webp`,
    webp720: `/covers/${key}@720.webp`,
    alt,
  };
}

/** True when this ticker has committed art. */
export function hasCover(ticker: string): boolean {
  return Boolean(ART[ticker.toUpperCase()]);
}
