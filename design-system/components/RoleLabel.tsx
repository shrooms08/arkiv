import * as React from "react";

/**
 * The contract-level role. `core` and `satellite` are the on-chain words; they
 * are never shown to a reader.
 */
export type AssetRole = "core" | "satellite";

export interface RoleLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  role?: AssetRole;
  /** Marks the holding named by `thesis.primaryExpression`. */
  isPrimaryExpression?: boolean;
  showDot?: boolean;
}

/**
 * Renders exactly two phrases: "Liquidity anchor" and "Thesis expression".
 *
 * The contract calls these `core` and `satellite`, and the underwriter used to
 * surface those words. They are wrong for a reader: "core" sounds like
 * importance when it means pool depth, and "satellite" sounds like an
 * afterthought when it is the actual bet. This component is the single place
 * that translation happens, so the raw words cannot leak into the UI.
 */
export const ROLE_TEXT: Record<AssetRole, string> = {
  core: "Liquidity anchor",
  satellite: "Thesis expression",
};

export function RoleLabel({
  role = "core",
  isPrimaryExpression = false,
  showDot = true,
  className = "",
  ...rest
}: RoleLabelProps) {
  // The primary expression is a thesis expression regardless of its liquidity
  // role — a deep-pool index can still be the sharpest statement of the bet.
  const text = isPrimaryExpression ? ROLE_TEXT.satellite : ROLE_TEXT[role];
  const emphasise = isPrimaryExpression || role === "satellite";

  return (
    <span
      className={`ark-role ${emphasise ? "ark-role--expression" : ""} ${className}`.trim()}
      {...rest}
    >
      {showDot && <span className="ark-role__dot" aria-hidden="true" />}
      {text}
    </span>
  );
}

export function RoleLabelDemo() {
  return (
    <div className="ark ark-stack">
      <RoleLabel role="core" />
      <RoleLabel role="satellite" />
      <RoleLabel role="core" isPrimaryExpression />
    </div>
  );
}

export default RoleLabel;
