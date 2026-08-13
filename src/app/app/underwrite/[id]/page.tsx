import Link from "next/link";
import { notFound } from "next/navigation";

import { AllocationRibbon, AssetRow, Badge, FalsifierBlock, SerialNumber, type RibbonSegment } from "@ds";
import { AddressChip } from "@/components/AddressChip";
import { CoverImage } from "@/components/CoverImage";
import { MintPanel } from "@/components/MintPanel";
import { WrapperDisclosure } from "@/components/WrapperDisclosure";
import { assetBySymbol } from "@/config/assets";
import { serialForThesis } from "@/lib/chain/deployments";
import { resolveCover } from "@/lib/ui/covers";
import { dsRole } from "@/lib/ui/roles";
import { findRecord } from "@/lib/underwriting/lookup";

export const dynamic = "force-dynamic";

export default async function UnderwritePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = findRecord(id);
  if (!record) notFound();

  const t = record.thesis;
  const coreBps = t.holdings
    .filter((h) => assetBySymbol(h.symbol)?.role === "core")
    .reduce((a, h) => a + h.weightBps, 0);

  const segments: RibbonSegment[] = t.holdings.map((h) => ({
    id: h.symbol,
    label: h.symbol,
    weightBps: h.weightBps,
    isPrimary: h.symbol === t.primaryExpression,
  }));

  const serial = serialForThesis(record.thesisHash) ?? 0;

  // A freshly underwritten thesis has no serial until it is minted, because the
  // serial IS the registry index. Rather than invent one or leave the slot
  // empty, the hash short form stands in it, labelled so it cannot be misread
  // as a filing number.
  const shortHash = record.thesisHash.slice(0, 8);

  // Never a photograph. The six committed covers are hand-made art for the six
  // seed baskets; a thesis filed today has none and there is no pipeline that
  // would ever give it one, so this resolves procedural by construction. It
  // still goes through the shared resolver rather than hardcoding that, so the
  // day a cover does exist for a ticker this page agrees with every other one.
  const cover = resolveCover(t.ticker);

  return (
    <main className="app-main page-underwrite">
      <header className="underwrite-hero">
        <div className="underwrite-hero__figure">
          <CoverImage
            cover={cover}
            priority
            sizes="(min-width: 64rem) 22rem, 92vw"
            fallback={{
              ticker: t.ticker,
              index: serial,
              horizon: t.falsifier.horizon,
              segments,
              // No serial until it is minted, so the cover carries the hash
              // rather than deriving ARKIV-0000 from an index that means
              // "not in the registry" rather than "the zeroth record".
              serialLabel: serial > 0 ? undefined : shortHash,
            }}
          />
        </div>

        <div className="underwrite-hero__copy">
        <div className="app-meta-row">
          <Badge tone="structure">Underwritten</Badge>
          {serial > 0 ? (
            <>
              <SerialNumber index={serial} emphasis />
              <span className="app-meta-sep" aria-hidden="true" />
            </>
          ) : (
            <>
              <span className="app-mono-meta thesis-unfiled">
                <span className="app-label">not yet filed</span> {shortHash}
              </span>
              <span className="app-meta-sep" aria-hidden="true" />
            </>
          )}
          <span className="app-mono-meta thesis-ticker">{t.ticker}</span>
          <span className="app-meta-sep" aria-hidden="true" />
          <span className="app-mono-meta thesis-confidence">confidence: {t.confidence}</span>
          <span className="app-meta-sep" aria-hidden="true" />
          <span className="app-mono-meta thesis-legs">{t.holdings.length} holdings</span>
          <span className="app-meta-sep" aria-hidden="true" />
          <span className="app-mono-meta thesis-core">
            {coreBps / 100}% in liquidity anchors
          </span>
          <span className="app-meta-sep" aria-hidden="true" />
          <span className="app-mono-meta">hash {record.thesisHash}</span>
        </div>

        <h1 className="app-display-h1 thesis-title">{t.title}</h1>

        <div className="app-panel thesis-summary">
          <span className="app-label">The thesis</span>
          <p className="thesis-summary__text">{t.summary}</p>
        </div>

        <div className="app-panel thesis-original-panel">
          <span className="app-label">As written</span>
          <blockquote className="thesis-original">{record.input}</blockquote>
        </div>
        </div>
      </header>

      <section className="underwrite-ribbon">
        <AllocationRibbon
          segments={segments}
          primaryCaption={`${t.ticker} — declared allocation`}
        />
      </section>

      <section className="thesis-holdings">
        <div className="app-rule-heading">
          <h2>Holdings</h2>
          <span className="app-note">
            {t.holdings.length} legs · weights sum to 10000 bps
          </span>
        </div>

        {t.holdings.map((h) => {
          const asset = assetBySymbol(h.symbol);
          const isPrimary = h.symbol === t.primaryExpression;
          return (
            <div
              key={h.symbol}
              className={isPrimary ? "holding holding-primary" : "holding"}
            >
              <AssetRow
                symbol={h.symbol}
                name={asset?.label ?? ""}
                address={asset?.wrapper}
                weightBps={h.weightBps}
                role={dsRole(asset?.role)}
                isPrimaryExpression={isPrimary}
              />
              <div className="holding__why">
                <p className="holding__rationale">{h.rationale}</p>
                <div className="app-meta-row">
                  <span className="app-label">Wrapper</span>
                  <AddressChip address={asset?.wrapper} />
                </div>
              </div>
            </div>
          );
        })}

        <p className="app-prose">
          &ldquo;Liquidity anchor&rdquo; and &ldquo;thesis expression&rdquo; describe pool depth,
          not investment style &mdash; anchors sit in the deepest USDG pools, which is what
          keeps mint slippage low.
        </p>
      </section>

      <section className="thesis-falsifier">
        <div className="app-rule-heading app-rule-heading--emphasis">
          <h2>What would prove this wrong</h2>
          <span className="app-note">
            recorded on-chain with the thesis · cannot be edited after filing
          </span>
        </div>
        <FalsifierBlock
          index={serial}
          claim={t.falsifier.claim}
          observable={t.falsifier.observable}
          breachCondition={t.falsifier.breachCondition}
          horizon={t.falsifier.horizon}
          progress={0}
        />
      </section>

      {/* Rendered by the page, not by MintPanel: the disclosure must not be able
          to disappear along with the mint UI when no deployment is configured. */}
      <WrapperDisclosure />

      <MintPanel thesis={t} thesisHash={record.thesisHash} />

      <section className="thesis-risks">
        <div className="app-rule-heading">
          <h2>Risks</h2>
        </div>
        <ul className="risk-list">
          <li>
            <strong>This is not investment advice.</strong> The underwriter is a language model
            with no market data and no ability to verify its own claims. It can be confident
            and wrong.
          </li>
          <li>
            <strong>xStocks are not shares.</strong> They are tracker certificates issued by
            Backed. No voting rights, no direct dividend entitlement &mdash; the position is a
            claim on Backed.
          </li>
          <li>
            <strong>Thin liquidity.</strong> Mints are capped at $5,000 because the pools are
            $94k&ndash;$280k deep. The cap is a depth-linked limit, not an arbitrary throttle.
          </li>
          <li>
            <strong>Redemption is always open.</strong> It is in-kind, touches no pool, and is
            deliberately not pausable or sanctions-gated &mdash; nobody can trap your funds in
            the vault.
          </li>
        </ul>
      </section>

      <p className="app-note provenance">
        Underwritten by <code>{record.model}</code>, prompt <code>{record.promptVersion}</code>,
        effort <code>{record.effort}</code>, {record.attempts} attempt
        {record.attempts === 1 ? "" : "s"} · <Link href="/app/archive">Archive</Link>
      </p>
    </main>
  );
}
