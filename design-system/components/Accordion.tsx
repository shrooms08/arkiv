"use client";

// Interactive: this component holds state or forwards a ref, so it has to run
// on the client. Without the directive a React Server Component that renders it
// fails at request time with "useState is not a function" — a runtime 500, not
// a build error, so it is only visible once a page actually renders.

import * as React from "react";

export interface AccordionItem {
  id: string;
  question: string;
  answer: React.ReactNode;
}

export interface AccordionProps {
  items?: AccordionItem[];
  /** Ids open on first render. */
  defaultOpen?: string[];
  /** Opening one closes the others. */
  single?: boolean;
  className?: string;
}

/**
 * Disclosure list.
 *
 * Rendered as real `<button aria-expanded>` triggers with an id-linked panel.
 * The reference ships its FAQ as static heading/paragraph pairs with no
 * interactive or ARIA markup, which is not keyboard operable — worth not
 * reproducing.
 */
export function Accordion({
  items = [],
  defaultOpen = [],
  single = false,
  className = "",
}: AccordionProps) {
  const [open, setOpen] = React.useState<string[]>(defaultOpen);

  function toggle(id: string) {
    setOpen((prev) => {
      const isOpen = prev.includes(id);
      if (single) return isOpen ? [] : [id];
      return isOpen ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }

  return (
    <div className={`ark ark-accordion ${className}`.trim()}>
      {items.map((item) => {
        const isOpen = open.includes(item.id);
        return (
          <div className="ark-accordion__item" key={item.id}>
            <h3 style={{ margin: 0 }}>
              <button
                type="button"
                className="ark-accordion__trigger"
                aria-expanded={isOpen}
                aria-controls={`ark-panel-${item.id}`}
                id={`ark-trigger-${item.id}`}
                onClick={() => toggle(item.id)}
              >
                {item.question}
                <span className="ark-accordion__marker" aria-hidden="true" />
              </button>
            </h3>
            <div
              className="ark-accordion__panel"
              id={`ark-panel-${item.id}`}
              role="region"
              aria-labelledby={`ark-trigger-${item.id}`}
              hidden={!isOpen}
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AccordionDemo() {
  return (
    <div style={{ maxWidth: "var(--container-prose)" }}>
      <Accordion
        defaultOpen={["what"]}
        items={[
          {
            id: "what",
            question: "What is a thesis basket?",
            answer:
              "A written claim about the world, turned into a fixed set of tokenised equity weights and a falsifier that says what would prove it wrong. The weights never change, so what happens next is a record of whether the claim held.",
          },
          {
            id: "falsifier",
            question: "Why is a falsifier mandatory?",
            answer:
              "Because a thesis you cannot lose is not a thesis. Every basket names an observable and a breach condition at filing time, so being wrong is discoverable later rather than arguable.",
          },
          {
            id: "exit",
            question: "What happens if I want to exit?",
            answer:
              "Redemption is in kind and pays your pro-rata slice of every leg. It touches no pool, so it is not exposed to liquidity, and it can never be paused.",
          },
        ]}
      />
    </div>
  );
}

export default Accordion;
