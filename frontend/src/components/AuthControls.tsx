"use client";

import { FormEvent, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/components/AuthProvider";

type AuthMode = "login" | "register";

export default function AuthControls({ compact = false }: { compact?: boolean }) {
  const { user, loading, sessionError, login, register, logout } = useAuth();
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setConfirmPassword("");
    setError(null);
  }

  function close() {
    if (!submitting) {
      setMode(null);
      setError(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode) {
      return;
    }
    if (mode === "register") {
      if (password.length < 12 || password.length > 128) {
        setError("Password must be between 12 and 128 characters.");
        return;
      }
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        setError("Password must contain at least one letter and one number.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    try {
      setSubmitting(true);
      setError(null);
      if (mode === "register") {
        await register(email, password);
      } else {
        await login(email, password);
      }
      setMode(null);
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      setSubmitting(true);
      setError(null);
      await logout();
    } catch (logoutError) {
      setError(
        logoutError instanceof Error ? logoutError.message : "Could not log out.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="h-9 w-40 animate-pulse rounded-lg bg-gray-100" />;
  }

  return (
    <>
      <div className={compact ? "space-y-3" : "flex items-center gap-2"}>
        {user ? (
          <div className={compact ? "space-y-2" : "flex items-center gap-2"}>
            <div className={compact ? "rounded-xl bg-gray-50 px-3 py-2" : "text-right"}>
              <p className="max-w-56 truncate text-xs font-semibold text-gray-700">
                {user.email}
              </p>
              <p className="text-[11px] text-gray-400">Authenticated account</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={submitting}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
            >
              {submitting ? "Logging out…" : "Log out"}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => open("login")}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => open("register")}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600"
            >
              Create account
            </button>
          </div>
        )}
        {(error || sessionError) && !mode && (
          <p role="alert" className="text-xs text-red-600">{error ?? sessionError}</p>
        )}
      </div>

      {/*
        Portalled to the body because both headers use backdrop-blur, and a
        backdrop-filter makes an element the containing block for its
        fixed-position descendants — which would pin this overlay to the
        header instead of the viewport.
      */}
      {mode && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-950/50 p-4 backdrop-blur-sm" onMouseDown={close}>
          <div className="flex min-h-full items-center justify-center">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-title"
              onMouseDown={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-emerald-600">FinanceIQ Account</p>
                  <h2 id="auth-title" className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
                    {mode === "login" ? "Welcome back" : "Create your account"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    {mode === "login"
                      ? "Log in to access your persistent FinanceIQ data."
                      : "Create an account for persistent goals and transaction data."}
                  </p>
                </div>
                <button type="button" onClick={close} aria-label="Close authentication dialog" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Password
                  <input
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={mode === "register" ? 12 : undefined}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                {mode === "register" && (
                  <>
                    <p className="text-xs leading-5 text-gray-400">Use 12–128 characters with at least one letter and one number.</p>
                    <label className="block text-sm font-medium text-gray-700">
                      Confirm password
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={128}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                  </>
                )}
                {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <button type="submit" disabled={submitting} className="w-full rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-60">
                  {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
                </button>
              </form>

              <button type="button" onClick={() => open(mode === "login" ? "register" : "login")} className="mt-4 w-full text-center text-sm font-medium text-emerald-600 hover:text-emerald-700">
                {mode === "login" ? "Need an account? Create one" : "Already have an account? Log in"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
