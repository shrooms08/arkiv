import { Accordion, Card, scrate, stickyinf } from "@arkiv/design-system";

/** The marketing FAQ, one panel open on load — the canonical use. */
export function Faq() {
  return (
    <div className="ark" style={{ maxWidth: "var(--container-prose)" }}>
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

/** Fully collapsed: the closed rhythm, every marker showing its plus. */
export function AllClosed() {
  return (
    <div className="ark" style={{ maxWidth: "var(--container-prose)" }}>
      <Accordion
        items={[
          {
            id: "weights",
            question: "Can the weights be changed after filing?",
            answer:
              "No. The weights are written once and the contract has no rebalance path, which is what makes the later price record evidence rather than commentary.",
          },
          {
            id: "custody",
            question: "Who holds the underlying tokenised equities?",
            answer:
              "The basket contract holds each wrapper directly. There is no pool and no intermediary vault, so redemption is a transfer rather than a swap.",
          },
          {
            id: "breach",
            question: "What happens when a falsifier is breached?",
            answer:
              "The breach is recorded against the basket's serial and the card drops its accent. Nothing is liquidated — the point of the record is that it survives being wrong.",
          },
          {
            id: "fees",
            question: "What does minting cost?",
            answer:
              "A single mint fee at filing, quoted in the settlement asset. There is no management fee, because there is no management.",
          },
        ]}
      />
    </div>
  );
}

/** `single` — opening one closes the others, so exactly one panel is ever open. */
export function SingleOpen() {
  return (
    <div className="ark" style={{ maxWidth: "var(--container-prose)" }}>
      <Accordion
        single
        defaultOpen={["observable"]}
        items={[
          {
            id: "claim",
            question: "Claim",
            answer: scrate.falsifier.claim,
          },
          {
            id: "observable",
            question: "Observable",
            answer: scrate.falsifier.observable,
          },
          {
            id: "breach",
            question: "Breach condition",
            answer: scrate.falsifier.breachCondition,
          },
        ]}
      />
    </div>
  );
}

/** Answers are ReactNode, not strings — here a holdings list inside a card. */
export function RichAnswers() {
  const t = stickyinf;
  return (
    <div className="ark" style={{ maxWidth: "var(--container-prose)" }}>
      <Card padded>
        <Accordion
          defaultOpen={["legs", "horizon"]}
          items={[
            {
              id: "legs",
              question: `What is in ${t.ticker}?`,
              answer: (
                <ul style={{ margin: 0, paddingInlineStart: "var(--space-5)" }}>
                  {t.holdings.map((h) => (
                    <li key={h.symbol} style={{ marginBlockEnd: "var(--space-1)" }}>
                      <strong style={{ color: "var(--color-ink)" }}>
                        {h.symbol} {h.weightBps / 100}%
                      </strong>{" "}
                      — {h.rationale}
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              id: "horizon",
              question: "How long does the claim run?",
              answer: (
                <p style={{ margin: 0 }}>
                  {t.falsifier.horizon} from filing. {t.falsifier.claim}
                </p>
              ),
            },
            {
              id: "breach",
              question: "What would prove it wrong?",
              answer: (
                <p style={{ margin: 0, fontFamily: "var(--font-mono)" }}>
                  {t.falsifier.breachCondition}
                </p>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
