export type ArkivMarkVariant = "standard" | "small" | "auto";
export type ArkivMarkCrop = "grid" | "tight";

export interface ArkivMarkProps {
  /**
   * Rendered size in px. Used to pick the variant when `variant` is "auto",
   * and applied as the element's height. Omit to size from CSS instead, in
   * which case "auto" resolves to standard.
   */
  size?: number;
  variant?: ArkivMarkVariant;
  /**
   * "grid" keeps the full 48 unit design square, which is what icons, avatars
   * and anything needing its own padding should use. "tight" crops to the ink
   * so the element's height IS the glyph height, which is what a lockup needs
   * to set the glyph to cap height.
   */
  crop?: ArkivMarkCrop;
  /** Accessible name. Omit for decorative use beside a visible wordmark. */
  title?: string;
  className?: string;
}

/** Below this width the fine gaps fall under a pixel and the band goes solid. */
export const ARKIV_MARK_SMALL_BELOW = 24;

/**
 * The Arkiv mark: the allocation ribbon reduced to segments, with the primary
 * expression breaking the top edge.
 *
 * Two drawings, one silhouette. The standard glyph carries four segments with
 * 2.5 unit gaps. Below 24px those gaps fall below a device pixel and the band
 * reads as one solid mass, so the small variant drops to three segments with
 * wider gutters and a heavier riser. The outline, a bar with one riser, is
 * identical either way, so this is a refinement rather than a second mark.
 *
 * Ink only. It fills with `currentColor` so one drawing serves both polarities:
 * ink on bone in the header, bone on ink reversed. The mark never takes purple,
 * because purple marks the primary expression of a real thesis and an accent
 * that appears in chrome stops meaning anything in the records.
 */
export function ArkivMark({
  size,
  variant = "auto",
  crop = "grid",
  title,
  className = "",
}: ArkivMarkProps) {
  // The threshold is about the glyph's scale, so it is measured against the 48
  // unit design grid whichever crop is in use. A tight crop passes its ink
  // height as `size`, and the ink is 28 of the grid's 48 units tall, so scale it
  // back up before comparing. Without this a cap-height lockup would drop to the
  // small variant while drawing the mark larger than a 24px icon that does not.
  const gridSize =
    size === undefined ? undefined : crop === "tight" ? (size * 48) / 28 : size;
  const resolved =
    variant === "auto"
      ? gridSize !== undefined && gridSize < ARKIV_MARK_SMALL_BELOW
        ? "small"
        : "standard"
      : variant;

  // Both variants occupy the same ink bounds, x 4 to 44 and y 10 to 38, so the
  // tight crop and every lockup measurement hold across the switch.
  const viewBox = crop === "tight" ? "4 10 40 28" : "0 0 48 48";
  const ratio = crop === "tight" ? 40 / 28 : 1;

  return (
    <svg
      className={`ark-mark ${className}`.trim()}
      viewBox={viewBox}
      height={size}
      width={size === undefined ? undefined : size * ratio}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {resolved === "standard" ? (
        <>
          <rect x="4" y="26" width="9" height="12" />
          <rect x="15.5" y="26" width="7" height="12" />
          {/* Primary expression, the only segment that breaks the top edge. */}
          <rect x="25" y="10" width="6" height="28" />
          <rect x="33.5" y="26" width="10.5" height="12" />
        </>
      ) : (
        <>
          <rect x="4" y="26" width="13" height="12" />
          <rect x="21" y="10" width="8" height="28" />
          <rect x="33" y="26" width="11" height="12" />
        </>
      )}
    </svg>
  );
}

export interface ArkivLockupProps {
  /** Cap height of the wordmark in px, which is also the glyph height. */
  capHeight?: number;
  href?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Glyph plus ARKIV, horizontal.
 *
 * The glyph is set to the wordmark's cap height rather than its font size, so
 * the mark and the letters share a top and bottom edge instead of the glyph
 * floating inside the type's leading. The gap is one glyph segment wide, taken
 * from the mark's own geometry rather than from the spacing scale, so the
 * lockup stays correct at any size without a second measurement.
 */
export function ArkivLockup({
  capHeight = 20,
  href,
  className = "",
  children,
}: ArkivLockupProps) {
  const Tag = (href ? "a" : "span") as "a";
  return (
    <Tag
      className={`ark-lockup ${className}`.trim()}
      href={href}
      style={{ ["--lockup-cap" as string]: `${capHeight}px` }}
    >
      <ArkivMark size={capHeight} crop="tight" />
      <span className="ark-lockup__word">ARKIV</span>
      {children}
    </Tag>
  );
}

export function ArkivMarkDemo() {
  return (
    <div className="ark" style={{ display: "flex", gap: "2rem", alignItems: "flex-end" }}>
      <ArkivMark size={48} title="Arkiv" />
      <ArkivMark size={32} />
      <ArkivMark size={16} />
      <ArkivLockup capHeight={24} />
    </div>
  );
}

export default ArkivMark;
