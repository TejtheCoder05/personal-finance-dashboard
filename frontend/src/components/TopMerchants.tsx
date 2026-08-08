"use client";

import { useEffect, useState } from "react";

import { getMerchantSpending } from "@/lib/api";
import type { MerchantSpending } from "@/types/finance";

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

export default function TopMerchants() {
  const [merchants, setMerchants] = useState<MerchantSpending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMerchants() {
      try {
        setLoading(true);
        setError(null);

        const data = await getMerchantSpending();
        setMerchants(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load merchant spending data.");
      } finally {
        setLoading(false);
      }
    }

    loadMerchants();
  }, []);

  if (loading) {
    return (
      <div className="space-y-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index}>
            <div className="mb-2 flex items-center justify-between">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            </div>

            <div className="h-2 w-full animate-pulse rounded-full bg-gray-100" />
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
            Could not load merchants
          </p>

          <p className="mt-1 text-xs text-red-600">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (merchants.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl bg-gray-50">
        <p className="text-sm text-gray-500">
          No merchant spending data available.
        </p>
      </div>
    );
  }

  const topMerchants = merchants.slice(0, 5);
  const highestSpending = topMerchants[0]?.total_spending ?? 1;

  return (
    <div className="space-y-5">
      {topMerchants.map((merchant, index) => {
        const widthPercentage =
          (merchant.total_spending / highestSpending) * 100;

        return (
          <div key={merchant.merchant}>
            <div className="mb-2 flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-500">
                  {index + 1}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-800">
                      {formatMerchantName(merchant.merchant)}
                    </p>

                    {merchant.anomaly_count > 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        {merchant.anomaly_count}{" "}
                        {merchant.anomaly_count === 1
                          ? "anomaly"
                          : "anomalies"}
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 text-xs text-gray-400">
                    {merchant.transaction_count} transactions
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {currencyFormatter.format(
                    merchant.total_spending,
                  )}
                </p>

                <p className="mt-0.5 text-xs text-gray-400">
                  Avg.{" "}
                  {currencyFormatter.format(
                    merchant.average_transaction,
                  )}
                </p>
              </div>
            </div>

            <div className="ml-11 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${widthPercentage}%`,
                }}
              />
            </div>
          </div>
        );
      })}

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-400">
          Showing top 5 of {merchants.length} merchants by total spending
        </p>
      </div>
    </div>
  );
}