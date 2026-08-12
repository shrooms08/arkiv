import { AssetRow, aibottle, scrate } from "@arkiv/design-system";

/**
 * A whole basket as it appears under the ribbon: SCRATE's three legs, IWMx
 * marked as the primary expression with the gold rule, gold chip and gold
 * weight. The weight outsizes the ticker on purpose.
 */
export function BasketStack() {
  return (
    <div className="ark ark-card" style={{ maxWidth: "var(--container-prose)" }}>
      {scrate.holdings.map((h) => (
        <AssetRow
          key={h.symbol}
          symbol={h.symbol}
          name={h.label}
          address={h.wrapper}
          weightBps={h.weightBps}
          role={h.role}
          isPrimaryExpression={h.symbol === scrate.primaryExpression}
        />
      ))}
    </div>
  );
}

/**
 * Core versus satellite, from AIBOTTLE. SPYx is pool depth, AVGOx is the bet —
 * the role column is the only thing that separates them, so it carries weight.
 */
export function CoreVersusSatellite() {
  return (
    <div className="ark ark-card" style={{ maxWidth: "var(--container-prose)" }}>
      <AssetRow
        symbol="SPYx"
        name="S&P 500"
        address="0xfF49F7D98764e334d8507cC8284F63b306b98044"
        weightBps={3000}
        role="core"
      />
      <AssetRow
        symbol="AVGOx"
        name="Broadcom"
        address="0x48917839eB39b4e603f7C28b559C533DA36A995e"
        weightBps={2000}
        role="satellite"
      />
    </div>
  );
}

/**
 * The override, isolated. IWMx is `core` on the contract, so unflagged it reads
 * "Liquidity anchor"; flagged as SCRATE's primary expression the same row reads
 * "Thesis expression" and takes the gold rule, chip and weight.
 */
export function PrimaryExpression() {
  const iwm = scrate.holdings.find((h) => h.symbol === "IWMx")!;
  return (
    <div className="ark ark-card" style={{ maxWidth: "var(--container-prose)" }}>
      <AssetRow
        symbol={iwm.symbol}
        name={iwm.label}
        address={iwm.wrapper}
        weightBps={iwm.weightBps}
        role={iwm.role}
      />
      <AssetRow
        symbol={iwm.symbol}
        name={iwm.label}
        address={iwm.wrapper}
        weightBps={iwm.weightBps}
        role={iwm.role}
        isPrimaryExpression
      />
    </div>
  );
}

/**
 * Long fund names at card width. The name truncates with an ellipsis while the
 * mono address, the role and the weight all hold their place — the row must not
 * collapse or push the weight out of alignment.
 */
export function LongNameTruncation() {
  return (
    <div className="ark ark-card" style={{ maxWidth: "34rem" }}>
      <AssetRow
        symbol="IWMx"
        name="iShares Russell 2000 Small-Cap Index ETF"
        address="0xF62aF5F56ba0Eb1D8e92EBf18ECE2cA1a44f6958"
        weightBps={5000}
        role="core"
        isPrimaryExpression
      />
      <AssetRow
        symbol="AVGOx"
        name="Broadcom Inc. Common Stock"
        address="0x48917839eB39b4e603f7C28b559C533DA36A995e"
        weightBps={2000}
        role="satellite"
      />
    </div>
  );
}

/** Floor of the API: symbol and weight only, no name, no address, no icon. */
export function IdentityOnly() {
  return (
    <div className="ark ark-card" style={{ maxWidth: "var(--container-prose)" }}>
      <AssetRow symbol="QQQx" weightBps={2000} role="core" />
      <AssetRow symbol="AMZNx" weightBps={1000} role="satellite" />
    </div>
  );
}
