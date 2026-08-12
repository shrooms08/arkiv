import { SerialNumber } from "./SerialNumber";

export interface FalsifierBlockProps {
  /** The assertion, in the author's terms. */
  claim?: string;
  /** The instrument: what is measured, where, how often. */
  observable?: string;
  /** The trigger that would make the claim false. */
  breachCondition?: string;
  /** Horizon as filed, e.g. "12M". */
  horizon?: string;
  /** Basket index, for the header's serial. */
  index?: number;
  /** 0–1. Fraction of the horizon elapsed. */
  progress?: number;
  /** Horizon has passed. Renders the resolved state. */
  resolved?: boolean;
  /** Set when a resolved falsifier was in fact breached. */
  breached?: boolean;
  filedOn?: string;
  className?: string;
}

/**
 * The falsifier, laid out as a filed clause rather than as body copy.
 *
 * Three labelled parts, each visually distinct: the claim is the assertion
 * (medium weight, plain surface), the observable is the instrument (mono, on a
 * sunken surface, because it is a measurement procedure), the breach is the
 * trigger (purple surface, purple text). The serial sits in the header and the
 * horizon runs as a thin ruled track, not a progress bar with a fill gradient.
 *
 * A resolved block drops the purple entirely and reads as archived — the point
 * of a horizon is that it ends, and a clause that has expired should not keep
 * claiming attention.
 */
export function FalsifierBlock({
  claim = "",
  observable = "",
  breachCondition = "",
  horizon = "",
  index = 0,
  progress = 0,
  resolved = false,
  breached = false,
  filedOn,
  className = "",
}: FalsifierBlockProps) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const status = resolved ? (breached ? "Breached" : "Held") : "Open";

  return (
    <section
      className={[
        "ark-falsifier",
        resolved ? "ark-falsifier--resolved" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Falsifier"
    >
      <header className="ark-falsifier__header">
        <span className="ark-falsifier__title">Falsifier · {status}</span>
        <SerialNumber index={index} />
      </header>

      <div className="ark-falsifier__parts">
        <div className="ark-falsifier__part ark-falsifier__part--claim">
          <span className="ark-falsifier__label">Claim</span>
          <p className="ark-falsifier__text">{claim}</p>
        </div>
        <div className="ark-falsifier__part ark-falsifier__part--observable">
          <span className="ark-falsifier__label">Observable</span>
          <p className="ark-falsifier__text">{observable}</p>
        </div>
        <div className="ark-falsifier__part ark-falsifier__part--breach">
          <span className="ark-falsifier__label">Breach condition</span>
          <p className="ark-falsifier__text">{breachCondition}</p>
        </div>
      </div>

      <div className="ark-falsifier__horizon">
        <div className="ark-falsifier__track">
          <div className="ark-falsifier__fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="ark-falsifier__ticks">
          <span>{filedOn ? `Filed ${filedOn}` : "Filed"}</span>
          <span>
            {horizon}
            {resolved ? " · resolved" : ` · ${Math.round(pct)}% elapsed`}
          </span>
        </div>
      </div>
    </section>
  );
}

export function FalsifierBlockDemo() {
  return (
    <div className="ark ark-stack" style={{ gap: "var(--space-6)", maxWidth: "var(--container-prose)" }}>
      <FalsifierBlock
        index={3}
        filedOn="2026-08-11"
        horizon="12M"
        progress={0.34}
        claim="Falling rates will cause small caps to outperform large caps over the next 12 months because rate relief mechanically reduces floating-rate interest expense, improving earnings for the Russell 2000 relative to the S&P 500."
        observable="Rolling 12-month total return of IWMx versus SPYx, measurable at any month-end with publicly available ETF data."
        breachCondition="IWMx total return trails SPYx total return by more than 5 percentage points over the 12-month window ending at horizon."
      />
      <FalsifierBlock
        index={2}
        filedOn="2025-08-11"
        horizon="12M"
        progress={1}
        resolved
        breached
        claim="Gold will outperform the S&P 500 over 12 months because real rates fall as central banks ease into above-target inflation."
        observable="Rolling 12-month total return of GLDx versus SPYx, measured at month-end alongside published headline CPI."
        breachCondition="Headline CPI prints below 2.5% for three consecutive months while GLDx trails SPYx by more than 5 percentage points."
      />
    </div>
  );
}

export default FalsifierBlock;
