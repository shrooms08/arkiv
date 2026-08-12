import { WeightNumeral } from "@arkiv/design-system";

const baseline: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-8)",
  alignItems: "baseline",
  flexWrap: "wrap",
};

/** 56 / 88 / 120px. The weight is display type, not table data — see divergence 2. */
export function Sizes() {
  return (
    <div className="ark" style={baseline}>
      <WeightNumeral weightBps={2000} size="sm" />
      <WeightNumeral weightBps={3000} size="md" />
      <WeightNumeral weightBps={5000} size="lg" />
    </div>
  );
}

/** Gold marks the primary expression holding. */
export function Verdict() {
  return (
    <div className="ark" style={baseline}>
      <WeightNumeral weightBps={5000} size="lg" verdict />
      <WeightNumeral weightBps={3000} size="lg" />
    </div>
  );
}

/** Tabular figures: a column of these aligns on the decimal. */
export function Precision() {
  return (
    <div className="ark" style={baseline}>
      <WeightNumeral weightBps={3333} precision={1} size="sm" />
      <WeightNumeral weightBps={833} precision={2} size="sm" />
      <WeightNumeral weightBps={10000} size="sm" showUnit={false} />
    </div>
  );
}
