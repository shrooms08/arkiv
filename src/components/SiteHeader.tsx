"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChainId } from "wagmi";

import { Badge } from "@ds";
import { chainUsesMocks } from "@/lib/chain/chains";
import { WalletBar } from "./WalletBar";

const LINKS = [
  { href: "/app", label: "Write" },
  { href: "/app/archive", label: "Archive" },
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
  const network = chainUsesMocks(chainId) ? "X Layer testnet" : null;

  return (
    <nav className="ark ark-nav" aria-label="Primary">
      <div className="ark-container ark-nav__inner">
        <Link className="ark-nav__brand" href="/app">
          Arkiv
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
