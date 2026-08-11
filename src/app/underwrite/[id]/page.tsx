import Link from "next/link";
import { notFound } from "next/navigation";

import { ROLE_LABEL, assetBySymbol } from "@/config/assets";
import { MintPanel } from "@/components/MintPanel";
import { WrapperDisclosure } from "@/components/WrapperDisclosure";
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

  return (
    <main className="page-underwrite">
      <h1 className="thesis-title">{t.title}</h1>
      <p className="muted thesis-meta">
        <span className="thesis-ticker">{t.ticker}</span> ·{" "}
        <span className="thesis-confidence">confidence: {t.confidence}</span> ·{" "}
        <span className="thesis-legs">{t.holdings.length} holdings</span> ·{" "}
        <span className="thesis-core">{coreBps / 100}% in liquidity anchors</span>
      </p>

      <section className="thesis-summary">
        <h2>The thesis</h2>
        <p>{t.summary}</p>
        <blockquote className="thesis-original muted">{record.input}</blockquote>
      </section>

      <section className="thesis-holdings">
        <h2>Holdings</h2>
        <table>
          <thead>
            <tr>
              <th>Asset</th>
              <th className="numeric">Weight</th>
              <th>Role</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {t.holdings.map((h) => {
              const asset = assetBySymbol(h.symbol);
              const isPrimary = h.symbol === t.primaryExpression;
              return (
                <tr key={h.symbol} className={isPrimary ? "holding holding-primary" : "holding"}>
                  <td>
                    <strong>{h.symbol}</strong>
                    <br />
                    <span className="muted">{asset?.label}</span>
                    {isPrimary && (
                      <>
                        <br />
                        <span className="primary-badge">Primary expression</span>
                      </>
                    )}
                  </td>
                  <td className="numeric">{h.weightBps / 100}%</td>
                  <td className="muted">{asset ? ROLE_LABEL[asset.role] : "—"}</td>
                  <td>{h.rationale}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted">
          &ldquo;Liquidity anchor&rdquo; and &ldquo;thesis expression&rdquo; describe pool depth,
          not investment style &mdash; anchors sit in the deepest USDG pools, which is what
          keeps mint slippage low.
        </p>
      </section>

      <section className="thesis-falsifier">
        <h2>How you will know if this is wrong</h2>
        <dl>
          <dt>Claim</dt>
          <dd className="falsifier-claim">{t.falsifier.claim}</dd>
          <dt>What to watch</dt>
          <dd className="falsifier-observable">{t.falsifier.observable}</dd>
          <dt>What would break it</dt>
          <dd className="falsifier-breach">{t.falsifier.breachCondition}</dd>
          <dt>By when</dt>
          <dd className="falsifier-horizon">{t.falsifier.horizon}</dd>
        </dl>
      </section>

      {/* Rendered by the page, not by MintPanel: the disclosure must not be able
          to disappear along with the mint UI when no deployment is configured. */}
      <WrapperDisclosure />

      <MintPanel thesis={t} thesisHash={record.thesisHash} />

      <section className="thesis-risks">
        <h2>Risks</h2>
        <ul>
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

      <p className="muted provenance">
        Underwritten by <code>{record.model}</code>, prompt <code>{record.promptVersion}</code>,
        effort <code>{record.effort}</code>, {record.attempts} attempt
        {record.attempts === 1 ? "" : "s"} · <Link href="/archive">Archive</Link>
      </p>
    </main>
  );
}
