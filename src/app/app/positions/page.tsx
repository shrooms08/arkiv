import { PositionsView, type ThesisMeta } from "@/components/PositionsView";
import { allRecords } from "@/lib/underwriting/lookup";

export const dynamic = "force-dynamic";

/**
 * Positions.
 *
 * Every portfolio screen answers what you hold and what it is worth. This one
 * answers a third question, which is whether the arguments you bought are still
 * standing, and that question is the reason the page exists. It is read from
 * chain and given more weight in the layout than the money.
 *
 * Thesis titles and horizons come from the committed fixtures on the server, so
 * a row can render its identity before any chain read resolves.
 */
export default function PositionsPage() {
  const theses: ThesisMeta[] = allRecords().map((r) => ({
    ticker: r.thesis.ticker,
    title: r.thesis.title,
    horizon: r.thesis.falsifier.horizon,
    filedOn: r.createdAt,
  }));

  return (
    <main className="app-main page-positions">
      <div className="app-rule-heading app-rule-heading--emphasis">
        <h1 className="app-display-h1">Positions</h1>
        <span className="app-note">read from chain, not from this browser</span>
      </div>
      <PositionsView theses={theses} />
    </main>
  );
}
