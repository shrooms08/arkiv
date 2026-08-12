import { Textarea, scrate } from "@arkiv/design-system";

const stack: React.CSSProperties = { maxWidth: "var(--container-prose)" };

/**
 * The `thesis` treatment at rest: larger type, 2px border, live counter.
 * This is the product's front door, so the empty state has to look inviting.
 */
export function ThesisEmpty() {
  return (
    <div className="ark">
      <div className="ark-stack" style={stack}>
        <Textarea
          thesis
          showCount
          maxLength={2000}
          label="What do you believe?"
          placeholder="Write the claim you want on the record, and what would prove it wrong."
          hint="The underwriter turns this into weights and a mandatory falsifier."
        />
      </div>
    </div>
  );
}

/** The same field carrying a real, full-length thesis. */
export function ThesisFilled() {
  return (
    <div className="ark">
      <div className="ark-stack" style={stack}>
        <Textarea
          thesis
          showCount
          maxLength={2000}
          label="What do you believe?"
          defaultValue={
            "Everyone is obsessed with megacap tech but I think the interesting move over the next year is small caps catching a bid as rates come down. Big tech is priced for perfection. I still want some index exposure because I might be early, but I want the tilt to be real."
          }
          hint="The underwriter turns this into weights and a mandatory falsifier."
        />
      </div>
    </div>
  );
}

/** The plain treatment, next to the thesis one — the size difference is the point. */
export function Standard() {
  return (
    <div className="ark">
      <div className="ark-stack" style={stack}>
        <Textarea
          label="Falsifier claim"
          rows={4}
          defaultValue={scrate.falsifier.claim}
          hint="One sentence, checkable against a public observable."
        />
        <Textarea
          label="Note to future readers"
          rows={3}
          placeholder="Optional. Anything the underwriter should not have to infer."
        />
      </div>
    </div>
  );
}

/** Invalid and disabled — `error` supersedes the hint; disabled keeps its value legible. */
export function InvalidAndDisabled() {
  return (
    <div className="ark">
      <div className="ark-stack" style={stack}>
        <Textarea
          label="Breach condition"
          rows={3}
          defaultValue="IWMx goes down a lot"
          error="A breach condition needs a threshold and a window, not a direction."
        />
        <Textarea
          label="Breach condition (filed)"
          rows={3}
          defaultValue={scrate.falsifier.breachCondition}
          disabled
          hint="Locked once the basket is filed on chain."
        />
      </div>
    </div>
  );
}
