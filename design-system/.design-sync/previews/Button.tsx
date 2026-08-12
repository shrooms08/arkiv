import { Button } from "@arkiv/design-system";

const row: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  flexWrap: "wrap",
  alignItems: "center",
};

/** The four variants. `verdict` is purple and deliberately rare — falsifier actions only. */
export function Variants() {
  return (
    <div className="ark" style={row}>
      <Button variant="primary">Mint basket</Button>
      <Button variant="secondary">View composition</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="verdict">Record breach</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="ark" style={row}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  );
}

export function States() {
  return (
    <div className="ark" style={row}>
      <Button loading>Minting</Button>
      <Button disabled>Unavailable</Button>
      <Button variant="secondary" disabled>
        Unavailable
      </Button>
    </div>
  );
}
