"use client";

import { useEffect, useState } from "react";

/** The mobile breakpoint, matching the CSS. One definition, not two. */
export const COMPACT_QUERY = "(max-width: 47.99rem)";

/**
 * True below 768px.
 *
 * Used to decide where the mint panel is mounted rather than to hide a second
 * copy of it: rendering the panel twice would double its chain reads and give
 * two components the same wallet state. Starts false so the server render and
 * the first client render agree, then corrects on mount.
 */
export function useCompact(): boolean {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return compact;
}
