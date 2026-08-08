"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";

import {
  getServerSavingsGoals,
  loadSavingsGoals,
  saveSavingsGoals,
  subscribeToSavingsGoals,
} from "@/lib/savingsGoals";
import type { SavingsGoal } from "@/types/finance";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

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

export default function SavingsGoals() {
  const goals = useSyncExternalStore(
    subscribeToSavingsGoals,
    loadSavingsGoals,
    getServerSavingsGoals,
  );
  const [draft, setDraft] = useState<GoalDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function persist(nextGoals: SavingsGoal[]) {
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    const nextGoals = editingId
      ? goals.map((current) => (current.id === editingId ? goal : current))
      : [...goals, goal];

    persist(nextGoals);
    resetForm();
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

  function deleteGoal(goalId: string) {
    persist(goals.filter((goal) => goal.id !== goalId));
    if (editingId === goalId) {
      resetForm();
    }
  }

  return (
    <section id="savings-goals" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-600">Planning</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">
            Savings Goals
          </h2>
          <p className="mt-1 text-sm text-gray-500">
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
          className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          {formOpen ? "Cancel" : "Add goal"}
        </button>
      </div>

      {formOpen && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-medium text-gray-700">
              Goal name
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Emergency fund"
                maxLength={80}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Target amount
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={draft.targetAmount}
                onChange={(event) => setDraft({ ...draft, targetAmount: event.target.value })}
                placeholder="5000"
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Current amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={draft.currentAmount}
                onChange={(event) => setDraft({ ...draft, currentAmount: event.target.value })}
                placeholder="0"
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Target date <span className="font-normal text-gray-400">(optional)</span>
              <input
                type="date"
                value={draft.targetDate}
                onChange={(event) => setDraft({ ...draft, targetDate: event.target.value })}
                className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700"
            >
              {editingId ? "Save changes" : "Create goal"}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {goals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center">
            <p className="text-sm font-medium text-gray-700">No savings goals yet</p>
            <p className="mt-1 text-xs text-gray-400">Add a goal to start tracking your progress.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => {
              const percent = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
              const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
              return (
                <article key={goal.id} className="rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-gray-900">{goal.name}</h3>
                      <p className="mt-1 text-xs text-gray-400">
                        {goal.targetDate
                          ? `Target ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${goal.targetDate}T00:00:00`))}`
                          : "No target date"}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {percent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        {currencyFormatter.format(goal.currentAmount)}
                        <span className="text-sm font-normal text-gray-400"> / {currencyFormatter.format(goal.targetAmount)}</span>
                      </p>
                      <p className="mt-1 text-xs text-gray-400">{currencyFormatter.format(remaining)} remaining</p>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => startEditing(goal)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800">Edit</button>
                      <button type="button" onClick={() => deleteGoal(goal.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 hover:text-red-700">Delete</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Goals are saved only in this browser and are separate from transaction data.
      </p>
    </section>
  );
}
