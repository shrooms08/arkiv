/**
 * Cover art paths and alt text, by ticker.
 *
 * Paths only. The PNGs are committed under `public/covers/` and the WebP files
 * are generated from them at build time by `scripts/build-covers.mjs`, wired as
 * `prebuild`. Nothing here reads image bytes.
 *
 * The descriptions below were written from the images themselves. Alt text
 * describes the picture, not the thesis: a screen reader hearing the basket
 * title twice learns nothing, and the title is already adjacent in the markup.
 */
export interface CoverArt {
  png: string;
  webp: string;
  webp720: string;
  alt: string;
  /** False when no file is committed, so callers fall back to ProceduralCover. */
  exists: boolean;
}

/**
 * Tickers with committed art, and what each image actually shows.
 *
 * Listed rather than probed: these render on the server, where a missing file
 * must degrade to the procedural cover rather than to a broken image element.
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

const FALLBACK_ALT = "Basket cover";

export function coverFor(ticker: string): CoverArt {
  const key = ticker.toUpperCase();
  const description = ART[key];
  return {
    png: `/covers/${key}.png`,
    webp: `/covers/${key}.webp`,
    webp720: `/covers/${key}@720.webp`,
    alt: description ?? FALLBACK_ALT,
    exists: Boolean(description),
  };
}

/** True when this ticker has committed art. */
export function hasCover(ticker: string): boolean {
  return Boolean(ART[ticker.toUpperCase()]);
}
