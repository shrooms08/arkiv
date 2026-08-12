/**
 * Converts committed cover PNGs to WebP at two widths.
 *
 * The PNGs are the source of truth and stay committed; this only ever writes
 * `.webp` beside them. Six full-resolution PNGs total roughly 14 MB and the
 * featured export is over 2400px wide, which is an LCP problem on a page whose
 * largest element is a cover image.
 *
 * Two widths, not a full responsive ladder: 1408 for the featured slot and 720
 * for a card in a three-up grid. Anything more is bytes nobody downloads.
 *
 * Idempotent. A cover is reconverted only when its PNG is newer than its WebP,
 * so a normal build does no work.
 *
 *   node scripts/build-covers.mjs
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const DIR = join(process.cwd(), "public", "covers");
const WIDTHS = [
  { suffix: "", width: 1408 },
  { suffix: "@720", width: 720 },
];
const QUALITY = 82;

async function main() {
  if (!existsSync(DIR)) {
    console.log("no public/covers directory, nothing to do");
    return;
  }

  const pngs = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".png"));
  if (pngs.length === 0) {
    console.log("no cover PNGs found");
    return;
  }

  let converted = 0;
  let skipped = 0;
  let pngBytes = 0;
  let webpBytes = 0;

  for (const file of pngs.sort()) {
    const src = join(DIR, file);
    const base = file.replace(/\.png$/i, "");
    const srcStat = statSync(src);
    pngBytes += srcStat.size;

    for (const { suffix, width } of WIDTHS) {
      const out = join(DIR, `${base}${suffix}.webp`);

      if (existsSync(out) && statSync(out).mtimeMs >= srcStat.mtimeMs) {
        webpBytes += statSync(out).size;
        skipped++;
        continue;
      }

      await sharp(src)
        // `withoutEnlargement` so a small source is never upscaled into a file
        // bigger than the original for no gain.
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(out);

      webpBytes += statSync(out).size;
      converted++;
    }
  }

  const mb = (n) => (n / 1024 / 1024).toFixed(2);
  console.log(
    `covers: ${converted} written, ${skipped} up to date  |  ` +
      `png ${mb(pngBytes)} MB -> webp ${mb(webpBytes)} MB`,
  );
}

main().catch((error) => {
  // A failed conversion must not silently ship the heavy PNGs as if nothing
  // happened, so this exits non-zero and fails the build.
  console.error("cover conversion failed:", error);
  process.exit(1);
});
