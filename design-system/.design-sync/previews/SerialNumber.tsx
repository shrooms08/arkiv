import { SerialNumber, formatSerial, demoTheses } from "@arkiv/design-system";

const scrateIndex = 3;

const caption: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-nano)",
  color: "var(--color-ink-subtle)",
};

const inline: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-4)",
  alignItems: "center",
  flexWrap: "wrap",
};

/**
 * The zero-padding across four orders of magnitude. Mono and tabular, so a
 * column of accession numbers aligns digit for digit.
 */
export function PaddingRange() {
  return (
    <div className="ark ark-stack" style={{ gap: "var(--space-2)" }}>
      {[0, 1, 12, 147, 2048].map((i) => (
        <SerialNumber key={i} index={i} />
      ))}
    </div>
  );
}

/**
 * Emphasis is for the record you are currently reading. It is one step of ink
 * only — `--color-ink-subtle` to `--color-ink-muted` — so it needs the two side
 * by side to be readable as a difference at all.
 */
export function Emphasis() {
  return (
    <div
      className="ark"
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto",
        justifyContent: "start",
        alignItems: "center",
        rowGap: "var(--space-2)",
        columnGap: "var(--space-6)",
      }}
    >
      <span style={caption}>default</span>
      <SerialNumber index={scrateIndex} />
      <span style={caption}>emphasis</span>
      <SerialNumber index={scrateIndex} emphasis />
    </div>
  );
}

/** Wider pad and an alternate prefix, for a registry that outgrows four digits. */
export function PadAndPrefix() {
  return (
    <div className="ark" style={inline}>
      <SerialNumber index={42} />
      <SerialNumber index={42} pad={6} />
      <SerialNumber index={42} prefix="DRAFT" />
      <SerialNumber index={42} pad={2} prefix="LOT" />
    </div>
  );
}

/**
 * Where it actually lives: beside a thesis title, as a citation. `formatSerial`
 * is exported so the same string can be sorted or matched outside React.
 */
export function BesideTitles() {
  return (
    <div className="ark ark-stack" style={{ gap: "var(--space-3)" }}>
      {demoTheses.map((t) => (
        <div
          key={t.ticker}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "var(--space-6)",
            maxWidth: "var(--container-prose)",
            borderBottom: "var(--border-width) solid var(--color-rule)",
            paddingBottom: "var(--space-2)",
          }}
        >
          <span style={{ fontSize: "var(--text-body)", fontWeight: "var(--weight-semibold)" }}>
            {t.title}
          </span>
          <SerialNumber index={t.index} />
        </div>
      ))}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-nano)",
          color: "var(--color-ink-subtle)",
        }}
      >
        formatSerial({scrateIndex}) === "{formatSerial(scrateIndex)}"
      </span>
    </div>
  );
}
