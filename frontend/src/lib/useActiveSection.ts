"use client";

import { useEffect, useState } from "react";

/**
 * Tracks which dashboard section is currently in reading position so the nav
 * can highlight it. Read-only: it observes scroll, it never moves the page —
 * the jump itself is a plain anchor, handled by the browser.
 */
export function useActiveSection(ids: readonly string[]): string {
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);

    if (elements.length === 0) {
      return;
    }

    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target.id);
          } else {
            visible.delete(entry.target.id);
          }
        }

        // Topmost visible section wins, so scrolling down promotes the next
        // section only once it actually reaches the band.
        const topmost = ids.find((id) => visible.has(id));
        if (topmost) {
          setActive(topmost);
        }
      },
      // The band starts below the sticky header and ends short of the fold.
      { rootMargin: "-80px 0px -55% 0px" },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}
