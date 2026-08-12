import * as React from "react";

import { RoleLabel, type AssetRole } from "./RoleLabel";
import { WeightNumeral } from "./WeightNumeral";

export interface AssetRowProps extends React.HTMLAttributes<HTMLDivElement> {
  symbol?: string;
  /** Company or index name, e.g. "Russell 2000". */
  name?: string;
  /** Full wrapper address; rendered truncated with a copy affordance. */
  address?: string;
  weightBps?: number;
  role?: AssetRole;
  isPrimaryExpression?: boolean;
  /** Optional image. Falls back to the symbol's first two letters. */
  iconSrc?: string;
  onCopyAddress?: (address: string) => void;
}

export function truncateAddress(address: string, lead = 6, tail = 4): string {
  if (!address || address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * One holding.
 *
 * The weight is set as display type at `--text-h1`, which makes it the largest
 * element in the row — larger than the ticker. That ordering is the point: the
 * ticker says what was bought, the weight says how much of the thesis rests on
 * it, and the second is the claim.
 */
export function AssetRow({
  symbol = "",
  name = "",
  address = "",
  weightBps = 0,
  role = "core",
  isPrimaryExpression = false,
  iconSrc,
  onCopyAddress,
  className = "",
  ...rest
}: AssetRowProps) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard?.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard can be unavailable (insecure context, denied permission).
      // Silently keep the visible address rather than claiming a copy happened.
    }
    onCopyAddress?.(address);
  }

  return (
    <div
      className={[
        "ark-assetrow",
        isPrimaryExpression ? "ark-assetrow--primary" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <span
        className={`ark-assetrow__icon ${isPrimaryExpression ? "ark-assetrow__icon--verdict" : ""}`.trim()}
        aria-hidden="true"
      >
        {iconSrc ? (
          <img src={iconSrc} alt="" width={24} height={24} />
        ) : (
          symbol.slice(0, 2).toUpperCase()
        )}
      </span>

      <span className="ark-assetrow__ident">
        <span className="ark-assetrow__symbol">{symbol}</span>
        <span className="ark-assetrow__meta">
          {name && <span className="ark-assetrow__name">{name}</span>}
          {address && (
            <button
              type="button"
              className="ark-assetrow__addr"
              onClick={copy}
              title={address}
              aria-label={`Copy address ${address}`}
            >
              {copied ? "Copied" : truncateAddress(address)}
            </button>
          )}
        </span>
      </span>

      <RoleLabel role={role} isPrimaryExpression={isPrimaryExpression} />

      <WeightNumeral
        weightBps={weightBps}
        size="sm"
        verdict={isPrimaryExpression}
        className="ark-assetrow__weight"
        showUnit={false}
      />
    </div>
  );
}

export function AssetRowDemo() {
  const rows = [
    {
      symbol: "IWMx",
      name: "Russell 2000",
      address: "0xF62aF5F56ba0Eb1D8e92EBf18ECE2cA1a44f6958",
      weightBps: 5000,
      role: "core" as const,
      isPrimaryExpression: true,
    },
    {
      symbol: "SPYx",
      name: "S&P 500",
      address: "0xfF49F7D98764e334d8507cC8284F63b306b98044",
      weightBps: 3000,
      role: "core" as const,
    },
    {
      symbol: "QQQx",
      name: "Nasdaq 100",
      address: "0x513b881eD1f771aCb5decDaf536f2e9B2C080C34",
      weightBps: 2000,
      role: "core" as const,
    },
  ];
  return (
    <div className="ark ark-card" style={{ maxWidth: "var(--container-prose)" }}>
      {rows.map((r) => (
        <AssetRow key={r.symbol} {...r} />
      ))}
    </div>
  );
}

export default AssetRow;
