"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Textarea } from "@ds";

const PLACEHOLDER =
  "I think the AI buildout is supply-constrained, not demand-constrained. Everyone is arguing about which companies will use AI best, but the money right now sits with whoever sells the parts that are actually scarce — the accelerators and the networking silicon between them. I want real exposure to the sellers of the bottleneck, hedged with broad index so this is not a single-name bet. Twelve months.";

/**
 * The product's front door.
 *
 * The submit path is unchanged: same endpoint, same body, same handling of
 * `violations` — a basket that broke the rules twice is reported, never
 * repaired. Only the presentation comes from the design system.
 */
export function ThesisComposer() {
  const router = useRouter();
  const [thesis, setThesis] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [violations, setViolations] = useState<{ rule: string; detail: string }[]>([]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setViolations([]);

    try {
      const res = await fetch("/api/underwrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thesis }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Underwriting failed.");
        setViolations(data.violations ?? []);
        return;
      }
      router.push(`/underwrite/${data.thesisHash}`);
    } catch {
      setError("Could not reach the underwriter.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="app-panel app-panel--raised thesis-form" onSubmit={submit}>
      <Textarea
        thesis
        showCount
        id="thesis"
        className="thesis-input"
        label="Your thesis"
        rows={9}
        value={thesis}
        minLength={20}
        maxLength={2000}
        required
        placeholder={PLACEHOLDER}
        onChange={(e) => setThesis(e.target.value)}
        hint="Write a paragraph, not a phrase. The underwriter needs a mechanism — what you think happens and why — to size the legs and to write a falsifier you could actually lose."
      />

      <div className="app-meta-row">
        <Button
          className="thesis-submit"
          type="submit"
          size="lg"
          loading={pending}
          disabled={pending || thesis.length < 20}
        >
          {pending ? "Underwriting…" : "Underwrite this thesis"}
        </Button>
        <span className="app-note">~20s · nothing is minted yet</span>
      </div>

      {error && (
        <div className="app-error underwrite-error" role="alert">
          <p style={{ margin: 0 }}>{error}</p>
          {violations.length > 0 && (
            <>
              <p style={{ margin: "var(--space-2) 0 0" }}>
                The basket broke these rules twice and was rejected rather than repaired:
              </p>
              <ul>
                {violations.map((v) => (
                  <li key={v.rule + v.detail}>
                    <strong>{v.rule}</strong> — {v.detail}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </form>
  );
}
