"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";

import { useAuth } from "@/components/AuthProvider";
import {
  createSavingsGoal,
  deleteSavingsGoal,
  getSavingsGoals,
  updateSavingsGoal,
} from "@/lib/api";
import {
  getServerSavingsGoals,
  loadSavingsGoals,
  saveSavingsGoals,
  subscribeToSavingsGoals,
} from "@/lib/savingsGoals";
import type { AuthUser, PersistentSavingsGoal, SavingsGoal } from "@/types/finance";
import { Panel } from "@/components/ui/Panel";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { IconClose, IconPlus, IconTarget } from "@/components/ui/Icons";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const fieldClass =
  "mt-1.5 h-10 w-full rounded-lg border border-hairline bg-surface px-3 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 hover:border-hairline-strong focus:border-brand focus:ring-2 focus:ring-brand-line";

const labelClass = "block text-[0.8125rem] font-medium text-ink-2";

interface GoalDraft {
  name: string;
  targetAmount: string;
  currentAmount: string;
  targetDate: string;
}

const emptyDraft: GoalDraft = {
  name: "",
  targetAmount: "",
  currentAmount: "",
  targetDate: "",
};

function asSavingsGoal(goal: PersistentSavingsGoal): SavingsGoal {
  return {
    id: goal.id,
    name: goal.name,
    targetAmount: Number(goal.target_amount),
    currentAmount: Number(goal.current_amount),
    targetDate: goal.target_date,
  };
}

function SavingsGoalsContent({ user }: { user: AuthUser | null }) {
  const localGoals = useSyncExternalStore(
    subscribeToSavingsGoals,
    loadSavingsGoals,
    getServerSavingsGoals,
  );
  const [persistentGoals, setPersistentGoals] = useState<SavingsGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(Boolean(user));
  const [draft, setDraft] = useState<GoalDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const goals = user ? persistentGoals : localGoals;

  useEffect(() => {
    if (!user) {
      return;
    }
    let active = true;
    async function loadPersistentGoals() {
      try {
        const storedGoals = await getSavingsGoals();
        if (active) {
          setPersistentGoals(storedGoals.map(asSavingsGoal));
          setError(null);
        }
      } catch {
        if (active) {
          setError("Your saved goals could not be loaded.");
        }
      } finally {
        if (active) {
          setGoalsLoading(false);
        }
      }
    }
    loadPersistentGoals();
    return () => {
      active = false;
    };
  }, [user]);

  function persistLocally(nextGoals: SavingsGoal[]) {
    try {
      saveSavingsGoals(nextGoals);
    } catch {
      setError("Goals could not be saved in this browser.");
    }
  }

  function resetForm() {
    setDraft(emptyDraft);
    setEditingId(null);
    setFormOpen(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    const targetAmount = Number(draft.targetAmount);
    const currentAmount = Number(draft.currentAmount || 0);

    if (!name) {
      setError("Enter a name for your savings goal.");
      return;
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError("Target amount must be greater than zero.");
      return;
    }
    if (!Number.isFinite(currentAmount) || currentAmount < 0) {
      setError("Current amount cannot be negative.");
      return;
    }

    const goal: SavingsGoal = {
      id: editingId ?? crypto.randomUUID(),
      name,
      targetAmount,
      currentAmount,
      targetDate: draft.targetDate || null,
    };
    setSaving(true);
    setError(null);
    try {
      if (user) {
        const payload = {
          name,
          target_amount: targetAmount,
          current_amount: currentAmount,
          target_date: draft.targetDate || null,
        };
        const saved = editingId
          ? await updateSavingsGoal(editingId, payload)
          : await createSavingsGoal(payload);
        const savedGoal = asSavingsGoal(saved);
        setPersistentGoals((current) =>
          editingId
            ? current.map((item) => (item.id === editingId ? savedGoal : item))
            : [savedGoal, ...current],
        );
      } else {
        const nextGoals = editingId
          ? goals.map((current) => (current.id === editingId ? goal : current))
          : [...goals, goal];
        persistLocally(nextGoals);
      }
      resetForm();
    } catch {
      setError("The savings goal could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(goal: SavingsGoal) {
    setDraft({
      name: goal.name,
      targetAmount: String(goal.targetAmount),
      currentAmount: String(goal.currentAmount),
      targetDate: goal.targetDate ?? "",
    });
    setEditingId(goal.id);
    setFormOpen(true);
    setError(null);
  }

  async function deleteGoal(goalId: string) {
    setError(null);
    try {
      if (user) {
        await deleteSavingsGoal(goalId);
        setPersistentGoals((current) => current.filter((goal) => goal.id !== goalId));
      } else {
        persistLocally(goals.filter((goal) => goal.id !== goalId));
      }
      if (editingId === goalId) {
        resetForm();
      }
    } catch {
      setError("The savings goal could not be deleted. Please try again.");
    }
  }

  return (
    <Panel id="savings-goals">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[0.9375rem] font-semibold tracking-tight text-ink">
            Savings Goals
          </h3>
          <p className="mt-1 text-sm text-ink-3">
            Track progress toward the things you are saving for.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (formOpen) {
              resetForm();
            } else {
              setFormOpen(true);
            }
          }}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-brand-strong"
        >
          {formOpen ? <IconClose size={15} /> : <IconPlus size={15} />}
          {formOpen ? "Cancel" : "Add goal"}
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-5 rounded-lg border border-hairline bg-surface-2 p-4 sm:p-5"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className={labelClass}>
              Goal name <span className="text-critical">*</span>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Emergency fund"
                maxLength={80}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              Target amount <span className="text-critical">*</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={draft.targetAmount}
                onChange={(event) => setDraft({ ...draft, targetAmount: event.target.value })}
                placeholder="5000"
                className={`${fieldClass} numeric`}
              />
            </label>
            <label className={labelClass}>
              Current amount
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={draft.currentAmount}
                onChange={(event) => setDraft({ ...draft, currentAmount: event.target.value })}
                placeholder="0"
                className={`${fieldClass} numeric`}
              />
            </label>
            <label className={labelClass}>
              Target date <span className="font-normal text-ink-3">(optional)</span>
              <input
                type="date"
                value={draft.targetDate}
                onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })}
                className={fieldClass}
              />
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-critical">
              {error}
            </p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-nav-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Create goal"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-5">
        {goalsLoading ? (
          <div
            role="status"
            aria-busy="true"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <span className="sr-only">Loading your savings goals</span>
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-hairline p-5"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-4 h-2 w-full rounded-full" />
                <Skeleton className="mt-4 h-5 w-28" />
              </div>
            ))}
          </div>
        ) : goals.length === 0 ? (
          <EmptyState
            title="No savings goals yet"
            message="Add a goal to start tracking progress toward it."
            icon={<IconTarget size={18} />}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => {
              const percent = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
              const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
              const complete = percent >= 100;

              return (
                <article
                  key={goal.id}
                  className="rounded-lg border border-hairline bg-surface p-5 transition-shadow duration-200 hover:shadow-panel"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-semibold text-ink">
                        {goal.name}
                      </h4>
                      <p className="numeric mt-1 text-xs text-ink-3">
                        {goal.targetDate
                          ? `Target ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${goal.targetDate}T00:00:00`))}`
                          : "No target date"}
                      </p>
                    </div>

                    <span
                      className={`numeric shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                        complete
                          ? "border-brand-line bg-brand-soft text-brand"
                          : "border-hairline bg-surface-2 text-ink-2"
                      }`}
                    >
                      {percent.toFixed(0)}%
                    </span>
                  </div>

                  <div
                    className="mt-4 h-2 overflow-hidden rounded-full bg-surface-3"
                    role="img"
                    aria-label={`${percent.toFixed(0)}% of ${currencyFormatter.format(goal.targetAmount)} saved`}
                  >
                    <div
                      className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="numeric text-base font-semibold text-ink">
                        {currencyFormatter.format(goal.currentAmount)}
                        <span className="text-sm font-normal text-ink-3">
                          {" "}
                          / {currencyFormatter.format(goal.targetAmount)}
                        </span>
                      </p>
                      <p className="numeric mt-1 text-xs text-ink-3">
                        {currencyFormatter.format(remaining)} remaining
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEditing(goal)}
                        aria-label={`Edit ${goal.name}`}
                        className="rounded-md px-2 py-1 text-xs font-medium text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGoal(goal.id)}
                        aria-label={`Delete ${goal.name}`}
                        className="rounded-md px-2 py-1 text-xs font-medium text-critical transition-colors duration-150 hover:bg-critical-soft"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {error && !formOpen && (
        <ErrorState title="Savings goals" message={error} className="mt-4" />
      )}

      <p className="mt-5 border-t border-hairline pt-4 text-xs text-ink-3">
        {user
          ? "Goals are securely saved to your FinanceIQ account."
          : "Goals are saved only in this browser. Sign in to use separate account goals."}
      </p>
    </Panel>
  );
}

export default function SavingsGoals() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return <SavingsGoalsContent key={user?.id ?? "anonymous"} user={user} />;
}
