import { BasketCard, aibottle, scrate, segmentsFor } from "@arkiv/design-system";

/** The archive list item, as it appears in the grid. Summaries are full length on purpose. */
export function ArchiveGrid() {
  return (
    <div className="ark ark-cardgrid">
      {[aibottle, scrate].map((t) => (
        <BasketCard
          key={t.ticker}
          index={t.index}
          name={t.title}
          ticker={t.ticker}
          thesis={t.summary}
          symbols={t.holdings.map((h) => h.symbol)}
          primaryExpression={t.primaryExpression}
          horizon={t.falsifier.horizon}
          confidence={t.confidence}
          segments={segmentsFor(t)}
        />
      ))}
    </div>
  );
}

/** Single card with the icon stack overflowing to `+N` (6 symbols, maxIcons 4). */
export function IconOverflow() {
  return (
    <div className="ark" style={{ maxWidth: "26rem" }}>
      <BasketCard
        index={2}
        name="Sticky Inflation, Central Bank Blink"
        ticker="STICKYINF"
        thesis="Inflation remains above target longer than consensus expects, and central banks cut rates before the job is finished because the political cost of a slowing labour market exceeds the political cost of tolerating 3% inflation."
        symbols={["GLDx", "SPYx", "QQQx", "IWMx", "AMZNx", "AVGOx"]}
        primaryExpression="GLDx"
        horizon="12M"
        confidence="medium"
        segments={[
          { id: "GLDx", label: "GLDx", weightBps: 3500, isPrimary: true },
          { id: "SPYx", label: "SPYx", weightBps: 2500 },
          { id: "QQQx", label: "QQQx", weightBps: 1000 },
          { id: "IWMx", label: "IWMx", weightBps: 1000 },
          { id: "AMZNx", label: "AMZNx", weightBps: 1000 },
          { id: "AVGOx", label: "AVGOx", weightBps: 1000 },
        ]}
      />
    </div>
  );
}

/** Minimum viable card: no ribbon, no confidence badge, no icon stack. */
export function Bare() {
  return (
    <div className="ark" style={{ maxWidth: "26rem" }}>
      <BasketCard
        index={7}
        name="Copper Supply Deficit"
        ticker="CUDEF"
        thesis="Grid electrification and datacentre buildout raise copper demand faster than new mine supply can respond, and permitting timelines mean the gap cannot close inside the horizon."
        primaryExpression="—"
        horizon="24M"
      />
    </div>
  );
}
