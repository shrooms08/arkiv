import * as React from "react";

export interface SerialNumberProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** On-chain basket index. `basketCount()` ordering, zero-based or not. */
  index?: number;
  /** Digits to pad to. `ARKIV-0001` at the default. */
  pad?: number;
  prefix?: string;
  emphasis?: boolean;
}

/** `formatSerial(1)` -> `"ARKIV-0001"`. Exported so callers can sort or match. */
export function formatSerial(index: number, pad = 4, prefix = "ARKIV"): string {
  const n = Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
  return `${prefix}-${String(n).padStart(pad, "0")}`;
}

/**
 * The archive's accession number.
 *
 * Mono and small on purpose: it is a citation, not a headline. A record that
 * can be cited later is the whole premise of the product, so every thesis
 * carries one — see README, divergence 4.
 */
export function SerialNumber({
  index = 0,
  pad = 4,
  prefix = "ARKIV",
  emphasis = false,
  className = "",
  ...rest
}: SerialNumberProps) {
  const serial = formatSerial(index, pad, prefix);
  return (
    <span
      className={`ark-serial ${emphasis ? "ark-serial--emphasis" : ""} ${className}`.trim()}
      title={`Basket index ${index}`}
      {...rest}
    >
      {serial}
    </span>
  );
}

export function SerialNumberDemo() {
  return (
    <div className="ark" style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
      <SerialNumber index={1} />
      <SerialNumber index={2} />
      <SerialNumber index={3} emphasis />
      <SerialNumber index={147} />
    </div>
  );
}

export default SerialNumber;
