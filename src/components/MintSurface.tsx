"use client";

import { useState } from "react";

import { MintPanel } from "@/components/MintPanel";
import { MobileActionSheet } from "@/components/MobileActionSheet";
import { useCompact } from "@/lib/ui/useCompact";
import type { Thesis } from "@/lib/underwriting/schema";

/**
 * The underwrite route's mint surface.
 *
 * Exists so the page can stay a server component while the decision about
 * where the panel is mounted, inline or in a sheet, happens on the client
 * where the viewport is actually known.
 */
export function MintSurface({ thesis, thesisHash }: { thesis: Thesis; thesisHash: string }) {
  const compact = useCompact();
  const [amount, setAmount] = useState("");

  if (!compact) return <MintPanel thesis={thesis} thesisHash={thesisHash} />;

  return (
    <MobileActionSheet title="Mint" action={`Mint ${thesis.ticker}`} detail={amount}>
      <MintPanel thesis={thesis} thesisHash={thesisHash} onAmountChange={setAmount} />
    </MobileActionSheet>
  );
}
