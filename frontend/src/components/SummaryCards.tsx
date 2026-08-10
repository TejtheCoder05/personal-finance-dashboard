"use client";

import { useEffect, useState } from "react";

import { getSpendingSummary } from "@/lib/api";
import type { SpendingSummary } from "@/types/finance";
import { useDataSource } from "@/components/DataSourceProvider";
import { ErrorState, LoadingRegion, Skeleton } from "@/components/ui/States";
import { IconAlert } from "@/components/ui/Icons";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const numberFormatter = new Intl.NumberFormat("en-US");

// Stays 2-up until xl: at lg the sidebar leaves each of four columns too
// narrow for a full currency value at this type size.
const GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

export default function SummaryCards() {
  const { dataset } = useDataSource();
  const [summary, setSummary] = useState<SpendingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true);
        setError(null);

        const data = await getSpendingSummary(dataset?.dataset_id);
        setSummary(data);
      } catch (err) {
        console.error(err);
        setError(
          "Unable to load summary data. Make sure the FastAPI server is running.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [dataset?.dataset_id]);

  if (loading) {
    return (
      <LoadingRegion label="Loading spending summary" className={GRID}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-panel border border-hairline bg-surface p-5 shadow-panel"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-5 h-9 w-32" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </LoadingRegion>
    );
  }

  if (error || !summary) {
    return (
      <ErrorState
        title="Could not connect to the finance API"
        message={error}
      />
    );
  }

  const metrics = [
    {
      label: "Total Spending",
      value: currencyFormatter.format(summary.total_spending),
      description: "Across all transactions",
      alert: false,
      // Headline figure of the row — gets the accent bloom.
      lead: true,
    },
    {
      label: "Transactions",
      value: numberFormatter.format(summary.transaction_count),
      description: "Processed transactions",
      alert: false,
      lead: false,
    },
    {
      label: "Average Transaction",
      value: currencyFormatter.format(summary.average_transaction),
      description: `Median ${currencyFormatter.format(
        summary.median_transaction,
      )}`,
      alert: false,
      lead: false,
    },
    {
      label: "Anomalies Detected",
      value: numberFormatter.format(summary.anomaly_count),
      description: `${(summary.anomaly_rate * 100).toFixed(1)}% anomaly rate`,
      // The one risk metric in the row: flagged with a border and an icon, not
      // colour alone, so it reads as different in greyscale too.
      alert: summary.anomaly_count > 0,
      lead: false,
    },
  ];

  return (
    <div className={GRID}>
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={`group relative overflow-hidden rounded-panel border bg-surface p-5 shadow-panel transition-colors duration-200 ${
            metric.alert
              ? "border-caution-line"
              : "border-hairline hover:border-hairline-strong"
          }`}
        >
          {/* The lead metric carries the accent bloom, as in the reference. */}
          {metric.lead && (
            <span
              aria-hidden="true"
              className="bloom pointer-events-none absolute inset-x-0 -bottom-6 h-24"
            />
          )}

          <div className="relative flex items-center gap-1.5">
            <p className="text-[0.8125rem] font-medium text-ink-2">
              {metric.label}
            </p>

            {metric.alert && (
              <IconAlert size={13} className="shrink-0 text-caution" />
            )}
          </div>

          <p className="numeric relative mt-4 text-[2rem] font-semibold leading-none tracking-[-0.02em] text-ink">
            {metric.value}
          </p>

          <p
            className={`numeric relative mt-3 text-xs ${
              metric.alert ? "font-medium text-caution" : "text-ink-3"
            }`}
          >
            {metric.description}
          </p>
        </div>
      ))}
    </div>
  );
}
