import {
  AllocationRibbon,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  SerialNumber,
  WeightNumeral,
  aibottle,
  scrate,
  segmentsFor,
  stickyinf,
} from "@arkiv/design-system";

/**
 * The three surfaces, as CardDemo states them: default, sunken, verdict.
 * The gold edge is reserved for a card carrying a verdict, so it is the
 * falsifier card that gets it.
 */
export function Surfaces() {
  return (
    <div className="ark ark-cardgrid">
      <Card padded>
        <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--text-h4)" }}>
          {aibottle.title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-small)",
            color: "var(--color-ink-muted)",
          }}
        >
          {aibottle.summary}
        </p>
      </Card>

      <Card padded sunken>
        <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--text-h4)" }}>
          Observable
        </h3>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-small)",
            color: "var(--color-ink-muted)",
          }}
        >
          {aibottle.falsifier.observable}
        </p>
      </Card>

      <Card padded verdict>
        <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--text-h4)" }}>
          Breach condition
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-small)",
            color: "var(--color-ink-muted)",
          }}
        >
          {aibottle.falsifier.breachCondition}
        </p>
      </Card>
    </div>
  );
}

/**
 * `padded` off, header/body/footer on. This is the composition the slot
 * components exist for — uniform padding would double up on their own.
 */
export function SlotComposition() {
  const t = scrate;
  return (
    <div className="ark" style={{ maxWidth: "34rem" }}>
      <Card as="article">
        <CardHeader>
          <div>
            <h3 style={{ margin: 0, fontSize: "var(--text-h4)" }}>{t.title}</h3>
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
          <div style={{ marginBlockStart: "var(--space-4)" }}>
            <AllocationRibbon
              segments={segmentsFor(t)}
              primaryCaption="Declared weights, fixed at filing"
            />
          </div>
        </CardBody>
        <CardFooter>
          <span
            style={{
              fontSize: "var(--text-nano)",
              letterSpacing: "var(--tracking-label)",
              textTransform: "uppercase",
              color: "var(--color-ink-muted)",
            }}
          >
            Primary expression {t.primaryExpression} · {t.falsifier.horizon} horizon
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}

/** `interactive` — hover and focus affordances, paired with a real control. */
export function Interactive() {
  return (
    <div className="ark ark-cardgrid">
      {[stickyinf, scrate].map((t) => (
        <Card key={t.ticker} padded interactive as="article" tabIndex={0}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "var(--space-3)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "var(--text-h4)" }}>{t.title}</h3>
            <SerialNumber index={t.index} />
          </div>
          <p
            style={{
              margin: "var(--space-3) 0 var(--space-4)",
              fontSize: "var(--text-small)",
              color: "var(--color-ink-muted)",
            }}
          >
            {t.summary}
          </p>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <Button variant="secondary" size="sm">
              View composition
            </Button>
            <Button variant="ghost" size="sm">
              Read the falsifier
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/** A sunken panel nested inside a default card — the case `sunken` is for. */
export function Nested() {
  const t = stickyinf;
  return (
    <div className="ark" style={{ maxWidth: "34rem" }}>
      <Card padded>
        <h3 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-h4)" }}>
          {t.title}
        </h3>
        <SerialNumber index={t.index} />
        <p
          style={{
            margin: "var(--space-3) 0 var(--space-4)",
            fontSize: "var(--text-small)",
            color: "var(--color-ink-muted)",
          }}
        >
          {t.summary}
        </p>
        <Card padded sunken>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-4)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "var(--text-nano)",
                  letterSpacing: "var(--tracking-label)",
                  textTransform: "uppercase",
                  color: "var(--color-ink-muted)",
                }}
              >
                Primary expression
              </div>
              <div style={{ fontWeight: "var(--weight-medium)" }}>
                {t.primaryExpression} — Gold
              </div>
            </div>
            <WeightNumeral weightBps={3500} size="md" verdict />
          </div>
        </Card>
      </Card>
    </div>
  );
}
