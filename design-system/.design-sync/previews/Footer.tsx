import { Footer, demoTheses } from "@arkiv/design-system";

const DISCLOSURE =
  "Tokenised equities are tracker certificates, not shares. The underlying wrappers are upgradeable by a 2-of-3 multisig. Nothing here is investment advice.";

/** The standing footer: disclosure, two link columns, and the archive's current extent. */
export function Full() {
  return (
    <div className="ark">
      <Footer
        basketCount={demoTheses.length}
        note={DISCLOSURE}
        columns={[
          {
            heading: "Product",
            links: [
              { label: "Archive", href: "/archive" },
              { label: "Write a thesis", href: "/" },
              { label: "Falsifier ledger", href: "/falsifiers" },
            ],
          },
          {
            heading: "Docs",
            links: [
              { label: "Underwriting rubric", href: "/docs/underwriting" },
              { label: "Risks", href: "/docs/risks" },
              { label: "Contract addresses", href: "/docs/contracts" },
            ],
          },
        ]}
      />
    </div>
  );
}

/** Disclosure only — the pre-launch page has nothing to link to yet. */
export function NoteOnly() {
  return (
    <div className="ark">
      <Footer note={DISCLOSURE} />
    </div>
  );
}

/** Serial emphasis: the latest filed index reads as the archive's extent. */
export function WithExtent() {
  return (
    <div className="ark">
      <Footer
        basketCount={42}
        note={DISCLOSURE}
        columns={[
          {
            heading: "Docs",
            links: [
              { label: "Underwriting rubric", href: "/docs/underwriting" },
              { label: "Risks", href: "/docs/risks" },
            ],
          },
        ]}
      />
    </div>
  );
}
