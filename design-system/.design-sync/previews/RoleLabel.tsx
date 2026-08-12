import { RoleLabel, aibottle } from "@arkiv/design-system";

const propStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-nano)",
  color: "var(--color-ink-subtle)",
};

/**
 * Every role value, plus the override, with the props that produced each one.
 * The contract words `core` and `satellite` never reach the reader: this is the
 * only place the translation to "Liquidity anchor" / "Thesis expression"
 * happens. Note that `satellite` and `core + isPrimaryExpression` render
 * identically — the flag promotes a liquidity leg into the same phrase.
 */
export function EveryRole() {
  return (
    <div
      className="ark"
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto",
        justifyContent: "start",
        alignItems: "center",
        rowGap: "var(--space-3)",
        columnGap: "var(--space-6)",
      }}
    >
      <span style={propStyle}>role="core"</span>
      <RoleLabel role="core" />
      <span style={propStyle}>role="satellite"</span>
      <RoleLabel role="satellite" />
      <span style={propStyle}>role="core" isPrimaryExpression</span>
      <RoleLabel role="core" isPrimaryExpression />
    </div>
  );
}

/**
 * The dot is optional — dropped where the label sits inside an already dense
 * row and the marker would be noise. Both variants shown so the alignment
 * difference is checkable.
 */
export function WithoutDot() {
  return (
    <div
      className="ark"
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto",
        justifyContent: "start",
        alignItems: "center",
        rowGap: "var(--space-3)",
        columnGap: "var(--space-6)",
      }}
    >
      <RoleLabel role="core" />
      <RoleLabel role="core" showDot={false} />
      <RoleLabel role="satellite" />
      <RoleLabel role="satellite" showDot={false} />
    </div>
  );
}

/**
 * AIBOTTLE's four holdings as the contract stores them, translated. SPYx and
 * QQQx are pool depth; NVDAx and AVGOx are the bet, and NVDAx is the primary
 * expression so it is emphasised regardless of its `core`/`satellite` value.
 */
export function AcrossABasket() {
  return (
    <div className="ark ark-stack" style={{ gap: "var(--space-3)" }}>
      {aibottle.holdings.map((h) => (
        <div
          key={h.symbol}
          style={{
            display: "grid",
            gridTemplateColumns: "5rem 6rem auto",
            alignItems: "center",
            gap: "var(--space-4)",
          }}
        >
          <span style={{ fontSize: "var(--text-small)", fontWeight: "var(--weight-semibold)" }}>
            {h.symbol}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-nano)",
              color: "var(--color-ink-subtle)",
            }}
          >
            {h.role}
          </span>
          <RoleLabel
            role={h.role}
            isPrimaryExpression={h.symbol === aibottle.primaryExpression}
          />
        </div>
      ))}
    </div>
  );
}

