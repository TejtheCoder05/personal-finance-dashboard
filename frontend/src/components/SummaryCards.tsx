"use client";

import { useEffect, useState } from "react";

import { getSpendingSummary } from "@/lib/api";
import type { SpendingSummary } from "@/types/finance";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const numberFormatter = new Intl.NumberFormat("en-US");

export default function SummaryCards() {
  const [summary, setSummary] = useState<SpendingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      try {
        setLoading(true);
        setError(null);

        const data = await getSpendingSummary();
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
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
            <div className="mt-4 h-9 w-32 animate-pulse rounded bg-gray-200" />
            <div className="mt-3 h-3 w-36 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-semibold text-red-800">
          Could not connect to the finance API
        </p>
        <p className="mt-1 text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const metrics = [
    {
      label: "Total Spending",
      value: currencyFormatter.format(summary.total_spending),
      description: "Across all transactions",
    },
    {
      label: "Transactions",
      value: numberFormatter.format(summary.transaction_count),
      description: "Processed transactions",
    },
    {
      label: "Average Transaction",
      value: currencyFormatter.format(summary.average_transaction),
      description: `Median: ${currencyFormatter.format(
        summary.median_transaction,
      )}`,
    },
    {
      label: "Anomalies Detected",
      value: numberFormatter.format(summary.anomaly_count),
      description: `${(summary.anomaly_rate * 100).toFixed(1)}% anomaly rate`,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm font-medium text-gray-500">{metric.label}</p>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
            {metric.value}
          </p>

          <p className="mt-2 text-xs text-gray-400">{metric.description}</p>
        </div>
      ))}
    </div>
  );
}