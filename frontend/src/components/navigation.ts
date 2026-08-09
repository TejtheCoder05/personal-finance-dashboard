import {
  IconAlert,
  IconAnalytics,
  IconOverview,
  IconTransactions,
} from "@/components/ui/Icons";

/*
  Shared by the desktop rail and the mobile menu so the two never drift.
  The dashboard is a single view, so each entry points at a section already
  on the page rather than a route — every panel stays mounted and no data
  fetching changes.
*/
export const NAV_ITEMS = [
  { label: "Overview", targetId: "dashboard", Icon: IconOverview },
  {
    label: "Transactions",
    targetId: "section-transactions",
    Icon: IconTransactions,
  },
  { label: "Analytics", targetId: "section-spending", Icon: IconAnalytics },
  { label: "Anomalies", targetId: "section-anomalies", Icon: IconAlert },
] as const;

/**
 * Module-level so the scroll-spy effect gets a stable reference and does not
 * re-subscribe on every render.
 */
export const NAV_TARGET_IDS: readonly string[] = NAV_ITEMS.map(
  (item) => item.targetId,
);
