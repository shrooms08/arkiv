"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
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
    <main className="page-home">
      <h1>What do you believe?</h1>
      <p className="muted">
        Write it in your own words. Arkiv turns it into a basket you can hold, and a
        falsifier that will tell you later whether you were right.
      </p>

      <form className="thesis-form" onSubmit={submit}>
        <label htmlFor="thesis">Your thesis</label>
        <textarea
          id="thesis"
          className="thesis-input"
          rows={7}
          value={thesis}
          minLength={20}
          maxLength={2000}
          required
          placeholder="e.g. AI infrastructure spending keeps compounding, and the constraint is power and packaging capacity rather than demand…"
          onChange={(e) => setThesis(e.target.value)}
        />
        <p className="muted thesis-counter">{thesis.length} / 2000</p>

        <button className="thesis-submit" type="submit" disabled={pending || thesis.length < 20}>
          {pending ? "Underwriting…" : "Underwrite"}
        </button>
      </form>

      {error && (
        <div className="error underwrite-error" role="alert">
          <p>{error}</p>
          {violations.length > 0 && (
            <>
              <p className="muted">
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

      <p className="muted">
        Not investment advice. The underwriter has no market data and cannot verify its
        own claims — see the{" "}
        <a href="https://github.com/arkiv/docs/UNDERWRITING.md">published rubric</a>.
      </p>
    </main>
  );
}
