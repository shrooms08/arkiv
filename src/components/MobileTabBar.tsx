"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ArkivMark } from "@ds";

const TABS = [
  { href: "/app", label: "Write" },
  { href: "/app/archive", label: "Archive" },
  { href: "/app/positions", label: "Positions" },
];

/**
 * Bottom tab bar, below 768px only.
 *
 * The top nav is a desktop pattern: on a phone the reachable third of the
 * screen is the bottom, and putting primary navigation at the top means
 * stretching for it on every route change.
 *
 * It does not hide on scroll. Auto-hiding chrome demos well and then makes
 * people hunt for navigation that was there a second ago, which is a bad trade
 * for the small amount of vertical space it buys back.
 *
 * Active state is the same `aria-current="page"` treatment the desktop nav
 * already uses, so there is one definition of "you are here".
 */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="Primary, mobile">
      <ul className="tabbar__list">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href} className="tabbar__item">
              <Link
                className="tabbar__link"
                href={t.href}
                aria-current={active ? "page" : undefined}
              >
                <ArkivMark size={18} variant={active ? "standard" : "small"} />
                <span className="tabbar__label">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
