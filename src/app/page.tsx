import Link from "next/link";

import { BasketCard, FalsifierBlock, type RibbonSegment } from "@ds";
import { CoverImage } from "@/components/CoverImage";
import { FaqAccordion } from "@/components/FaqAccordion";
import { MarketingHeader } from "@/components/MarketingHeader";
import { NetworkBanner } from "@/components/NetworkBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { resolveCover } from "@/lib/ui/covers";
import { serialForThesis } from "@/lib/chain/deployments";
import { allRecords } from "@/lib/underwriting/lookup";

export const dynamic = "force-dynamic";

/** The basket shown in full at the top of the page. */
const FEATURED = "AIBOTTLE";

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
      "It chooses the legs and their weights, writes the reason for each size, and writes the falsifier, meaning the observable and the breach condition. It does not choose your thesis, and it cannot change a filed basket afterwards. If it is wrong, the falsifier is the thing that says so.",
  },
  {
    id: "falsifier",
    question: "What happens when a falsifier is breached?",
    answer:
      "The basket is marked breached in the archive and keeps its serial number. Nothing is liquidated automatically, because a breach is a verdict on the claim and not a stop-loss. The author's share of the mint fee stops permanently from that point. The record stays visible, which is the point of filing it.",
  },
  {
    id: "fee",
    question: "How does Arkiv make money?",
    answer:
      "A 30 bps fee on the USDG going into a mint, hard-capped in the contract at 100 bps. Half accrues to the author of the thesis, and only while their thesis stands. There is no redemption fee at any setting: the exit is unconditional.",
  },
  {
    id: "testnet",
    question: "Is any of this real money?",
    answer:
      "No. Arkiv is live on X Layer testnet. Every asset is a mock, price impact is not simulated, and a faucet hands out test USDG inside the mint flow. Nothing here is a security or investment advice.",
  },
];

const HOW = [
  {
    step: "01",
    title: "Write what you believe",
    body: "A paragraph, in your own words. The underwriter needs a mechanism, meaning what you think happens and why, not a ticker.",
  },
  {
    step: "02",
    title: "Get weights and an argument",
    body: "Every holding comes back with a written reason for its size. A weight is an argument, not a category label.",
  },
  {
    step: "03",
    title: "File the falsifier",
    body: "An observable and a breach condition, recorded on chain before anything is minted. This is the part that makes the claim checkable.",
  },
  {
    step: "04",
    title: "It keeps its number",
    body: "The thesis stays in the archive after it resolves, including when it was wrong. That is what makes the record worth anything.",
  },
];

export default function LandingPage() {
  // Server-side read of the fixtures and reproducibility log. No chain call.
  const records = allRecords();
  const featured = records.find((r) => r.thesis.ticker === FEATURED) ?? records[0];
  const rest = records.filter((r) => r !== featured);

  const segmentsOf = (holdings: { symbol: string; weightBps: number }[], primary: string) => {
    const total = holdings.reduce((a, h) => a + h.weightBps, 0) || 1;
    return holdings.map<RibbonSegment>((h) => ({
      id: h.symbol,
      label: h.symbol,
      weightBps: Math.round((h.weightBps / total) * 10000),
      isPrimary: h.symbol === primary,
    }));
  };

  return (
    <>
      <NetworkBanner />
      <MarketingHeader />

      <main className="app-main page-landing">
        <section className="landing-hero">
          <div className="landing-hero__copy">
            <h1 className="app-display-h1">
              Write a thesis. Get a portfolio that says what would prove it wrong.
            </h1>
            <p className="app-lede">
              Describe what you believe in plain English. An underwriter turns it into a
              weighted basket of tokenized US equities, argues for the size of every
              holding, and files the condition that would prove you wrong. Permanently,
              with a serial number.
            </p>
            <div className="landing-cta">
              <Link className="ark-btn ark-btn--primary ark-btn--lg" href="/app">
                Open the app
              </Link>
              <Link className="app-note landing-cta__secondary" href="/app/archive">
                Read the archive
              </Link>
            </div>
            <div className="home-stats">
              <span className="home-stat">
                <span className="home-stat__value">{records.length}</span>
                <span className="app-label">theses filed</span>
              </span>
              <span className="home-stat">
                <span className="home-stat__value">
                  {records.filter((r) => serialForThesis(r.thesisHash)).length}
                </span>
                <span className="app-label">minted on chain</span>
              </span>
              <span className="home-stat">
                <span className="home-stat__value">0</span>
                <span className="app-label">proved wrong so far</span>
              </span>
            </div>
          </div>

          {featured && (
            <figure className="landing-featured">
              <CoverImage
                cover={resolveCover(featured.thesis.ticker)}
                sizes="(min-width: 64rem) 34rem, 92vw"
                priority
                fallback={{
                  ticker: featured.thesis.ticker,
                  index: serialForThesis(featured.thesisHash) ?? 0,
                  horizon: featured.thesis.falsifier.horizon,
                  segments: segmentsOf(featured.thesis.holdings, featured.thesis.primaryExpression),
                }}
              />
              <figcaption className="landing-featured__cap">
                <span className="app-label">Filed record</span>
                <span className="app-mono-meta">
                  {featured.thesis.ticker} · expresses {featured.thesis.primaryExpression} ·{" "}
                  {featured.thesis.falsifier.horizon} horizon
                </span>
              </figcaption>
            </figure>
          )}
        </section>

        {featured && (
          <section className="landing-section">
            <div className="app-rule-heading app-rule-heading--emphasis">
              <h2>What a filed thesis looks like</h2>
              <span className="app-note">the falsifier, exactly as recorded</span>
            </div>
            <div className="landing-falsifier">
              <FalsifierBlock
                index={serialForThesis(featured.thesisHash) ?? 0}
                claim={featured.thesis.falsifier.claim}
                observable={featured.thesis.falsifier.observable}
                breachCondition={featured.thesis.falsifier.breachCondition}
                horizon={featured.thesis.falsifier.horizon}
                progress={0}
              />
              <p className="app-prose">
                Every competitor puts a return figure here. This is what sits in that
                position instead: a claim, an instrument to measure it with, and the
                condition that would settle it against the author. It is written before
                anyone could know the answer, and it cannot be edited afterwards.
              </p>
            </div>
          </section>
        )}

        <section className="landing-section" id="how">
          <div className="app-rule-heading app-rule-heading--emphasis">
            <h2>How it works</h2>
          </div>
          <ol className="landing-steps">
            {HOW.map((h) => (
              <li className="landing-step" key={h.step}>
                <span className="landing-step__num">{h.step}</span>
                <h3 className="home-promise__title">{h.title}</h3>
                <p className="app-prose">{h.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {rest.length > 0 && (
          <section className="landing-section">
            <div className="app-rule-heading app-rule-heading--emphasis">
              <h2>Also on file</h2>
              <Link className="app-note home-archive-link" href="/app/archive">
                Open the archive
              </Link>
            </div>
            <div className="ark-cardgrid">
              {rest.map((r) => {
                const t = r.thesis;
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
                    segments={segmentsOf(t.holdings, t.primaryExpression)}
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

        <section className="landing-section" id="questions">
          <div className="home-faq">
            <div className="home-faq__intro">
              <h2 className="app-display-h1 home-faq__heading">Questions</h2>
              <p className="app-prose">
                The ones worth answering before you write anything.
              </p>
            </div>
            <div className="home-faq__body">
              <FaqAccordion items={FAQ} />
            </div>
          </div>
        </section>

        <section className="landing-close">
          <h2 className="app-display-h1">Put a claim on the record.</h2>
          <Link className="ark-btn ark-btn--primary ark-btn--lg" href="/app">
            Open the app
          </Link>
          <p className="app-prose">
            Not investment advice. The underwriter has no market data and cannot verify
            its own claims. Testnet only, and every asset on it is a mock.
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
