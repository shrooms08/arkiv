import { Badge, scrate, stickyinf } from "@arkiv/design-system";

const row: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
  flexWrap: "wrap",
  alignItems: "center",
};

/** The four tones, in the order the token sheet defines them. */
export function Tones() {
  return (
    <div className="ark" style={row}>
      <Badge tone="neutral">Testnet</Badge>
      <Badge tone="structure">Confidence: high</Badge>
      <Badge tone="verdict">Breached</Badge>
      <Badge tone="outline">12M horizon</Badge>
    </div>
  );
}

/**
 * Structure carries chrome and status — network, confidence, basket state.
 * Nothing here is a claim, so nothing here is purple.
 */
export function StatusMarkers() {
  return (
    <div className="ark" style={{ ...row, flexDirection: "column", alignItems: "flex-start" }}>
      <div style={row}>
        <Badge tone="structure">Confidence: {scrate.confidence}</Badge>
        <Badge tone="structure">3 holdings</Badge>
        <Badge tone="neutral">X Layer Testnet</Badge>
        <Badge tone="outline">Filed 12 Mar 2026</Badge>
      </div>
      <div style={row}>
        <Badge tone="structure">Confidence: {stickyinf.confidence}</Badge>
        <Badge tone="structure">6 holdings</Badge>
        <Badge tone="neutral">Rebalance pending</Badge>
        <Badge tone="outline">{stickyinf.falsifier.horizon} horizon</Badge>
      </div>
    </div>
  );
}

/**
 * Verdict purple is rare on purpose, and the only way to show that is a row
 * where almost nothing is purple. A holding, a confidence score and a horizon
 * are all structure — only the breach is a claim that was checked and found
 * wrong, so only the breach is the accent.
 */
export function VerdictIsRare() {
  return (
    <div className="ark" style={{ ...row, flexDirection: "column", alignItems: "flex-start" }}>
      <div style={row}>
        <Badge tone="neutral">{scrate.ticker}</Badge>
        <Badge tone="structure">Confidence: high</Badge>
        <Badge tone="structure">Primary expression</Badge>
        <Badge tone="outline">Small caps vs S&amp;P 500</Badge>
        <Badge tone="verdict">Breached</Badge>
      </div>
      <div style={row}>
        <Badge tone="neutral">{stickyinf.ticker}</Badge>
        <Badge tone="structure">Confidence: {stickyinf.confidence}</Badge>
        <Badge tone="structure">6 holdings</Badge>
        <Badge tone="outline">{stickyinf.falsifier.horizon} horizon</Badge>
      </div>
    </div>
  );
}

/** Long labels wrap as a group, not inside a badge — worth seeing at real length. */
export function LongLabels() {
  return (
    <div className="ark" style={row}>
      <Badge tone="neutral">{scrate.ticker}</Badge>
      <Badge tone="structure">Small Cap Rate Relief with Index Hedge</Badge>
      <Badge tone="outline">Rolling 12-month total return, IWMx vs SPYx</Badge>
      <Badge tone="verdict">Breach: trails by more than 5 pp</Badge>
    </div>
  );
}
