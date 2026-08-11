import type { Address } from "viem";

import { BasketView } from "@/components/BasketView";

export default async function BasketPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  return (
    <main className="page-basket">
      <BasketView address={address as Address} />
    </main>
  );
}
