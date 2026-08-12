"use client";

import { useEffect, useState } from "react";
import { useChainId, usePublicClient } from "wagmi";

import { Footer } from "@ds";
import { deploymentFor } from "@/lib/chain/deployments";
import { fetchBasketCount } from "@/lib/chain/archive";

const NOTE =
  "An archive of investment theses, each filed with a condition that would prove it wrong. Testnet only. Nothing here is investment advice or a security.";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Write a thesis", href: "/" },
      { label: "Archive", href: "/archive" },
    ],
  },
  {
    heading: "Docs",
    links: [
      { label: "Underwriting rubric", href: "https://github.com/arkiv/docs/UNDERWRITING.md" },
      { label: "Risks", href: "https://github.com/arkiv/docs/RISKS.md" },
    ],
  },
];

/**
 * Site footer. The basket count is read from the registry so the "latest serial"
 * line is the archive's real extent rather than a number typed into markup.
 */
export function SiteFooter() {
  const client = usePublicClient();
  const chainId = useChainId();
  const deployment = deploymentFor(chainId);
  const [count, setCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!client || !deployment) {
      setCount(undefined);
      return;
    }
    fetchBasketCount(client, deployment.arkiv)
      .then((n) => !cancelled && setCount(n))
      .catch(() => !cancelled && setCount(undefined));
    return () => {
      cancelled = true;
    };
  }, [client, deployment]);

  return <Footer brand="Arkiv" note={NOTE} columns={COLUMNS} basketCount={count} />;
}
