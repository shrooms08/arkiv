export interface RibbonSegment {
  id: string;
  /** Short label rendered inside the segment where it fits. */
  label: string;
  weightBps: number;
  /** The primary expression. Gold, taller, breaks the band's top edge. */
  isPrimary?: boolean;
}

export interface AllocationRibbonProps {
  segments?: RibbonSegment[];
  /** Optional second row, so declared and current stack and align. */
  compareSegments?: RibbonSegment[];
  /** Captions under each row. */
  primaryCaption?: string;
  compareCaption?: string;
  /** Below this share of the band, a label is hidden until hover. */
  labelThresholdBps?: number;
  /**
   * Narrow context, such as inside a card. Hides every label until hover and
   * shortens the band, because a 34px segment truncates "AMZNx" to "A…", which
   * reads as broken rather than as abbreviated.
   */
  compact?: boolean;
  onSegmentClick?: (segment: RibbonSegment) => void;
  className?: string;
}

function Row({
  segments,
  caption,
  threshold,
  compact,
  onSegmentClick,
}: {
  segments: RibbonSegment[];
  caption?: string;
  threshold: number;
  compact?: boolean;
  onSegmentClick?: (s: RibbonSegment) => void;
}) {
  const total = segments.reduce((a, s) => a + s.weightBps, 0) || 1;
  return (
    <div>
      <div className={`ark-ribbon${compact ? " ark-ribbon--compact" : ""}`} role="list">
        {segments.map((s) => {
          const share = (s.weightBps / total) * 100;
          const narrow = compact || s.weightBps < threshold;
          const interactive = Boolean(onSegmentClick);
          return (
            <div
              key={s.id}
              role="listitem"
              className={[
                "ark-ribbon__seg",
                s.isPrimary ? "ark-ribbon__seg--primary" : "",
                narrow ? "ark-ribbon__seg--narrow" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ width: `${share}%` }}
              title={`${s.label} ${(s.weightBps / 100).toFixed(2)}%`}
              tabIndex={interactive ? 0 : undefined}
              onClick={interactive ? () => onSegmentClick!(s) : undefined}
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSegmentClick!(s);
                      }
                    }
                  : undefined
              }
            >
              <span className="ark-ribbon__label">{s.label}</span>
            </div>
          );
        })}
      </div>
      {caption && (
        <div className="ark-ribbon__caption">
          <span>{caption}</span>
          <span>{(total / 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}

/**
 * The allocation as one continuous band.
 *
 * A portfolio is one object, so it gets one bar segmented by weight rather than
 * a stack of independent bars — a stack invites reading each leg in isolation,
 * which is the opposite of what a basket is. See README, divergence 3.
 *
 * The primary expression segment is gold and taller, breaking the band's top
 * edge, so the thesis's sharpest statement is findable without reading a label.
 *
 * Passing `compareSegments` stacks a second, aligned row. Drift between
 * declared and current is then a shape difference, legible without arithmetic.
 */
export function AllocationRibbon({
  segments = [],
  compareSegments,
  primaryCaption,
  compareCaption,
  labelThresholdBps = 800,
  compact = false,
  onSegmentClick,
  className = "",
}: AllocationRibbonProps) {
  if (segments.length === 0) return null;
  return (
    <div className={`ark-ribbon-group ${className}`.trim()}>
      <Row
        segments={segments}
        caption={primaryCaption}
        threshold={labelThresholdBps}
        compact={compact}
        onSegmentClick={onSegmentClick}
      />
      {compareSegments && compareSegments.length > 0 && (
        <Row
          segments={compareSegments}
          caption={compareCaption}
          threshold={labelThresholdBps}
          compact={compact}
          onSegmentClick={onSegmentClick}
        />
      )}
    </div>
  );
}

export function AllocationRibbonDemo() {
  const declared: RibbonSegment[] = [
    { id: "IWMx", label: "IWMx", weightBps: 5000, isPrimary: true },
    { id: "SPYx", label: "SPYx", weightBps: 3000 },
    { id: "QQQx", label: "QQQx", weightBps: 2000 },
  ];
  const current: RibbonSegment[] = [
    { id: "IWMx", label: "IWMx", weightBps: 5420, isPrimary: true },
    { id: "SPYx", label: "SPYx", weightBps: 2760 },
    { id: "QQQx", label: "QQQx", weightBps: 1820 },
  ];
  const many: RibbonSegment[] = [
    { id: "GLDx", label: "GLDx", weightBps: 3500, isPrimary: true },
    { id: "SPYx", label: "SPYx", weightBps: 2500 },
    { id: "QQQx", label: "QQQx", weightBps: 1000 },
    { id: "IWMx", label: "IWMx", weightBps: 1000 },
    { id: "AMZNx", label: "AMZNx", weightBps: 1000 },
    { id: "AVGOx", label: "AVGOx", weightBps: 1000 },
  ];
  return (
    <div className="ark ark-stack" style={{ gap: "var(--space-8)" }}>
      <AllocationRibbon
        segments={declared}
        compareSegments={current}
        primaryCaption="Declared"
        compareCaption="Current"
      />
      <AllocationRibbon segments={many} primaryCaption="Declared — six legs" />
    </div>
  );
}

export default AllocationRibbon;
