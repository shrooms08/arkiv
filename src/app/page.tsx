import Link from "next/link";

import { BasketCard, type RibbonSegment } from "@ds";
import { FaqAccordion } from "@/components/FaqAccordion";
import { ThesisComposer } from "@/components/ThesisComposer";
import { basketIndexFor } from "@/lib/chain/deployments";
import { allRecords } from "@/lib/underwriting/lookup";

export const dynamic = "force-dynamic";

/**
 * Tickers with cover art committed under `public/covers/`.
 *
 * Listed rather than probed because this renders on the server and a missing
 * file should degrade to no cover, not to a broken image. Art arrives on its own
 * track; a basket without one renders without a cover band by design.
 */
const COVERS = new Set(["AIBOTTLE", "STICKYINF", "SCRATE"]);

const FAQ = [
  {
    id: "what",
    question: "What actually gets minted?",
    answer:
      "One ERC-20 share token per basket, backed by wrapped tokenized US equities held by the basket contract. The thesis text, the weights and the falsifier are written on-chain in the same transaction, so the argument and the position cannot drift apart later.",
  },
  {
    id: "ai",
    question: "What does the underwriter decide, and what does it not?",
    answer:
      "It chooses the legs and their weights, writes the reason for each size, and writes the falsifier — the observable and the breach condition. It does not choose your thesis, and it cannot change a filed basket afterwards. If it is wrong, the falsifier is the thing that says so.",
  },
  {
    id: "falsifier",
    question: "What happens when a falsifier is breached?",
    answer:
      "The basket is marked breached in the archive and keeps its serial number. Nothing is liquidated automatically — a breach is a verdict on the claim, not a stop-loss. The record stays visible, which is the point of filing it.",
  },
  {
    id: "wrappers",
    question: "Who controls the underlying wrappers?",
    answer:
      "A third-party issuer, not Arkiv. The wrapper contracts are upgradeable by a 2-of-3 multisig whose address is linked on every basket page. An upgrade can change how a wrapper redeems, and it is the largest non-market risk in the product.",
  },
  {
    id: "testnet",
    question: "Is any of this real money?",
    answer:
      "No. Arkiv is live on X Layer testnet. Every asset is a mock, price impact is not simulated, and the faucet hands out test USDG inside the mint flow. Nothing here is a security or investment advice.",
  },
];

const PROMISES = [
  {
    title: "A weight is an argument",
    body: "Every holding carries a written reason for its size, not a category label.",
  },
  {
    title: "A claim you can lose",
    body: "Each thesis files an observable and a breach condition before anything is minted.",
  },
  {
    title: "One transaction",
    body: "The legs are bought, wrapped and recorded in a single mint on X Layer.",
  },
  {
    title: "It stays on the shelf",
    body: "A thesis keeps its serial number after it resolves, including when it was wrong.",
  },
];

export default function HomePage() {
  // Server-side read of the reproducibility log and fixtures. No chain call is
  // made here — serials come from the committed deployment manifest, which
  // records registry creation order.
  const records = allRecords();

  return (
    <main className="app-main page-home">
      <section className="home-hero">
        <div className="home-hero__copy">
          <h1 className="app-display-h1">
            Write a thesis. Get a portfolio that says what would prove it wrong.
          </h1>
          <p className="app-lede">
            Describe what you believe in plain English. An underwriter turns it into a
            weighted basket of tokenized US equities, argues for the size of every
            holding, and files the condition that would prove you wrong — permanently,
            with a serial number.
          </p>
          <div className="home-stats">
            <span className="home-stat">
              <span className="home-stat__value">{records.length}</span>
              <span className="app-label">theses filed</span>
            </span>
            <span className="home-stat">
              <span className="home-stat__value">
                {records.filter((r) => basketIndexFor(r.thesis.ticker)).length}
              </span>
              <span className="app-label">minted on chain</span>
            </span>
            <span className="home-stat">
              <span className="home-stat__value">
                {new Set(records.map((r) => r.thesis.primaryExpression)).size}
              </span>
              <span className="app-label">distinct expressions</span>
            </span>
          </div>
        </div>

        <ThesisComposer />
      </section>

      {records.length > 0 && (
        <section className="home-section">
          <div className="app-rule-heading app-rule-heading--emphasis">
            <h2>Already on file</h2>
            <Link className="app-note home-archive-link" href="/archive">
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
              return (
                <BasketCard
                  key={r.thesisHash}
                  index={basketIndexFor(t.ticker) ?? 0}
                  name={t.title}
                  ticker={t.ticker}
                  thesis={t.summary}
                  symbols={t.holdings.map((h) => h.symbol)}
                  primaryExpression={t.primaryExpression}
                  horizon={t.falsifier.horizon}
                  confidence={t.confidence}
                  segments={segments}
                  cover={COVERS.has(t.ticker) ? `/covers/${t.ticker}.png` : undefined}
                  coverAlt={`${t.title}, cover art`}
                  href={`/underwrite/${r.thesisHash}`}
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="home-promises">
        {PROMISES.map((p) => (
          <div className="home-promise" key={p.title}>
            <h3 className="home-promise__title">{p.title}</h3>
            <p className="app-prose">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="home-faq">
        <div className="home-faq__intro">
          <h2 className="app-display-h1 home-faq__heading">Questions</h2>
          <p className="app-prose">The ones worth answering before you write anything.</p>
        </div>
        <div className="home-faq__body">
          <FaqAccordion items={FAQ} />
        </div>
      </section>

      <p className="app-prose">
        Not investment advice. The underwriter has no market data and cannot verify its
        own claims — see the{" "}
        <a href="https://github.com/arkiv/docs/UNDERWRITING.md">published rubric</a>.
      </p>
    </main>
  );
}
