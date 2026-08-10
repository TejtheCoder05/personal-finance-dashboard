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
import { Panel } from "@/components/ui/Panel";
import { ErrorState } from "@/components/ui/States";
import {
  IconAlert,
  IconCheck,
  IconFile,
  IconShield,
  IconUpload,
} from "@/components/ui/Icons";

const emptyMapping: CsvColumnMapping = {
  date: "",
  description: "",
  amount: "",
};

const selectClass =
  "mt-1.5 h-11 w-full rounded-xl border border-hairline bg-inset px-3.5 text-sm text-ink outline-none transition-colors duration-150 hover:border-hairline-strong focus:border-brand focus:ring-2 focus:ring-brand-line";

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

  // Demo, temporary upload and account-persisted data each get their own
  // badge so the active source is legible at a glance rather than from a dot.
  const source = restoring
    ? {
        label: "Loading your saved data…",
        badge: "Restoring",
        tone: "border-hairline bg-surface-2 text-ink-2",
        icon: <IconFile size={14} />,
      }
    : persisted
      ? {
          label: "Your saved account data",
          badge: "Saved to account",
          tone: "border-brand-line bg-brand-soft text-brand",
          icon: <IconShield size={14} />,
        }
      : dataset
        ? {
            label: "Your uploaded data",
            badge: "Session only",
            tone: "border-caution-line bg-caution-soft text-caution",
            icon: <IconFile size={14} />,
          }
        : {
            label: "Demo Mode",
            badge: "Synthetic data",
            tone: "border-hairline bg-surface-2 text-ink-2",
            icon: <IconCheck size={14} />,
          };

  return (
    <Panel>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[0.9375rem] font-semibold tracking-tight text-ink">
              {source.label}
            </h3>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${source.tone}`}
            >
              {source.icon}
              {source.badge}
            </span>
          </div>

          <p className="numeric mt-1.5 text-sm leading-5 text-ink-3">
            {dataset
              ? `${dataset.filename} · ${dataset.transaction_count} processed transactions`
              : "Explore FinanceIQ safely with the built-in synthetic dataset."}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
        >
          <input
            ref={fileInput}
            id="transaction-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => updateFile(event.target.files?.[0] ?? null)}
            className="peer sr-only"
          />

          <label
            htmlFor="transaction-csv"
            className="inline-flex h-10 max-w-full cursor-pointer items-center gap-2 rounded-full border border-dashed border-hairline-strong bg-inset px-4 text-sm font-medium text-ink-2 transition-colors duration-150 hover:border-brand hover:bg-brand-soft hover:text-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
          >
            <IconUpload size={16} className="shrink-0" />
            <span className="truncate">
              {file ? file.name : "Choose CSV file"}
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={working}
              className="inline-flex h-10 items-center rounded-full bg-brand px-5 text-sm font-semibold text-brand-ink transition-colors duration-150 hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
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
                className={`inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
                  persisted
                    ? "border-critical-line bg-inset text-critical hover:bg-critical-soft"
                    : "border-hairline bg-inset text-ink-2 hover:border-hairline-strong hover:text-ink"
                }`}
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
        <div className="mt-5 border-t border-hairline pt-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h4 className="text-sm font-semibold text-ink">
              Confirm column mapping
            </h4>
            <p className="numeric text-xs text-ink-3">
              {inspection.row_count} rows found
            </p>
          </div>

          <p className="mt-1 text-xs leading-5 text-ink-3">
            FinanceIQ pre-selected the closest match for each field. Adjust any
            that look wrong before processing.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(["date", "description", "amount"] as const).map((field) => (
              <label
                key={field}
                className="block text-[0.8125rem] font-medium capitalize text-ink-2"
              >
                {field} column
                <select
                  value={mapping[field]}
                  onChange={(event) => {
                    setMapping({ ...mapping, [field]: event.target.value });
                    setError(null);
                  }}
                  className={selectClass}
                >
                  <option value="">Select column</option>
                  {inspection.columns.map((column) => (
                    <option key={column} value={column}>{column}</option>
                  ))}
                </select>
              </label>
            ))}

            <label className="block text-[0.8125rem] font-medium text-ink-2">
              Purchase amount convention
              <select
                value={amountSign}
                onChange={(event) => {
                  setAmountSign(event.target.value as AmountSign | "");
                  setError(null);
                }}
                className={selectClass}
              >
                <option value="">Select convention</option>
                <option value="purchase_positive">Purchases are positive</option>
                <option value="purchase_negative">Purchases are negative</option>
              </select>
            </label>
          </div>

          {inspection.warnings.length > 0 && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-caution-line bg-caution-soft px-3.5 py-3">
              <IconAlert size={16} className="mt-px shrink-0 text-caution" />
              <div>
                {inspection.warnings.map((warning) => (
                  <p key={warning} className="text-xs leading-5 text-caution">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full min-w-[37.5rem] text-left text-xs">
              <caption className="sr-only">
                Preview of the first rows of the uploaded CSV
              </caption>
              <thead className="bg-inset">
                <tr>
                  {inspection.columns.map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className="whitespace-nowrap border-b border-hairline px-3 py-2 font-semibold text-ink-2"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspection.preview.map((row, index) => (
                  <tr key={index} className="border-b border-hairline last:border-0">
                    {inspection.columns.map((column) => (
                      <td
                        key={column}
                        className="numeric max-w-56 truncate whitespace-nowrap px-3 py-2 text-ink-2"
                      >
                        {row[column] === null ? "—" : String(row[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-ink-3">
            Previewing the first three rows. Confirm the mapping before processing.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-1 border-t border-hairline pt-3.5 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between">
        <p>CSV only · 5 MB maximum · up to 10,000 transactions</p>
        <p>
          {user
            ? "Imports are saved to your account and never retrain the ML models."
            : "Uploads are temporary. Sign in to keep imported transactions."}
        </p>
      </div>

      {error && <ErrorState title="Import problem" message={error} className="mt-4" />}
    </Panel>
  );
}
