"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChainId } from "wagmi";

import { ArkivMark, Badge } from "@ds";
import { chainById, chainIsTestnet } from "@/lib/chain/chains";
import { useViewChainId } from "@/lib/ui/useViewChain";
import { WalletBar } from "./WalletBar";

const LINKS = [
  { href: "/app", label: "Write" },
  { href: "/app/archive", label: "Archive" },
  { href: "/app/positions", label: "Positions" },
];

/**
 * Top chrome.
 *
 * Built from the design system's `.ark-nav` vocabulary rather than the `Nav`
 * component, because `Nav` renders a single action button and this app's action
 * slot is the wallet, which has three states and real connect logic. Reusing the
 * classes keeps the appearance identical without forcing the wallet's behaviour
 * through a prop that cannot express it.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const chainId = useChainId();
  // Names the chain actually being read, which is testnet by default and
  // mainnet once a wallet connects there. A badge that always said testnet
  // would be a lie on mainnet, and mainnet is the one where it matters.
  const viewChainId = useViewChainId();
  const network = chainIsTestnet(viewChainId)
    ? "X Layer testnet"
    : (chainById(viewChainId)?.name ?? null);

  return (
    <nav className="ark ark-nav" aria-label="Primary">
      <div className="ark-container ark-nav__inner">
        {/* Lockup, not a text wordmark. The glyph is set to the wordmark's cap
            height so the two share a top and bottom edge, and the gap is one
            glyph segment, both handled by .ark-lockup from the mark's geometry. */}
        <Link
          className="ark-nav__brand ark-lockup"
          href="/app"
          style={{ ["--lockup-cap" as string]: "15px" }}
          aria-label="Arkiv, home"
        >
          <ArkivMark size={15} crop="tight" />
          <span className="ark-lockup__word">ARKIV</span>
          {network && <Badge tone="neutral">{network}</Badge>}
        </Link>

        <ul className="ark-nav__links">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                className="ark-nav__link"
                href={l.href}
                aria-current={pathname === l.href ? "page" : undefined}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="ark-nav__actions">
          <WalletBar />
        </div>
      </div>
    </nav>
  );
}
