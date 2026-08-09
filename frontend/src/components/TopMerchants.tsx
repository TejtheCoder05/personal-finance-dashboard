"use client";

import { useEffect, useState } from "react";

import { getMerchantSpending } from "@/lib/api";
import type { MerchantSpending } from "@/types/finance";
import { useDataSource } from "@/components/DataSourceProvider";
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "@/components/ui/States";

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
  const { dataset } = useDataSource();
  const [merchants, setMerchants] = useState<MerchantSpending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMerchants() {
      try {
        setLoading(true);
        setError(null);

        const data = await getMerchantSpending(dataset?.dataset_id);
        setMerchants(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load merchant spending data.");
      } finally {
        setLoading(false);
      }
    }

    loadMerchants();
  }, [dataset?.dataset_id]);

  if (loading) {
    return (
      <LoadingRegion label="Loading top merchants" className="space-y-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index}>
            <div className="mb-2.5 flex items-center justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>

            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </LoadingRegion>
    );
  }

  if (error) {
    return <ErrorState title="Could not load merchants" message={error} />;
  }

  if (merchants.length === 0) {
    return (
      <EmptyState
        title="No merchant activity"
        message="Merchant rankings appear once transactions are processed."
      />
    );
  }

  const topMerchants = merchants.slice(0, 5);
  const highestSpending = topMerchants[0]?.total_spending ?? 1;

  return (
    <div>
      <ol className="space-y-5">
        {topMerchants.map((merchant, index) => {
          const widthPercentage =
            (merchant.total_spending / highestSpending) * 100;

          return (
            <li key={merchant.merchant}>
              <div className="mb-2.5 flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="numeric flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2 text-xs font-semibold text-ink-2">
                    {index + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink">
                        {formatMerchantName(merchant.merchant)}
                      </p>

                      {merchant.anomaly_count > 0 && (
                        <span className="rounded-full border border-caution-line bg-caution-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-caution">
                          {merchant.anomaly_count}{" "}
                          {merchant.anomaly_count === 1
                            ? "anomaly"
                            : "anomalies"}
                        </span>
                      )}
                    </div>

                    <p className="numeric mt-0.5 text-xs text-ink-3">
                      {merchant.transaction_count} transactions
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="numeric text-sm font-semibold text-ink">
                    {currencyFormatter.format(
                      merchant.total_spending,
                    )}
                  </p>

                  <p className="numeric mt-0.5 text-xs text-ink-3">
                    Avg.{" "}
                    {currencyFormatter.format(
                      merchant.average_transaction,
                    )}
                  </p>
                </div>
              </div>

              <div
                className="ml-10 h-1.5 overflow-hidden rounded-full bg-surface-3"
                role="img"
                aria-label={`${widthPercentage.toFixed(
                  0,
                )}% of the top merchant's spending`}
              >
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
                  style={{
                    width: `${widthPercentage}%`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>

      <p className="numeric mt-5 border-t border-hairline pt-4 text-xs text-ink-3">
        Showing top 5 of {merchants.length} merchants by total spending
      </p>
    </div>
  );
}
