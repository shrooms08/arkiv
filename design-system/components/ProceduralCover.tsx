import type { RibbonSegment } from "./AllocationRibbon";

export interface ProceduralCoverProps {
  ticker?: string;
  /** Registry index, rendered as the serial. */
  index?: number;
  /** Falsifier horizon, e.g. "12M". */
  horizon?: string;
  segments?: RibbonSegment[];
  pad?: number;
  prefix?: string;
  className?: string;
}

/**
 * The cover a basket gets when it has no artwork.
 *
 * A basket with no file on disk must never render a reserved-but-blank strip:
 * an empty band reads as a failed image, which is worse than no image and worse
 * than something drawn from the basket's own data. Every user-generated basket
 * arrives without art, so this is the common case rather than the exception.
 *
 * What it draws is the basket, not decoration. The serial and ticker are the
 * record's identity. The bands are the actual weights, so a heavier leg is a
 * wider band, and the hairline pitch encodes the same weight a second time so
 * the shape survives being read small. The primary expression is the only band
 * that breaks the rule line, and only its overshoot is purple, because verdict
 * colour marks one thing and is never a field.
 */
export function ProceduralCover({
  ticker = "",
  index = 0,
  horizon,
  segments = [],
  pad = 4,
  prefix = "ARKIV",
  className = "",
}: ProceduralCoverProps) {
  const segs = segments.filter(Boolean);
  const serial = `${prefix}-${String(Math.max(0, Math.floor(index))).padStart(pad, "0")}`;
  const maxW = Math.max(1, ...segs.map((s) => s.weightBps || 0));
  const primary = segs.find((s) => s.isPrimary);

  const legend: string[] = [];
  if (horizon) legend.push(horizon);
  legend.push(`${segs.length} leg${segs.length === 1 ? "" : "s"}`);

  return (
    <div className={`ark-proccover ${className}`.trim()} aria-hidden="true">
      <div className="ark-proccover__plate">
        <div className="ark-proccover__stack">
          <span className="ark-proccover__label">Filed record</span>
          <span className="ark-proccover__serial">{serial}</span>
        </div>
        <div className="ark-proccover__stack">
          <span className="ark-proccover__ticker">{ticker}</span>
          {primary && (
            <span className="ark-proccover__legend">{primary.label || primary.id}</span>
          )}
          <span className="ark-proccover__legend">{legend.join(" · ")}</span>
        </div>
      </div>

      <div className="ark-proccover__bands">
        {segs.map((s) => {
          const w = s.weightBps || 0;
          // Heavier legs read denser. Clamped so the densest band stays a
          // texture rather than collapsing into a solid block.
          const pitch = Math.max(3, Math.round(15 - (w / maxW) * 10));
          return (
            <div
              key={s.id}
              className={`ark-proccover__band${s.isPrimary ? " ark-proccover__band--primary" : ""}`}
              style={{
                flexGrow: w,
                height: s.isPrimary ? "88%" : "62%",
                ...(s.isPrimary
                  ? {}
                  : {
                      backgroundImage:
                        "repeating-linear-gradient(to bottom, var(--color-ink-inverse) 0 1px, transparent 1px " +
                        `${pitch}px)`,
                    }),
              }}
            />
          );
        })}
        <div className="ark-proccover__rule" />
      </div>
    </div>
  );
}

export function ProceduralCoverDemo() {
  const segments: RibbonSegment[] = [
    { id: "MSFTx", label: "MSFTx", weightBps: 3000, isPrimary: true },
    { id: "GOOGLx", label: "GOOGLx", weightBps: 2000 },
    { id: "QQQx", label: "QQQx", weightBps: 2500 },
    { id: "SPYx", label: "SPYx", weightBps: 2500 },
  ];
  return (
    <div className="ark" style={{ display: "grid", gap: "var(--space-6)", maxWidth: "44rem" }}>
      <div style={{ aspectRatio: "11 / 6" }}>
        <ProceduralCover ticker="CAPEXPAY" index={6} horizon="12M" segments={segments} />
      </div>
      <div style={{ aspectRatio: "11 / 6", maxWidth: "22rem" }}>
        <ProceduralCover
          ticker="SCRATE"
          index={3}
          horizon="12M"
          segments={[
            { id: "IWMx", label: "IWMx", weightBps: 5000, isPrimary: true },
            { id: "SPYx", label: "SPYx", weightBps: 3000 },
            { id: "QQQx", label: "QQQx", weightBps: 2000 },
          ]}
        />
      </div>
    </div>
  );
}

export default ProceduralCover;
