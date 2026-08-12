import { Badge } from "./Badge";
import { Card, CardBody, CardFooter, CardHeader } from "./Card";
import { SerialNumber } from "./SerialNumber";
import { AllocationRibbon, type RibbonSegment } from "./AllocationRibbon";

export interface BasketCardProps {
  index?: number;
  name?: string;
  ticker?: string;
  /** Full thesis summary. Clamped to two lines by the stylesheet. */
  thesis?: string;
  /** Symbols for the icon stack, in weight order. */
  symbols?: string[];
  /** Icons shown before collapsing to `+N`. */
  maxIcons?: number;
  /** Metric slot, left: the holding named as primary expression. */
  primaryExpression?: string;
  /** Metric slot, right: the falsifier horizon. */
  horizon?: string;
  confidence?: "low" | "medium" | "high";
  /** Optional ribbon in the card footer. */
  segments?: RibbonSegment[];
  /**
   * Cover image URL. Rendered at the top of the card at a fixed 11:6 ratio so a
   * grid of cards keeps one baseline regardless of what art each one carries.
   * Omit it and the card renders without a cover rather than reserving an empty
   * band — a blank slot reads as a failed image, which is worse than no image.
   */
  cover?: string;
  /**
   * Alt text for `cover`. Defaults to naming the basket, which is the useful
   * thing to hear: the art is decorative, the record it belongs to is not.
   */
  coverAlt?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
}

/**
 * The archive's list item.
 *
 * The metric slot carries the primary expression and the falsifier horizon —
 * never a return figure. Arkiv's differentiator is a claim that can be checked
 * and found wrong; putting a return where the claim should be makes the
 * falsifier decorative and turns the archive into a leaderboard. See README,
 * divergence 1.
 */
export function BasketCard({
  index = 0,
  name = "",
  ticker = "",
  thesis = "",
  symbols = [],
  maxIcons = 4,
  primaryExpression = "",
  horizon = "",
  confidence,
  segments,
  cover,
  coverAlt,
  href,
  onClick,
  className = "",
}: BasketCardProps) {
  const shown = symbols.slice(0, maxIcons);
  const overflow = Math.max(0, symbols.length - shown.length);
  const interactive = Boolean(href || onClick);

  const content = (
    <>
      {cover && (
        <div className="ark-basketcard__cover">
          <img src={cover} alt={coverAlt ?? (name ? `${name} — cover` : "Basket cover")} />
        </div>
      )}

      <CardHeader>
        <span className="ark-basketcard__ident">
          <h3 className="ark-basketcard__name">{name}</h3>
          <span className="ark-basketcard__ticker">{ticker}</span>
        </span>
        <SerialNumber index={index} />
      </CardHeader>

      <CardBody>
        <div className="ark-stack" style={{ gap: "var(--space-4)" }}>
          <p className="ark-basketcard__thesis">{thesis}</p>

          <div className="ark-basketcard__top">
            <span className="ark-basketcard__stack" aria-label={symbols.join(", ")}>
              {shown.map((s) => (
                <span key={s} className="ark-basketcard__chip" title={s}>
                  {s.slice(0, 2).toUpperCase()}
                </span>
              ))}
              {overflow > 0 && (
                <span className="ark-basketcard__chip ark-basketcard__chip--overflow">
                  +{overflow}
                </span>
              )}
            </span>
            {confidence && <Badge tone="structure">{confidence} confidence</Badge>}
          </div>

          {segments && segments.length > 0 && (
            <AllocationRibbon segments={segments} compact />
          )}
        </div>
      </CardBody>

      <CardFooter>
        <div className="ark-basketcard__metrics">
          <span className="ark-basketcard__metric">
            <span className="ark-basketcard__metric-label">Primary expression</span>
            <span className="ark-basketcard__metric-value ark-basketcard__metric-value--verdict">
              {primaryExpression || "—"}
            </span>
          </span>
          <span className="ark-basketcard__metric">
            <span className="ark-basketcard__metric-label">Falsifier horizon</span>
            <span className="ark-basketcard__metric-value">{horizon || "—"}</span>
          </span>
        </div>
      </CardFooter>
    </>
  );

  if (href) {
    return (
      <Card
        as="article"
        interactive
        className={`ark-basketcard ${className}`.trim()}
      >
        <a
          href={href}
          style={{ display: "contents", color: "inherit", textDecoration: "none" }}
        >
          {content}
        </a>
      </Card>
    );
  }

  return (
    <Card
      as="article"
      interactive={interactive}
      onClick={onClick}
      className={`ark-basketcard ${className}`.trim()}
    >
      {content}
    </Card>
  );
}

export function BasketCardDemo() {
  const items: BasketCardProps[] = [
    {
      index: 1,
      name: "AI Infrastructure Bottleneck Capture",
      ticker: "AIBOTTLE",
      thesis:
        "Hyperscaler AI capex continues to compound because demand for inference and training exceeds supply of accelerators and networking silicon, and that shortfall shows up first in the companies selling the bottleneck rather than the ones buying it.",
      symbols: ["SPYx", "NVDAx", "QQQx", "AVGOx"],
      primaryExpression: "NVDAx",
      horizon: "12M",
      confidence: "high",
      segments: [
        { id: "SPYx", label: "SPYx", weightBps: 3000 },
        { id: "NVDAx", label: "NVDAx", weightBps: 2500, isPrimary: true },
        { id: "QQQx", label: "QQQx", weightBps: 2500 },
        { id: "AVGOx", label: "AVGOx", weightBps: 2000 },
      ],
    },
    {
      index: 2,
      name: "Sticky Inflation, Central Bank Blink",
      ticker: "STICKYINF",
      thesis:
        "Inflation remains above target longer than consensus expects, and central banks cut rates before the job is finished because the political cost of a slowing labour market exceeds the political cost of tolerating 3% inflation.",
      symbols: ["GLDx", "SPYx", "QQQx", "IWMx", "AMZNx", "AVGOx"],
      primaryExpression: "GLDx",
      horizon: "12M",
      confidence: "medium",
      segments: [
        { id: "GLDx", label: "GLDx", weightBps: 3500, isPrimary: true },
        { id: "SPYx", label: "SPYx", weightBps: 2500 },
        { id: "QQQx", label: "QQQx", weightBps: 1000 },
        { id: "IWMx", label: "IWMx", weightBps: 1000 },
        { id: "AMZNx", label: "AMZNx", weightBps: 1000 },
        { id: "AVGOx", label: "AVGOx", weightBps: 1000 },
      ],
    },
    {
      index: 3,
      name: "Small Cap Rate Relief with Index Hedge",
      ticker: "SCRATE",
      thesis:
        "Small caps have been disproportionately punished by high rates because they carry more floating-rate debt and have less access to locked-in fixed financing than megacaps. As the Fed eases, that liability burden lightens mechanically.",
      symbols: ["IWMx", "SPYx", "QQQx"],
      primaryExpression: "IWMx",
      horizon: "12M",
      confidence: "high",
      segments: [
        { id: "IWMx", label: "IWMx", weightBps: 5000, isPrimary: true },
        { id: "SPYx", label: "SPYx", weightBps: 3000 },
        { id: "QQQx", label: "QQQx", weightBps: 2000 },
      ],
    },
  ];

  return (
    <div className="ark ark-cardgrid">
      {items.map((it) => (
        <BasketCard key={it.ticker} {...it} />
      ))}
    </div>
  );
}

export default BasketCard;
