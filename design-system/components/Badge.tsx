import * as React from "react";

export type BadgeTone = "neutral" | "structure" | "verdict" | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children?: React.ReactNode;
}

/**
 * Small uppercase marker. Measured reference size is 10px/600 with 0.05em
 * tracking, which is what the `--text-nano` token carries.
 *
 * Tone follows the one-colour-one-meaning rule: `structure` is ink and carries
 * chrome and status, `verdict` is purple and is only correct where the badge is
 * about a claim that can be checked — in practice, a breach.
 */
export function Badge({
  tone = "neutral",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span className={`ark-badge ark-badge--${tone} ${className}`.trim()} {...rest}>
      {children}
    </span>
  );
}

export function BadgeDemo() {
  return (
    <div className="ark" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
      <Badge tone="neutral">Testnet</Badge>
      <Badge tone="structure">Confidence: high</Badge>
      {/* A holding is not a claim, so naming one is structure, not verdict. */}
      <Badge tone="structure">Primary expression</Badge>
      <Badge tone="outline">12M horizon</Badge>
      <Badge tone="verdict">Breached</Badge>
    </div>
  );
}

export default Badge;
