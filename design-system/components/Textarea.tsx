import * as React from "react";

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  label?: string;
  hint?: string;
  error?: string;
  /** The product's front door. Larger type, heavier rest state, real focus. */
  thesis?: boolean;
  /** Shows a live character counter when `maxLength` is set. */
  showCount?: boolean;
  className?: string;
}

let uid = 0;
function useId(provided?: string) {
  const [generated] = React.useState(() => `ark-textarea-${++uid}`);
  return provided ?? generated;
}

/**
 * The thesis field is where the product actually starts, so `thesis` gives it a
 * treatment no other input gets: larger type, a 2px resting border, and a focus
 * state that lifts the field off the page rather than tinting its outline.
 * A timid box invites a timid sentence.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      label,
      hint,
      error,
      thesis = false,
      showCount = false,
      maxLength,
      id,
      value,
      defaultValue,
      onChange,
      className = "",
      ...rest
    },
    ref,
  ) {
    const areaId = useId(id);
    const isControlled = value !== undefined;
    const [internal, setInternal] = React.useState(String(defaultValue ?? ""));
    const current = isControlled ? String(value) : internal;

    const describedBy = error
      ? `${areaId}-error`
      : hint
        ? `${areaId}-hint`
        : undefined;

    return (
      <div className="ark ark-field">
        {label && (
          <label className="ark-field__label" htmlFor={areaId}>
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={areaId}
          className={`ark-textarea ${thesis ? "ark-textarea--thesis" : ""} ${className}`.trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          maxLength={maxLength}
          value={isControlled ? value : internal}
          onChange={(e) => {
            if (!isControlled) setInternal(e.target.value);
            onChange?.(e);
          }}
          {...rest}
        />
        {showCount && maxLength ? (
          <span className="ark-field__counter">
            {current.length} / {maxLength}
          </span>
        ) : null}
        {error ? (
          <span className="ark-field__hint ark-field__hint--error" id={`${areaId}-error`}>
            {error}
          </span>
        ) : hint ? (
          <span className="ark-field__hint" id={`${areaId}-hint`}>
            {hint}
          </span>
        ) : null}
      </div>
    );
  },
);

export function TextareaDemo() {
  return (
    <div className="ark-stack" style={{ maxWidth: "var(--container-prose)" }}>
      <Textarea
        thesis
        showCount
        maxLength={2000}
        label="What do you believe?"
        placeholder="Write the claim you want on the record, and what would prove it wrong."
        defaultValue={
          "Everyone is obsessed with megacap tech but I think the interesting move over the next year is small caps catching a bid as rates come down. Big tech is priced for perfection. I still want some index exposure because I might be early, but I want the tilt to be real."
        }
        hint="The underwriter turns this into weights and a mandatory falsifier."
      />
      <Textarea label="Note" placeholder="Optional" rows={3} />
    </div>
  );
}

export default Textarea;
