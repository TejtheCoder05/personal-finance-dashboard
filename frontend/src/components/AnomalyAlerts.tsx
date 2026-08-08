"use client";

import { useEffect, useState } from "react";

import { getAnomalies } from "@/lib/api";
import type { AnomalyTransaction } from "@/types/finance";
import { useDataSource } from "@/components/DataSourceProvider";

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

function getScoreStyle(score: number) {
  if (score >= 90) {
    return "bg-red-50 text-red-700";
  }

  if (score >= 75) {
    return "bg-orange-50 text-orange-700";
  }

  return "bg-amber-50 text-amber-700";
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
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-gray-100 p-4"
          >
            <div className="flex justify-between">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            </div>

            <div className="mt-3 h-3 w-full animate-pulse rounded bg-gray-100" />
            <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-red-200 bg-red-50">
        <div className="text-center">
          <p className="text-sm font-semibold text-red-800">
            Could not load anomalies
          </p>

          <p className="mt-1 text-xs text-red-600">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl bg-gray-50">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            No anomalies detected
          </p>

          <p className="mt-1 text-xs text-gray-400">
            No unusual spending was flagged.
          </p>
        </div>
      </div>
    );
  }

  const topAnomalies = anomalies.slice(0, 4);

  return (
    <div>
      <div className="space-y-3">
        {topAnomalies.map((anomaly) => (
          <div
            key={`${anomaly.date}-${anomaly.merchant}-${anomaly.amount}`}
            className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 transition hover:border-gray-200 hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {formatMerchantName(anomaly.merchant)}
                  </p>

                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    {anomaly.category}
                  </span>
                </div>

                <p className="mt-1 text-xs text-gray-400">
                  {formatDate(anomaly.date)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {currencyFormatter.format(anomaly.amount)}
                </p>

                <span
                  className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${getScoreStyle(
                    anomaly.anomaly_score,
                  )}`}
                >
                  Score {anomaly.anomaly_score.toFixed(1)}
                </span>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
              <p className="text-xs leading-5 text-amber-800">
                {anomaly.anomaly_reason}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-400">
          Showing top {topAnomalies.length} of {anomalies.length} anomalies
        </p>

        <p className="text-xs font-medium text-amber-700">
          Ranked by anomaly score
        </p>
      </div>
    </div>
  );
}
