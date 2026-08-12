import {
  AllocationRibbon,
  scrate,
  stickyinf,
  segmentsFor,
  driftedSegmentsFor,
} from "@arkiv/design-system";

/**
 * One thesis, one band. SCRATE's three legs, with IWMx — the primary
 * expression — purple and breaking the band's top edge.
 */
export function DeclaredBand() {
  return (
    <div className="ark">
      <AllocationRibbon
        segments={segmentsFor(scrate)}
        primaryCaption={`${scrate.ticker} — declared`}
      />
    </div>
  );
}

/**
 * Declared over current. Drift is a shape difference between two aligned rows,
 * so it reads without arithmetic — the purple IWMx segment has widened.
 */
export function DeclaredVsCurrent() {
  return (
    <div className="ark">
      <AllocationRibbon
        segments={segmentsFor(scrate)}
        compareSegments={driftedSegmentsFor(scrate)}
        primaryCaption="Declared"
        compareCaption="Current"
      />
    </div>
  );
}

/**
 * Six legs (STICKYINF). Four of them sit at 1000bps, above the 800bps default
 * threshold, so every label still prints; raising the threshold is what hides
 * them. Second row shows the same basket after drift.
 */
export function SixLegsWithDrift() {
  return (
    <div className="ark ark-stack">
      <AllocationRibbon
        segments={segmentsFor(stickyinf)}
        compareSegments={driftedSegmentsFor(stickyinf)}
        primaryCaption="Sticky Inflation, Central Bank Blink — declared"
        compareCaption="Current"
      />
      <AllocationRibbon
        segments={segmentsFor(stickyinf)}
        labelThresholdBps={2000}
        primaryCaption="Same basket, labels suppressed below 20%"
      />
    </div>
  );
}

/**
 * Compact band at card width. Labels are hidden until hover because a 34px
 * segment would truncate "AMZNx" to "A…", which reads as broken.
 */
export function CompactInCard() {
  return (
    <div className="ark" style={{ maxWidth: "22rem" }}>
      <AllocationRibbon
        segments={segmentsFor(stickyinf)}
        compact
        primaryCaption="STICKYINF"
      />
    </div>
  );
}
