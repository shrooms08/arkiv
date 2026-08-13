import Link from "next/link";

import { BasketCard, type RibbonSegment } from "@ds";
import { ThesisComposer } from "@/components/ThesisComposer";
import { resolveCover } from "@/lib/ui/covers";
import { serialForThesis } from "@/lib/chain/deployments";
import { allRecords } from "@/lib/underwriting/lookup";

export const dynamic = "force-dynamic";

/**
 * Product entry.
 *
 * The working surface: write a thesis, or open one already filed. Marketing
 * lives at `/` and does not repeat itself here.
 */
export default function AppHomePage() {
  const records = allRecords();

  return (
    <main className="app-main page-home">
      <section className="home-hero">
        <div className="home-hero__copy">
          <h1 className="app-display-h1">What do you believe?</h1>
          <p className="app-lede">
            Write it in your own words. The underwriter turns it into a weighted basket,
            argues for the size of every holding, and files the condition that would prove
            you wrong.
          </p>
        </div>

        <ThesisComposer />

        {/* A note for the people who will want it, not a feature announcement. */}
        <p className="app-note write-agent-note">
          Writing with an agent?{" "}
          <a
            href="/skills/arkiv-thesis/SKILL.md"
            target="_blank"
            rel="noreferrer"
          >
            There is a skill for that
          </a>
          . It teaches prose, not allocations.
        </p>
      </section>

      {records.length > 0 && (
        <section className="home-section">
          <div className="app-rule-heading app-rule-heading--emphasis">
            <h2>Filed theses</h2>
            <Link className="app-note home-archive-link" href="/app/archive">
              Open the archive
            </Link>
          </div>

          <div className="ark-cardgrid">
            {records.map((r) => {
              const t = r.thesis;
              const total = t.holdings.reduce((a, h) => a + h.weightBps, 0) || 1;
              const segments: RibbonSegment[] = t.holdings.map((h) => ({
                id: h.symbol,
                label: h.symbol,
                weightBps: Math.round((h.weightBps / total) * 10000),
                isPrimary: h.symbol === t.primaryExpression,
              }));
              const art = resolveCover(t.ticker);
              return (
                <BasketCard
                  key={r.thesisHash}
                  index={serialForThesis(r.thesisHash) ?? 0}
                  name={t.title}
                  ticker={t.ticker}
                  thesis={t.summary}
                  symbols={t.holdings.map((h) => h.symbol)}
                  primaryExpression={t.primaryExpression}
                  horizon={t.falsifier.horizon}
                  confidence={t.confidence}
                  segments={segments}
                  cover={art.kind === "photo" ? art.png : undefined}
                  coverWebp={art.kind === "photo" ? art.webp : undefined}
                  coverWebp720={art.kind === "photo" ? art.webp720 : undefined}
                  coverAlt={art.kind === "photo" ? art.alt : undefined}
                  horizonForCover={t.falsifier.horizon}
                  href={`/app/underwrite/${r.thesisHash}`}
                />
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
