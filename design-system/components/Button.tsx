import * as React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "verdict";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Escape hatch for layout only. Never pass visual values here. */
  className?: string;
  children?: React.ReactNode;
}

/**
 * The one interactive primitive.
 *
 * `verdict` exists but is deliberately rare: gold means a claim that can be
 * checked, so a gold button is only correct when the action is about the
 * falsifier. It is not a third visual rank for "more important than secondary".
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      type = "button",
      className = "",
      children,
      ...rest
    },
    ref,
  ) {
    const classes = [
      "ark-btn",
      `ark-btn--${variant}`,
      size === "md" ? "" : `ark-btn--${size}`,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading && <span className="ark-btn__spinner" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);

export function ButtonDemo() {
  return (
    <div className="ark ark-stack">
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Button variant="primary">Mint basket</Button>
        <Button variant="secondary">View composition</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="verdict">Record breach</Button>
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <Button loading>Minting</Button>
        <Button disabled>Unavailable</Button>
        <Button variant="secondary" disabled>
          Unavailable
        </Button>
      </div>
    </div>
  );
}

export default Button;
