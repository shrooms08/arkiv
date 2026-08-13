"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface MobileActionSheetProps {
  /** Short label for the anchored bar, e.g. "Mint CAPEXPAY". */
  action: string;
  /** Secondary line on the bar, e.g. the amount. */
  detail?: string;
  title: string;
  children: ReactNode;
}

/**
 * Bottom-anchored action bar that opens a bottom sheet, below 768px only.
 *
 * The invest panel stacks below the content at mobile, which is correct
 * document order and wrong ergonomics: the thing someone came to do ends up
 * several screens below the thing that convinced them to do it. The bar keeps
 * the action reachable without moving the panel out of the reading order.
 *
 * A sheet rather than a centred modal, because that is the platform pattern on
 * both iOS and Android and a centred dialog on a phone reads as a web page
 * pretending to be an app.
 *
 * Dismissable by swipe down AND by an explicit control. Swipe alone is
 * undiscoverable, and a sheet with no visible way out is a trap.
 */
export function MobileActionSheet({ action, detail, title, children }: MobileActionSheetProps) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  // Lock the page behind the sheet. Without this the document scrolls under the
  // sheet on iOS and the user loses their place in the page they came from.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function onTouchStart(e: React.TouchEvent) {
    // Only start a drag from the top of the sheet, so a swipe inside the
    // scrollable body scrolls it rather than dismissing the whole thing.
    dragStart.current = e.touches[0]!.clientY;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (dragStart.current === null) return;
    const dy = e.touches[0]!.clientY - dragStart.current;
    if (dy > 0) setDragY(dy);
  }

  function onTouchEnd() {
    // A third of the sheet is a deliberate commitment; anything less springs
    // back, so a stray scroll never closes it.
    if (dragY > (sheetRef.current?.offsetHeight ?? 400) / 3) setOpen(false);
    dragStart.current = null;
    setDragY(0);
  }

  return (
    <>
      <div className="actionbar">
        <div className="actionbar__text">
          <span className="app-label">{title}</span>
          {detail && <span className="actionbar__detail">{detail}</span>}
        </div>
        <button
          type="button"
          className="ark-btn ark-btn--primary actionbar__open"
          onClick={() => setOpen(true)}
        >
          {action}
        </button>
      </div>

      {open && (
        <div className="sheet-root" role="dialog" aria-modal="true" aria-label={title}>
          <button
            type="button"
            className="sheet-scrim"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            className="sheet"
            ref={sheetRef}
            style={dragY ? { transform: `translateY(${dragY}px)`, transition: "none" } : undefined}
          >
            <div
              className="sheet__grip"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <span className="sheet__handle" aria-hidden="true" />
            </div>
            <div className="sheet__head">
              <h2 className="sheet__title">{title}</h2>
              <button type="button" className="sheet__close" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <div className="sheet__body">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
