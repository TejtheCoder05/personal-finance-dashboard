"use client";

import { useEffect, useState } from "react";

import { getTransactions } from "@/lib/api";
import type { Transaction } from "@/types/finance";
import { useDataSource } from "@/components/DataSourceProvider";
import { getCategoryColor } from "@/lib/categoryColors";
import {
  EmptyState,
  ErrorState,
  LoadingRegion,
  Skeleton,
} from "@/components/ui/States";
import { IconAlert, IconCheck } from "@/components/ui/Icons";

// These strings are the category labels the API filters on — do not localise.
const categories = [
  "All",
  "Dining",
  "Groceries",
  "Entertainment",
  "Fuel",
  "Shopping",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const controlClass =
  "h-9 rounded-lg border border-hairline bg-surface px-3 text-sm text-ink-2 outline-none transition-colors duration-150 hover:border-hairline-strong focus:border-brand focus:ring-2 focus:ring-brand-line";

const GUTTER = "px-5 sm:px-6";

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
  const parsedDate = new Date(date);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

function ConfidenceBar({ value }: { value: number }) {
  const percent = Math.min(value * 100, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${percent}%` }}
        />
      </div>

      <span className="numeric text-xs text-ink-3">{percent.toFixed(0)}%</span>
    </div>
  );
}

function MerchantAvatar({
  merchant,
  isAnomaly,
  size,
}: {
  merchant: string;
  isAnomaly: boolean;
  size: "sm" | "md";
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-md border text-xs font-semibold ${
        size === "md" ? "h-9 w-9" : "h-8 w-8"
      } ${
        isAnomaly
          ? "border-caution-line bg-caution-soft text-caution"
          : "border-hairline bg-surface-2 text-ink-2"
      }`}
    >
      {merchant.charAt(0).toUpperCase()}
    </span>
  );
}

export default function RecentTransactions() {
  const { dataset } = useDataSource();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [category, setCategory] = useState("All");
  const [anomaliesOnly, setAnomaliesOnly] = useState(false);
  const [limit, setLimit] = useState(10);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTransactions() {
      try {
        setLoading(true);
        setError(null);

        const data = await getTransactions({
          limit,
          category: category === "All" ? undefined : category,
          anomaliesOnly,
          datasetId: dataset?.dataset_id,
        });

        setTransactions(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load transaction data.");
      } finally {
        setLoading(false);
      }
    }

    loadTransactions();
  }, [category, anomaliesOnly, limit, dataset?.dataset_id]);

  return (
    <div>
      <div
        className={`${GUTTER} flex flex-col gap-4 pb-4 pt-5 sm:pt-6 lg:flex-row lg:items-start lg:justify-between`}
      >
        <div>
          <h3 className="text-[0.9375rem] font-semibold tracking-tight text-ink">
            Recent Transactions
          </h3>

          <p className="mt-1 text-sm text-ink-3">
            Latest categorised transaction activity
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={`${controlClass} w-full sm:w-auto`}
          >
            {categories.map((categoryOption) => (
              <option
                key={categoryOption}
                value={categoryOption}
              >
                {categoryOption === "All"
                  ? "All categories"
                  : categoryOption}
              </option>
            ))}
          </select>

          <select
            aria-label="Rows to show"
            value={limit}
            onChange={(event) =>
              setLimit(Number(event.target.value))
            }
            className={`${controlClass} w-full sm:w-auto`}
          >
            <option value={10}>10 rows</option>
            <option value={25}>25 rows</option>
            <option value={50}>50 rows</option>
          </select>

          <button
            type="button"
            aria-pressed={anomaliesOnly}
            onClick={() => setAnomaliesOnly((current) => !current)}
            className={`col-span-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 sm:w-auto ${
              anomaliesOnly
                ? "border-caution-line bg-caution-soft text-caution"
                : "border-hairline bg-surface text-ink-2 hover:border-hairline-strong hover:bg-surface-2"
            }`}
          >
            {anomaliesOnly ? <IconCheck size={14} /> : <IconAlert size={14} />}
            Anomalies only
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingRegion
          label="Loading transactions"
          className={`${GUTTER} space-y-px pb-6`}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 border-t border-hairline py-4"
            >
              <Skeleton className="h-9 w-9 rounded-md" />

              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>

              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </LoadingRegion>
      ) : error ? (
        <div className={`${GUTTER} pb-6`}>
          <ErrorState title="Could not load transactions" message={error} />
        </div>
      ) : transactions.length === 0 ? (
        <div className={`${GUTTER} pb-6`}>
          <EmptyState
            title="No transactions found"
            message="No rows match the current filters. Try a different category or turn off the anomaly filter."
          />
        </div>
      ) : (
        <>
          {/* Mobile transaction cards */}
          <ul className={`${GUTTER} space-y-3 pb-5 md:hidden`}>
            {transactions.map((transaction, index) => (
              <li
                key={`${transaction.date}-${transaction.merchant}-${transaction.amount}-${index}`}
                className={`rounded-lg border p-4 ${
                  transaction.is_anomaly
                    ? "border-caution-line bg-caution-soft"
                    : "border-hairline bg-surface"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MerchantAvatar
                      merchant={transaction.merchant}
                      isAnomaly={transaction.is_anomaly}
                      size="md"
                    />

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {formatMerchantName(transaction.merchant)}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-ink-3">
                        {transaction.description_raw}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="numeric text-sm font-semibold text-ink">
                      {currencyFormatter.format(transaction.amount)}
                    </p>

                    {transaction.is_anomaly && (
                      <p className="numeric mt-1 text-xs font-medium text-critical">
                        Score {transaction.anomaly_score.toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      getCategoryColor(transaction.category).chip
                    }`}
                  >
                    {transaction.category}
                  </span>

                  {transaction.is_anomaly && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-critical-line bg-critical-soft px-2.5 py-1 text-xs font-semibold text-critical">
                      <IconAlert size={11} />
                      Anomaly
                    </span>
                  )}

                  <span className="numeric text-xs text-ink-3">
                    {formatDate(transaction.date)}
                  </span>
                </div>

                <div className="mt-3.5 flex items-center justify-between border-t border-hairline pt-3">
                  <span className="text-xs text-ink-3">
                    Category confidence
                  </span>

                  <ConfidenceBar value={transaction.category_confidence} />
                </div>
              </li>
            ))}
          </ul>

          {/* Desktop transaction table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <caption className="sr-only">
                Recent transactions with ML category, confidence and anomaly
                status
              </caption>

              <thead>
                <tr className="border-y border-hairline bg-surface-2">
                  <th
                    scope="col"
                    className="py-2.5 pl-5 pr-4 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3 sm:pl-6"
                  >
                    Merchant
                  </th>

                  <th
                    scope="col"
                    className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3"
                  >
                    Category
                  </th>

                  <th
                    scope="col"
                    className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3"
                  >
                    Date
                  </th>

                  <th
                    scope="col"
                    className="px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3"
                  >
                    Confidence
                  </th>

                  <th
                    scope="col"
                    className="py-2.5 pl-4 pr-5 text-right text-xs font-semibold uppercase tracking-[0.06em] text-ink-3 sm:pr-6"
                  >
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {transactions.map((transaction, index) => (
                  <tr
                    key={`${transaction.date}-${transaction.merchant}-${transaction.amount}-${index}`}
                    className={`border-b border-hairline transition-colors duration-150 hover:bg-surface-2 ${
                      transaction.is_anomaly ? "bg-caution-soft" : "bg-surface"
                    }`}
                  >
                    <td className="py-3 pl-5 pr-4 sm:pl-6">
                      <div className="flex items-center gap-3">
                        <MerchantAvatar
                          merchant={transaction.merchant}
                          isAnomaly={transaction.is_anomaly}
                          size="sm"
                        />

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-ink">
                              {formatMerchantName(
                                transaction.merchant,
                              )}
                            </p>

                            {transaction.is_anomaly && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-critical-line bg-critical-soft px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-critical">
                                <IconAlert size={10} />
                                Anomaly
                              </span>
                            )}
                          </div>

                          <p className="mt-0.5 max-w-[16rem] truncate text-xs text-ink-3">
                            {transaction.description_raw}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          getCategoryColor(transaction.category).chip
                        }`}
                      >
                        {transaction.category}
                      </span>
                    </td>

                    <td className="numeric whitespace-nowrap px-4 py-3 text-sm text-ink-2">
                      {formatDate(transaction.date)}
                    </td>

                    <td className="px-4 py-3">
                      <ConfidenceBar
                        value={transaction.category_confidence}
                      />
                    </td>

                    <td className="py-3 pl-4 pr-5 text-right sm:pr-6">
                      <p className="numeric text-sm font-semibold text-ink">
                        {currencyFormatter.format(
                          transaction.amount,
                        )}
                      </p>

                      {transaction.is_anomaly && (
                        <p className="numeric mt-0.5 text-xs font-medium text-critical">
                          Score{" "}
                          {transaction.anomaly_score.toFixed(1)}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className={`${GUTTER} flex flex-col gap-1 py-4 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between`}
          >
            <p className="numeric">
              Showing {transactions.length} transaction
              {transactions.length === 1 ? "" : "s"}
            </p>

            <p>
              {category === "All"
                ? "All categories"
                : category}
              {anomaliesOnly ? " · Anomalies only" : ""}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
