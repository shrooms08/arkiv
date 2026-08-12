import { SerialNumber } from "./SerialNumber";

export interface FooterColumn {
  heading: string;
  links: { label: string; href: string }[];
}

export interface FooterProps {
  brand?: string;
  /** The standing disclosure. Kept in the footer on every page. */
  note?: string;
  columns?: FooterColumn[];
  /** Total baskets filed; rendered as the archive's current extent. */
  basketCount?: number;
  className?: string;
}

export function Footer({
  brand = "Arkiv",
  note,
  columns = [],
  basketCount,
  className = "",
}: FooterProps) {
  return (
    <footer className={`ark ark-footer ${className}`.trim()}>
      <div className="ark-container">
        <div className="ark-footer__grid">
          <div className="ark-footer__col">
            <span className="ark-footer__heading">{brand}</span>
            {note && <p className="ark-footer__note">{note}</p>}
          </div>
          {columns.map((col) => (
            <div className="ark-footer__col" key={col.heading}>
              <span className="ark-footer__heading">{col.heading}</span>
              {col.links.map((l) => (
                <a className="ark-footer__link" href={l.href} key={l.href}>
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div className="ark-footer__bottom">
          <span className="ark-footer__note" style={{ margin: 0 }}>
            An archive of investment theses.
          </span>
          {typeof basketCount === "number" && (
            <span style={{ display: "inline-flex", gap: "var(--space-2)", alignItems: "center" }}>
              <span className="ark-footer__heading">Latest</span>
              <SerialNumber index={basketCount} emphasis />
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}

export function FooterDemo() {
  return (
    <Footer
      basketCount={3}
      note="Tokenised equities are tracker certificates, not shares. The underlying wrappers are upgradeable by a 2-of-3 multisig. Nothing here is investment advice."
      columns={[
        {
          heading: "Product",
          links: [
            { label: "Archive", href: "/archive" },
            { label: "Write a thesis", href: "/" },
          ],
        },
        {
          heading: "Docs",
          links: [
            { label: "Underwriting rubric", href: "/docs/underwriting" },
            { label: "Risks", href: "/docs/risks" },
          ],
        },
      ]}
    />
  );
}

export default Footer;
