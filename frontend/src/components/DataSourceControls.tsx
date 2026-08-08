"use client";

import { FormEvent, useRef, useState } from "react";

import { useAuth } from "@/components/AuthProvider";
import { useDataSource } from "@/components/DataSourceProvider";
import {
  deleteImportedDataset,
  importTransactions,
  validateTransactionCsv,
} from "@/lib/api";
import type {
  AmountSign,
  CsvColumnMapping,
  CsvValidationResult,
} from "@/types/finance";

const emptyMapping: CsvColumnMapping = {
  date: "",
  description: "",
  amount: "",
};

export default function DataSourceControls() {
  const { user } = useAuth();
  const { dataset, restoring, activateDataset, activateDemo, refreshStoredDataset } =
    useDataSource();
  const persisted = dataset?.storage === "account";
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<CsvValidationResult | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping>(emptyMapping);
  const [amountSign, setAmountSign] = useState<AmountSign | "">("");
  const [working, setWorking] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetUpload() {
    setFile(null);
    setInspection(null);
    setMapping(emptyMapping);
    setAmountSign("");
    if (fileInput.current) {
      fileInput.current.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a transaction CSV to continue.");
      return;
    }

    try {
      setWorking(true);
      setError(null);

      if (!inspection) {
        const result = await validateTransactionCsv(file);
        setInspection(result);
        setMapping({
          date: result.suggested_mapping.date ?? "",
          description: result.suggested_mapping.description ?? "",
          amount: result.suggested_mapping.amount ?? "",
        });
        return;
      }

      if (!mapping.date || !mapping.description || !mapping.amount) {
        setError("Map the date, description, and amount columns.");
        return;
      }
      if (new Set(Object.values(mapping)).size !== 3) {
        setError("Each FinanceIQ field must use a different CSV column.");
        return;
      }
      if (!amountSign) {
        setError("Confirm whether purchases are positive or negative.");
        return;
      }

      const imported = await importTransactions(file, amountSign, mapping);
      activateDataset(imported);
      resetUpload();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "The CSV could not be processed.",
      );
    } finally {
      setWorking(false);
    }
  }

  function updateFile(nextFile: File | null) {
    setFile(nextFile);
    setInspection(null);
    setMapping(emptyMapping);
    setAmountSign("");
    setError(null);
  }

  async function removeUpload() {
    if (!dataset) {
      return;
    }

    if (
      persisted &&
      !window.confirm(
        `Permanently delete ${dataset.filename} and its ${dataset.transaction_count} saved transactions?`,
      )
    ) {
      return;
    }

    try {
      setRemoving(true);
      setError(null);
      await deleteImportedDataset(dataset.dataset_id);
      if (persisted) {
        // An earlier import, if any, becomes active again.
        await refreshStoredDataset();
      } else {
        activateDemo();
      }
      resetUpload();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Uploaded data could not be removed.",
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${dataset ? "bg-blue-500" : "bg-emerald-500"}`} />
            <p className="text-sm font-semibold text-gray-900">
              {restoring
                ? "Loading your saved data…"
                : persisted
                  ? "Your saved account data"
                  : dataset
                    ? "Your uploaded data"
                    : "Demo Mode"}
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {dataset
              ? `${dataset.filename} · ${dataset.transaction_count} processed transactions`
              : "Explore FinanceIQ safely with the built-in synthetic dataset."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="block min-w-0">
            <span className="sr-only">Transaction CSV</span>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => updateFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={working}
              className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working
                ? inspection ? "Processing…" : "Validating…"
                : inspection ? "Process CSV" : "Validate CSV"}
            </button>
            {dataset && (
              <button
                type="button"
                onClick={removeUpload}
                disabled={removing}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                {removing
                  ? "Removing…"
                  : persisted
                    ? "Delete saved data"
                    : "Remove & use Demo"}
              </button>
            )}
          </div>
        </form>
      </div>

      {inspection && (
        <div className="mt-5 border-t border-gray-100 pt-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-gray-800">Confirm column mapping</p>
            <p className="text-xs text-gray-400">{inspection.row_count} rows found</p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(["date", "description", "amount"] as const).map((field) => (
              <label key={field} className="text-xs font-medium capitalize text-gray-600">
                {field} column
                <select
                  value={mapping[field]}
                  onChange={(event) => {
                    setMapping({ ...mapping, [field]: event.target.value });
                    setError(null);
                  }}
                  className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Select column</option>
                  {inspection.columns.map((column) => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                </select>
              </label>
            ))}

            <label className="text-xs font-medium text-gray-600">
              Purchase amount convention
              <select
                value={amountSign}
                onChange={(event) => {
                  setAmountSign(event.target.value as AmountSign | "");
                  setError(null);
                }}
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Select convention</option>
                <option value="purchase_positive">Purchases are positive</option>
                <option value="purchase_negative">Purchases are negative</option>
              </select>
            </label>
          </div>

          {inspection.warnings.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              {inspection.warnings.map((warning) => (
                <p key={warning} className="text-xs leading-5 text-amber-800">{warning}</p>
              ))}
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {inspection.columns.map((column) => (
                    <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspection.preview.map((row, index) => (
                  <tr key={index} className="border-t border-gray-100 text-gray-600">
                    {inspection.columns.map((column) => (
                      <td key={column} className="max-w-56 truncate whitespace-nowrap px-3 py-2">
                        {row[column] === null ? "—" : String(row[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-400">Previewing the first three rows. Confirm the mapping before processing.</p>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1 border-t border-gray-100 pt-3 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <p>CSV only · 5 MB maximum · up to 10,000 transactions</p>
        <p>
          {user
            ? "Imports are saved to your account and never retrain the ML models."
            : "Uploads are temporary. Sign in to keep imported transactions."}
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </section>
  );
}
