import { Input } from "@arkiv/design-system";

const stack: React.CSSProperties = { maxWidth: "var(--container-prose)" };

/** Resting state: label, placeholder and the hint that explains the constraint. */
export function Empty() {
  return (
    <div className="ark">
      <div className="ark-stack" style={stack}>
        <Input label="Ticker" placeholder="SCRATE" hint="2–10 characters, uppercase." />
        <Input
          label="Basket name"
          placeholder="Small Cap Rate Relief with Index Hedge"
          hint="Shown on the archive card and in the falsifier record."
        />
      </div>
    </div>
  );
}

/** Filled — the values a minter actually submits. */
export function Filled() {
  return (
    <div className="ark">
      <div className="ark-stack" style={stack}>
        <Input label="Ticker" defaultValue="SCRATE" hint="2–10 characters, uppercase." />
        <Input
          label="Amount (USDG)"
          defaultValue="500"
          inputMode="decimal"
          hint="Minimum first mint is enforced on chain."
        />
        <Input
          label="Primary expression"
          defaultValue="IWMx"
          hint="The holding the thesis lives or dies by."
        />
      </div>
    </div>
  );
}

/** Invalid — `error` replaces the hint and flips `aria-invalid` on the control. */
export function Invalid() {
  return (
    <div className="ark">
      <div className="ark-stack" style={stack}>
        <Input label="Ticker" defaultValue="scr ate" error="Ticker cannot contain spaces." />
        <Input
          label="Amount (USDG)"
          defaultValue="12"
          inputMode="decimal"
          error="First mint must be at least 100 USDG."
        />
      </div>
    </div>
  );
}

/** Disabled and read-only — chain-derived fields the writer cannot edit. */
export function Disabled() {
  return (
    <div className="ark">
      <div className="ark-stack" style={stack}>
        <Input
          label="Wrapper address"
          defaultValue="0xF62aF5F56ba0Eb1D8e92EBf18ECE2cA1a44f6958"
          disabled
          hint="Resolved from the asset registry at mint time."
        />
        <Input label="Horizon" defaultValue="12M" disabled />
        <Input
          label="Thesis hash"
          defaultValue="de82aadb08bef443"
          readOnly
          hint="Recorded on chain when the basket was filed."
        />
      </div>
    </div>
  );
}
