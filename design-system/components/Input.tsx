import * as React from "react";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
}

let uid = 0;
function useId(provided?: string) {
  const [generated] = React.useState(() => `ark-input-${++uid}`);
  return provided ?? generated;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, hint, error, id, className = "", ...rest }, ref) {
    const inputId = useId(id);
    const describedBy = error
      ? `${inputId}-error`
      : hint
        ? `${inputId}-hint`
        : undefined;

    return (
      <div className="ark ark-field">
        {label && (
          <label className="ark-field__label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`ark-input ${className}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {error ? (
          <span className="ark-field__hint ark-field__hint--error" id={`${inputId}-error`}>
            {error}
          </span>
        ) : hint ? (
          <span className="ark-field__hint" id={`${inputId}-hint`}>
            {hint}
          </span>
        ) : null}
      </div>
    );
  },
);

export function InputDemo() {
  return (
    <div className="ark-stack" style={{ maxWidth: "var(--container-prose)" }}>
      <Input label="Ticker" placeholder="SCRATE" hint="2–10 characters, uppercase." />
      <Input
        label="Amount (USDG)"
        defaultValue="500"
        inputMode="decimal"
        hint="Minimum first mint is enforced on chain."
      />
      <Input label="Ticker" defaultValue="scr ate" error="Ticker cannot contain spaces." />
      <Input label="Disabled" defaultValue="—" disabled />
    </div>
  );
}

export default Input;
