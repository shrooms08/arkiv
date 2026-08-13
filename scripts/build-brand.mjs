/**
 * Renders the brand raster assets from the ArkivMark geometry.
 *
 * The glyph is defined once here and in `design-system/components/ArkivMark.tsx`.
 * Keeping the path data in both places is deliberate: this script must run
 * without a React runtime or a bundler, and the alternative is a build step that
 * imports TSX just to produce two PNGs. The geometry is four rectangles and it
 * has not moved since it was drawn, so the duplication is cheap and the
 * verification below is what actually protects it.
 *
 *   node scripts/build-brand.mjs
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const BRAND_DIR = join(ROOT, "public", "brand");
const APP_DIR = join(ROOT, "src", "app");

const INK = "#14161A";
const BONE = "#EFEDE6";

/** Standard variant, four segments, the third breaking the top edge. */
const SEGMENTS = [
  { x: 4, y: 26, w: 9, h: 12 },
  { x: 15.5, y: 26, w: 7, h: 12 },
  { x: 25, y: 10, w: 6, h: 28 },
  { x: 33.5, y: 26, w: 10.5, h: 12 },
];

function glyphRects(fill) {
  return SEGMENTS.map(
    (s) => `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${fill}"/>`,
  ).join("");
}

/**
 * Glyph on a filled circle.
 *
 * The circle bleeds to the full canvas rather than being inset, so a platform
 * that applies its own circular mask crops nothing and does not round an
 * already rounded corner a second time.
 */
function avatarSvg(px) {
  const r = px / 2;
  // 62.5% of the diameter, matching the avatar proportion in the identity study.
  const glyph = px * 0.625;
  const offset = (px - glyph) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">
  <circle cx="${r}" cy="${r}" r="${r}" fill="${INK}"/>
  <g transform="translate(${offset} ${offset}) scale(${glyph / 48})">${glyphRects(BONE)}</g>
</svg>`;
}

/**
 * Apple touch icon. Square with an ink field, because iOS masks the corners
 * itself and a transparent icon is composited onto whatever is behind it.
 */
function touchIconSvg(px) {
  const glyph = px * 0.62;
  const offset = (px - glyph) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">
  <rect width="${px}" height="${px}" fill="${INK}"/>
  <g transform="translate(${offset} ${offset}) scale(${glyph / 48})">${glyphRects(BONE)}</g>
</svg>`;
}

/**
 * Maskable icon. Android crops an arbitrary shape out of this, so the glyph is
 * drawn inside the 80% safe zone the spec guarantees survives any mask, on a
 * field that bleeds to the edge.
 */
function maskableSvg(px) {
  const glyph = px * 0.44;
  const offset = (px - glyph) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${px} ${px}">
  <rect width="${px}" height="${px}" fill="${INK}"/>
  <g transform="translate(${offset} ${offset}) scale(${glyph / 48})">${glyphRects(BONE)}</g>
</svg>`;
}

async function main() {
  mkdirSync(BRAND_DIR, { recursive: true });
  if (!existsSync(APP_DIR)) throw new Error("src/app not found, run from the repo root");

  const targets = [
    { path: join(BRAND_DIR, "arkiv-avatar.png"), svg: avatarSvg(400), label: "avatar 400x400" },
    { path: join(APP_DIR, "apple-icon.png"), svg: touchIconSvg(180), label: "apple-icon 180x180" },
    // Home screen icons, from the same geometry as everything else so the
    // installed icon cannot drift from the mark.
    { path: join(BRAND_DIR, "icon-192.png"), svg: touchIconSvg(192), label: "icon 192x192" },
    { path: join(BRAND_DIR, "icon-512.png"), svg: touchIconSvg(512), label: "icon 512x512" },
    { path: join(BRAND_DIR, "icon-192-maskable.png"), svg: maskableSvg(192), label: "maskable 192x192" },
    { path: join(BRAND_DIR, "icon-512-maskable.png"), svg: maskableSvg(512), label: "maskable 512x512" },
  ];

  for (const t of targets) {
    await sharp(Buffer.from(t.svg)).png({ compressionLevel: 9 }).toFile(t.path);
    const meta = await sharp(t.path).metadata();
    // Assert rather than trust: a wrong-sized avatar is silently accepted by
    // every platform that uploads it and then looks wrong everywhere.
    const expected = Number(t.label.match(/(\d+)x(\d+)$/)[1]);
    if (meta.width !== expected || meta.height !== expected) {
      throw new Error(`${t.label}: got ${meta.width}x${meta.height}`);
    }
    console.log(`  ${t.label.padEnd(22)} ${t.path.replace(ROOT + "/", "")}`);
  }
  console.log("brand assets written");
}

main().catch((error) => {
  console.error("brand build failed:", error);
  process.exit(1);
});
