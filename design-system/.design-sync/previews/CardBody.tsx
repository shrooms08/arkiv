import {
  AllocationRibbon,
  AssetRow,
  Badge,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  SerialNumber,
  aibottle,
  driftedSegmentsFor,
  scrate,
  segmentsFor,
  stickyinf,
} from "@arkiv/design-system";

const label = {
  fontSize: "var(--text-nano)",
  letterSpacing: "var(--tracking-label)",
  textTransform: "uppercase" as const,
  color: "var(--color-ink-muted)",
};

const prose = {
  margin: 0,
  fontSize: "var(--text-small)",
  lineHeight: "var(--leading-normal)",
  color: "var(--color-ink-muted)",
};

/** The body as running prose: summary, then the filed claim. */
export function Prose() {
  const t = aibottle;
  return (
    <div className="ark" style={{ maxWidth: "34rem" }}>
      <Card as="article">
        <CardHeader>
          <div>
            <h3 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-h4)" }}>
              {t.title}
            </h3>
            <SerialNumber index={t.index} />
          </div>
          <Badge tone="structure">Confidence: {t.confidence}</Badge>
        </CardHeader>
        <CardBody>
          <p style={prose}>{t.summary}</p>
          <p style={{ ...label, marginBlockEnd: "var(--space-1)", marginBlockStart: "var(--space-4)" }}>
            Claim
          </p>
          <p style={{ ...prose, color: "var(--color-ink)" }}>{t.falsifier.claim}</p>
        </CardBody>
        <CardFooter>
          <span style={label}>{t.falsifier.horizon} horizon · open</span>
        </CardFooter>
      </Card>
    </div>
  );
}

/** The body as a holdings list — rows sit flush to the card's inline padding. */
export function Holdings() {
  const t = scrate;
  return (
    <div className="ark" style={{ maxWidth: "40rem" }}>
      <Card as="article">
        <CardHeader>
          <div>
            <h3 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-h4)" }}>
              {t.title}
            </h3>
            <SerialNumber index={t.index} />
          </div>
          <Badge tone="outline">3 legs</Badge>
        </CardHeader>
        <CardBody>
          {t.holdings.map((h) => (
            <AssetRow
              key={h.symbol}
              symbol={h.symbol}
              name={h.label}
              address={h.wrapper}
              weightBps={h.weightBps}
              role={h.role}
              isPrimaryExpression={h.symbol === t.primaryExpression}
            />
          ))}
        </CardBody>
        <CardFooter>
          <span style={label}>Weights fixed at filing · never rebalanced</span>
        </CardFooter>
      </Card>
    </div>
  );
}

/** The body carrying the two-row ribbon: declared against current. */
export function RibbonPanel() {
  const t = stickyinf;
  return (
    <div className="ark" style={{ maxWidth: "36rem" }}>
      <Card as="section">
        <CardHeader>
          <div>
            <h3 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-h4)" }}>
              {t.title}
            </h3>
            <SerialNumber index={t.index} />
          </div>
          <Badge tone="verdict">Primary {t.primaryExpression}</Badge>
        </CardHeader>
        <CardBody>
          <AllocationRibbon
            segments={segmentsFor(t)}
            compareSegments={driftedSegmentsFor(t)}
            primaryCaption="Declared at filing"
            compareCaption="Current, after price drift"
          />
        </CardBody>
        <CardFooter>
          <span style={label}>Six legs · {t.falsifier.horizon} horizon</span>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * `flex: 1 1 auto` on the body: two cards of unequal copy in one grid row keep
 * their footers on the same baseline.
 */
export function FillsHeight() {
  return (
    <div className="ark ark-cardgrid">
      {[aibottle, scrate].map((t) => (
        <Card key={t.ticker} as="article">
          <CardHeader>
            <div>
              <h3 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-h4)" }}>
                {t.title}
              </h3>
              <SerialNumber index={t.index} />
            </div>
            <Badge tone="structure">{t.confidence}</Badge>
          </CardHeader>
          <CardBody>
            <p style={prose}>
              {t.ticker === "AIBOTTLE"
                ? "Hyperscaler AI capex continues to compound."
                : t.summary}
            </p>
          </CardBody>
          <CardFooter>
            <span style={label}>
              Primary {t.primaryExpression} · {t.falsifier.horizon}
            </span>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
