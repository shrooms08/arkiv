import {
  Badge,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  SerialNumber,
  WeightNumeral,
  aibottle,
  scrate,
  stickyinf,
} from "@arkiv/design-system";

const label = {
  fontSize: "var(--text-nano)",
  letterSpacing: "var(--tracking-label)",
  textTransform: "uppercase" as const,
  color: "var(--color-ink-muted)",
};

/**
 * The ordinary header: a title block on the start edge, a status marker on the
 * end edge. `justify-content: space-between` is the whole point of the slot.
 */
export function TitleAndStatus() {
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
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-small)",
              color: "var(--color-ink-muted)",
            }}
          >
            {t.summary}
          </p>
        </CardBody>
        <CardFooter>
          <span style={label}>Filed 14 March 2026 · {t.falsifier.horizon} horizon</span>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * A long title against a fixed-width marker. `align-items: flex-start` keeps
 * the badge on the first line while the title wraps under it.
 */
export function LongTitleWraps() {
  const t = scrate;
  return (
    <div className="ark" style={{ maxWidth: "26rem" }}>
      <Card as="article">
        <CardHeader>
          <div>
            <h3 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-h4)" }}>
              {t.title} — declared weights and index hedge
            </h3>
            <SerialNumber index={t.index} />
          </div>
          <Badge tone="outline">{t.falsifier.horizon}</Badge>
        </CardHeader>
        <CardBody>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-small)",
              color: "var(--color-ink-muted)",
            }}
          >
            {t.summary}
          </p>
        </CardBody>
        <CardFooter>
          <span style={label}>Primary expression {t.primaryExpression}</span>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * The header carrying the weight numeral instead of a badge — the holding
 * detail card, where the number is the largest thing in the header.
 */
export function WeightInHeader() {
  const t = stickyinf;
  const gold = t.holdings[0];
  return (
    <div className="ark" style={{ maxWidth: "34rem" }}>
      <Card as="article" verdict>
        <CardHeader>
          <div>
            <div style={label}>Thesis expression</div>
            <h3 style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-h4)" }}>
              {gold.symbol} — {gold.label}
            </h3>
          </div>
          <WeightNumeral weightBps={gold.weightBps} size="md" verdict />
        </CardHeader>
        <CardBody>
          <p
            style={{
              margin: 0,
              fontSize: "var(--text-small)",
              color: "var(--color-ink-muted)",
            }}
          >
            {gold.rationale}
          </p>
        </CardBody>
        <CardFooter>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-small)",
              color: "var(--color-ink-muted)",
            }}
          >
            {gold.wrapper}
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
