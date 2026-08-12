import Link from "next/link";

import { ArkivMark } from "@ds";

/**
 * Marketing chrome. No wallet, no network badge, no product nav.
 *
 * The landing page is not the product and should not pretend to be: a connect
 * button here would ask for a signature before anyone has been told what the
 * thing does. One route out, into the app.
 */
export function MarketingHeader() {
  return (
    <nav className="ark ark-nav" aria-label="Primary">
      <div className="ark-container ark-nav__inner">
        <Link
          className="ark-nav__brand ark-lockup"
          href="/"
          style={{ ["--lockup-cap" as string]: "16px" }}
          aria-label="Arkiv, home"
        >
          <ArkivMark size={16} crop="tight" />
          <span className="ark-lockup__word">ARKIV</span>
        </Link>
        <ul className="ark-nav__links">
          <li>
            <a className="ark-nav__link" href="#how">How it works</a>
          </li>
          <li>
            <a className="ark-nav__link" href="#questions">Questions</a>
          </li>
        </ul>
        <div className="ark-nav__actions">
          <Link className="ark-btn ark-btn--primary ark-btn--sm" href="/app">
            Open the app
          </Link>
        </div>
      </div>
    </nav>
  );
}
