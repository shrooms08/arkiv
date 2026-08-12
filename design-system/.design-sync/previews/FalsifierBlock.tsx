import { FalsifierBlock, scrate, stickyinf } from "@arkiv/design-system";

const frame: React.CSSProperties = {
  maxWidth: "var(--container-prose)",
};

/** Open clause: gold breach panel, horizon track part-elapsed. */
export function Open() {
  return (
    <div className="ark" style={frame}>
      <FalsifierBlock
        index={scrate.index}
        filedOn="2026-08-11"
        horizon={scrate.falsifier.horizon}
        progress={0.34}
        claim={scrate.falsifier.claim}
        observable={scrate.falsifier.observable}
        breachCondition={scrate.falsifier.breachCondition}
      />
    </div>
  );
}

/** Resolved and breached: the gold drops out entirely and the block reads as archived. */
export function ResolvedBreached() {
  return (
    <div className="ark" style={frame}>
      <FalsifierBlock
        index={stickyinf.index}
        filedOn="2025-08-11"
        horizon={stickyinf.falsifier.horizon}
        progress={1}
        resolved
        breached
        claim={stickyinf.falsifier.claim}
        observable={stickyinf.falsifier.observable}
        breachCondition={stickyinf.falsifier.breachCondition}
      />
    </div>
  );
}

/** Resolved and held — same archived treatment, "Held" in the header. */
export function ResolvedHeld() {
  return (
    <div className="ark" style={frame}>
      <FalsifierBlock
        index={1}
        filedOn="2025-08-11"
        horizon="12M"
        progress={1}
        resolved
        claim="Accelerator and networking suppliers will outperform the broad index over 12 months because hyperscaler capex growth exceeds supply expansion."
        observable="Rolling 12-month total return of an equal-weight NVDAx/AVGOx pair versus SPYx, measured at month-end."
        breachCondition="The NVDAx/AVGOx pair trails SPYx by more than 8 percentage points over the 12-month window."
      />
    </div>
  );
}
