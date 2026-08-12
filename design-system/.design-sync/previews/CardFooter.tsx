import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  SerialNumber,
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

const prose = {
  margin: 0,
  fontSize: "var(--text-small)",
  lineHeight: "var(--leading-normal)",
  color: "var(--color-ink-muted)",
};

/** The metric footer: labelled pairs under the rule, as the archive card files them. */
export function Metrics() {
  const t = scrate;
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
        </CardBody>
        <CardFooter>
          <div style={{ display: "flex", gap: "var(--space-8)" }}>
            <div>
              <div style={label}>Primary expression</div>
              <div style={{ color: "var(--color-verdict)", fontWeight: "var(--weight-medium)" }}>
                {t.primaryExpression}
              </div>
            </div>
            <div>
              <div style={label}>Falsifier horizon</div>
              <div style={{ fontWeight: "var(--weight-medium)" }}>{t.falsifier.horizon}</div>
            </div>
            <div>
              <div style={label}>Legs</div>
              <div style={{ fontWeight: "var(--weight-medium)" }}>{t.holdings.length}</div>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

/** The action footer: the rule separates the copy from what you can do about it. */
export function Actions() {
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
          <Badge tone="outline">{t.falsifier.horizon}</Badge>
        </CardHeader>
        <CardBody>
          <p style={prose}>{t.summary}</p>
        </CardBody>
        <CardFooter>
          <div
            style={{
              display: "flex",
              gap: "var(--space-3)",
              justifyContent: "flex-end",
              width: "100%",
            }}
          >
            <Button variant="ghost" size="sm">
              Read the falsifier
            </Button>
            <Button variant="primary" size="sm">
              Mint basket
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

/** A verdict card whose footer carries the resolution — purple edge, purple marker. */
export function VerdictResolution() {
  const t = stickyinf;
  return (
    <div className="ark" style={{ maxWidth: "34rem" }}>
      <Card as="article" verdict>
        <CardHeader>
          <div>
            <div style={label}>Breach condition</div>
            <h3 style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-h4)" }}>
              {t.title}
            </h3>
          </div>
          <SerialNumber index={t.index} />
        </CardHeader>
        <CardBody>
          <p style={{ ...prose, color: "var(--color-ink)" }}>
            {t.falsifier.breachCondition}
          </p>
          <p style={{ ...prose, marginBlockStart: "var(--space-3)" }}>
            {t.falsifier.observable}
          </p>
        </CardBody>
        <CardFooter>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-4)",
              width: "100%",
            }}
          >
            <span style={label}>Resolved 14 March 2027 · {t.falsifier.horizon} elapsed</span>
            <Badge tone="verdict">Breached</Badge>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
