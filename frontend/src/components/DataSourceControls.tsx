"use client";

import { FormEvent, useRef, useState } from "react";

import { useDataSource } from "@/components/DataSourceProvider";
import { importTransactions } from "@/lib/api";
import type { AmountSign } from "@/types/finance";

export default function DataSourceControls() {
  const { dataset, activateDataset, activateDemo } = useDataSource();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [amountSign, setAmountSign] = useState<AmountSign | "">("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !amountSign) {
      setError("Choose a CSV and confirm how purchases are represented.");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const imported = await importTransactions(file, amountSign);
      activateDataset(imported);
      setFile(null);
      setAmountSign("");
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The CSV could not be imported.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                dataset ? "bg-blue-500" : "bg-emerald-500"
              }`}
            />
            <p className="text-sm font-semibold text-gray-900">
              {dataset ? "Your uploaded data" : "Demo Mode"}
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {dataset
              ? `${dataset.filename} · ${dataset.transaction_count} processed transactions`
              : "Explore FinanceIQ safely with the built-in synthetic dataset."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <label className="block">
            <span className="sr-only">Transaction CSV</span>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError(null);
              }}
              className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
          </label>

          <label>
            <span className="sr-only">Purchase amount convention</span>
            <select
              value={amountSign}
              onChange={(event) => {
                setAmountSign(event.target.value as AmountSign | "");
                setError(null);
              }}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">How are purchases signed?</option>
              <option value="purchase_positive">Purchases are positive</option>
              <option value="purchase_negative">Purchases are negative</option>
            </select>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? "Processing…" : "Use CSV"}
            </button>
            {dataset && (
              <button
                type="button"
                onClick={activateDemo}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Use Demo
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="mt-3 flex flex-col gap-1 border-t border-gray-100 pt-3 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <p>CSV only · 5 MB maximum · up to 10,000 transactions</p>
        <p>Uploads are temporary and never retrain the ML models.</p>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
