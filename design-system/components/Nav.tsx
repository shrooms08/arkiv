import { Badge } from "./Badge";
import { Button } from "./Button";

export interface NavLink {
  label: string;
  href: string;
  current?: boolean;
}

export interface NavProps {
  brand?: string;
  links?: NavLink[];
  /** Small marker next to the brand, e.g. the connected network. */
  networkLabel?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Top chrome. Structure blue marks the current page and nothing else —
 * navigation is structure, so it never uses verdict gold.
 */
export function Nav({
  brand = "Arkiv",
  links = [],
  networkLabel,
  actionLabel = "Connect wallet",
  onAction,
  className = "",
}: NavProps) {
  return (
    <nav className={`ark ark-nav ${className}`.trim()} aria-label="Primary">
      <div className="ark-container ark-nav__inner">
        <a className="ark-nav__brand" href="/">
          {brand}
          {networkLabel && <Badge tone="neutral">{networkLabel}</Badge>}
        </a>

        <ul className="ark-nav__links">
          {links.map((l) => (
            <li key={l.href}>
              <a
                className="ark-nav__link"
                href={l.href}
                aria-current={l.current ? "page" : undefined}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ark-nav__actions">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </nav>
  );
}

export function NavDemo() {
  return (
    <Nav
      brand="Arkiv"
      networkLabel="X Layer Testnet"
      links={[
        { label: "Archive", href: "/archive", current: true },
        { label: "Write a thesis", href: "/" },
        { label: "Risks", href: "/risks" },
      ]}
    />
  );
}

export default Nav;
