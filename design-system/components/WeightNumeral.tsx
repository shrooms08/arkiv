import * as React from "react";

export type WeightSize = "sm" | "md" | "lg";

export interface WeightNumeralProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Weight in basis points, as stored on chain. 5000 -> 50%. */
  weightBps?: number;
  size?: WeightSize;
  /** Gold. Set for the primary expression holding. */
  verdict?: boolean;
  /** Decimal places. 0 gives "50", 1 gives "50.0". */
  precision?: number;
  showUnit?: boolean;
}

/** 5000 -> "50", 3333 -> "33.3" at precision 1. */
export function formatWeight(weightBps: number, precision = 0): string {
  const pct = weightBps / 100;
  return pct.toFixed(precision);
}

/**
 * A weight percentage as display type, not table data.
 *
 * Sizes are 56 / 88 / 120px. The reference renders the equivalent number at
 * 14px, weight 700, tabular-nums — table data. That is the divergence: the
 * weight is the model's verdict on the thesis, so it is the largest thing in
 * the row, larger than the ticker. See README, divergence 2.
 *
 * Tabular figures and tight tracking so a column of these aligns and reads as
 * one object rather than as ragged numerals.
 */
export function WeightNumeral({
  weightBps = 0,
  size = "md",
  verdict = false,
  precision = 0,
  showUnit = true,
  className = "",
  ...rest
}: WeightNumeralProps) {
  const value = formatWeight(weightBps, precision);
  return (
    <span
      className={[
        "ark-weight",
        `ark-weight--${size}`,
        verdict ? "ark-weight--verdict" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${value} percent`}
      {...rest}
    >
      {value}
      {showUnit && (
        <span className="ark-weight__unit" aria-hidden="true">
          %
        </span>
      )}
    </span>
  );
}

export function WeightNumeralDemo() {
  return (
    <div className="ark ark-stack">
      <div style={{ display: "flex", gap: "var(--space-8)", alignItems: "baseline", flexWrap: "wrap" }}>
        <WeightNumeral weightBps={5000} size="lg" verdict />
        <WeightNumeral weightBps={3000} size="md" />
        <WeightNumeral weightBps={2000} size="sm" />
      </div>
      <div style={{ display: "flex", gap: "var(--space-8)", alignItems: "baseline" }}>
        <WeightNumeral weightBps={3333} precision={1} size="sm" />
        <WeightNumeral weightBps={833} precision={2} size="sm" />
      </div>
    </div>
  );
}

export default WeightNumeral;
