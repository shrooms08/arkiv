"use client";

import { Accordion, type AccordionItem } from "@ds";

export function FaqAccordion({ items }: { items?: AccordionItem[] }) {
  return <Accordion items={items ?? []} single />;
}
