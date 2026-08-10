"use client";

import { useEffect, useState } from "react";

import { getAnomalies } from "@/lib/api";
import type { AnomalyTransaction } from "@/types/finance";
import { useDataSource } from "@/components/DataSourceProvider";
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "@/components/ui/States";
import { IconAlert, IconShield } from "@/components/ui/Icons";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMerchantName(merchant: string) {
  return merchant
    .split(" ")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function formatDate(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsedDate);
}

/*
  Severity carries a word as well as a colour — the previous version encoded it
  in the chip tint alone, which is invisible to colourblind users and in print.
  Thresholds are unchanged.
*/
function getSeverity(score: number) {
  if (score >= 90) {
    return {
      label: "High",
      chip: "border-critical-line bg-critical-soft text-critical",
      rule: "bg-critical",
    };
  }

  if (score >= 75) {
    return {
      label: "Elevated",
      chip: "border-caution-line bg-caution-soft text-caution",
      rule: "bg-caution",
    };
  }

  return {
    label: "Moderate",
    chip: "border-hairline bg-surface-2 text-ink-2",
    rule: "bg-ink-3",
  };
}

export default function AnomalyAlerts() {
  const { dataset } = useDataSource();
  const [anomalies, setAnomalies] = useState<AnomalyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAnomalies() {
      try {
        setLoading(true);
        setError(null);

        const data = await getAnomalies(dataset?.dataset_id);
        setAnomalies(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load anomaly data.");
      } finally {
        setLoading(false);
      }
    }

    loadAnomalies();
  }, [dataset?.dataset_id]);

  if (loading) {
    return (
      <LoadingRegion label="Loading anomalies" className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-hairline p-4"
          >
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>

            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        ))}
      </LoadingRegion>
    );
  }

  if (error) {
    return <ErrorState title="Could not load anomalies" message={error} />;
  }

  if (anomalies.length === 0) {
    return (
      <EmptyState
        title="No anomalies detected"
        message="Nothing in this dataset was flagged as unusual spending."
        icon={<IconShield size={18} />}
      />
    );
  }

  const topAnomalies = anomalies.slice(0, 4);

  return (
    <div>
      <ul className="space-y-3">
        {topAnomalies.map((anomaly) => {
          const severity = getSeverity(anomaly.anomaly_score);

          return (
            <li
              key={`${anomaly.date}-${anomaly.merchant}-${anomaly.amount}`}
              className="relative overflow-hidden rounded-xl border border-hairline bg-inset p-4 transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-2"
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-0.5 ${severity.rule}`}
              />

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">
                      {formatMerchantName(anomaly.merchant)}
                    </p>

                    <span className="rounded-full border border-hairline bg-surface-2 px-2.5 py-0.5 text-[0.6875rem] font-medium text-ink-2">
                      {anomaly.category}
                    </span>
                  </div>

                  <p className="numeric mt-1 text-xs text-ink-3">
                    {formatDate(anomaly.date)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="numeric text-sm font-semibold text-ink">
                    {currencyFormatter.format(anomaly.amount)}
                  </p>

                  <span
                    className={`numeric mt-1.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold ${severity.chip}`}
                  >
                    <IconAlert size={11} />
                    {severity.label} · {anomaly.anomaly_score.toFixed(1)}
                  </span>
                </div>
              </div>

              <p className="mt-3 border-t border-hairline pt-3 text-xs leading-5 text-ink-2">
                {anomaly.anomaly_reason}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4">
        <p className="numeric text-xs text-ink-3">
          Showing top {topAnomalies.length} of {anomalies.length} anomalies
        </p>

        <p className="text-xs text-ink-3">Ranked by anomaly score</p>
      </div>
    </div>
  );
}
