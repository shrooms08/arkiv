import { ProceduralCover, type RibbonSegment } from "@ds";

import type { ResolvedCover } from "@/lib/ui/covers";

export interface CoverFallback {
  ticker: string;
  /** Registry index. 0 when the basket is not minted yet, which is fine here. */
  index: number;
  horizon?: string;
  segments: RibbonSegment[];
}

export interface CoverImageProps {
  cover: ResolvedCover;
  /** Everything ProceduralCover needs when there is no photograph. */
  fallback: CoverFallback;
  sizes?: string;
  /** True for an above-the-fold hero, which should not lazy load. */
  priority?: boolean;
  className?: string;
}

/**
 * The cover in a hero slot: photograph when one exists, procedural otherwise.
 *
 * Every hero renders through this, so the landing feature, the basket detail
 * page and the underwrite result page cannot disagree about the aspect ratio,
 * the loading strategy or what happens when there is no art. The photo-versus
 * -procedural decision itself lives in `resolveCover`, not here; this component
 * only draws whichever answer it is handed.
 */
export function CoverImage({
  cover,
  fallback,
  sizes = "(min-width: 64rem) 22rem, 92vw",
  priority = false,
  className = "",
}: CoverImageProps) {
  if (cover.kind === "photo") {
    return (
      <picture className={className || undefined}>
        <source
          type="image/webp"
          srcSet={`${cover.webp720} 720w, ${cover.webp} 1408w`}
          sizes={sizes}
        />
        <img
          src={cover.png}
          alt={cover.alt}
          width={1408}
          height={768}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
        />
      </picture>
    );
  }

  return (
    <div className={`cover-procedural ${className}`.trim()}>
      <ProceduralCover
        ticker={fallback.ticker}
        index={fallback.index}
        horizon={fallback.horizon}
        segments={fallback.segments}
      />
    </div>
  );
}
