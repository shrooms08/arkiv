import { Nav } from "@arkiv/design-system";

/** The archive page: structure blue marks the current link and nothing else. */
export function Primary() {
  return (
    <div className="ark">
      <Nav
        brand="Arkiv"
        networkLabel="X Layer Testnet"
        links={[
          { label: "Archive", href: "/archive", current: true },
          { label: "Write a thesis", href: "/" },
          { label: "Risks", href: "/risks" },
        ]}
      />
    </div>
  );
}

/** Connected state: the action slot carries the truncated wallet, current page moves. */
export function Connected() {
  return (
    <div className="ark">
      <Nav
        brand="Arkiv"
        networkLabel="X Layer Testnet"
        actionLabel="0xF62a…6958"
        links={[
          { label: "Archive", href: "/archive" },
          { label: "Write a thesis", href: "/", current: true },
          { label: "Risks", href: "/risks" },
        ]}
      />
    </div>
  );
}

/** Minimal chrome: no network marker, no links — the pre-launch landing page. */
export function Minimal() {
  return (
    <div className="ark">
      <Nav brand="Arkiv" actionLabel="Connect wallet" />
    </div>
  );
}
