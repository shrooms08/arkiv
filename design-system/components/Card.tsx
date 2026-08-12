import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Applies uniform padding. Turn off when composing header/body/footer. */
  padded?: boolean;
  /** Recessed surface, for nested panels. */
  sunken?: boolean;
  /** Hover and focus affordances. Pair with a real interactive element. */
  interactive?: boolean;
  /** Purple leading edge. Reserved for cards carrying a verdict. */
  verdict?: boolean;
  as?: "div" | "article" | "section" | "li";
  children?: React.ReactNode;
}

/**
 * The container primitive.
 *
 * Depth comes from a 1px rule plus a background shift, never a shadow — that
 * is what the reference measured at (zero box-shadows on the marketing page).
 * Shadows in this system are reserved for overlays that genuinely float.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    padded = false,
    sunken = false,
    interactive = false,
    verdict = false,
    as = "div",
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const Tag = as as React.ElementType;
  const classes = [
    "ark-card",
    padded ? "ark-card--padded" : "",
    sunken ? "ark-card--sunken" : "",
    interactive ? "ark-card--interactive" : "",
    verdict ? "ark-card--verdict" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag ref={ref} className={classes} {...rest}>
      {children}
    </Tag>
  );
});

export function CardHeader({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ark-card__header ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function CardBody({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ark-card__body ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ark-card__footer ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

export function CardDemo() {
  return (
    <div className="ark ark-cardgrid">
      <Card padded>
        <p style={{ margin: 0, fontSize: "var(--text-small)" }}>
          Default surface. One rule, no shadow.
        </p>
      </Card>
      <Card padded sunken>
        <p style={{ margin: 0, fontSize: "var(--text-small)" }}>
          Sunken surface, for panels nested inside a card.
        </p>
      </Card>
      <Card padded verdict>
        <p style={{ margin: 0, fontSize: "var(--text-small)" }}>
          Verdict edge. Reserved for the falsifier and the primary expression.
        </p>
      </Card>
    </div>
  );
}

export default Card;
