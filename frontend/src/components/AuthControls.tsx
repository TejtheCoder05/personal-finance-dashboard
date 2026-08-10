"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/components/AuthProvider";
import { IconClose } from "@/components/ui/Icons";

type AuthMode = "login" | "register";

const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border border-hairline bg-inset px-3.5 text-sm text-ink outline-none transition-colors duration-150 hover:border-hairline-strong focus:border-brand focus:ring-2 focus:ring-brand-line";

const labelClass = "block text-[0.8125rem] font-medium text-ink-2";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function AuthControls({ compact = false }: { compact?: boolean }) {
  const { user, loading, sessionError, login, register, logout } = useAuth();
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  // Mirrored so the Escape handler can read the latest value without the
  // effect depending on `submitting` and re-running (which would steal focus
  // back to the email field mid-submit).
  const submittingRef = useRef(false);

  function updateSubmitting(next: boolean) {
    submittingRef.current = next;
    setSubmitting(next);
  }

  function open(nextMode: AuthMode) {
    triggerRef.current = document.activeElement as HTMLElement | null;
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

  // Escape to dismiss, focus into the dialog on open, focus back to the
  // trigger on close, and Tab kept inside the dialog while it is open.
  useEffect(() => {
    if (!mode) {
      return;
    }

    emailRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submittingRef.current) {
        setMode(null);
        setError(null);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      triggerRef.current?.focus();
    };
  }, [mode]);

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
      updateSubmitting(true);
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
      updateSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      updateSubmitting(true);
      setError(null);
      await logout();
    } catch (logoutError) {
      setError(
        logoutError instanceof Error ? logoutError.message : "Could not log out.",
      );
    } finally {
      updateSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="h-9 w-40 animate-pulse rounded-full bg-surface-3"
      >
        <span className="sr-only">Checking your session</span>
      </div>
    );
  }

  return (
    <>
      <div className={compact ? "space-y-3" : "flex items-center gap-3"}>
        {user ? (
          <div className={compact ? "space-y-2.5" : "flex items-center gap-3"}>
            {/* Avatar + identity block, echoing the reference's header. */}
            <div
              className={`flex items-center gap-2.5 ${
                compact
                  ? "rounded-xl border border-hairline bg-surface-2 px-3 py-2.5"
                  : ""
              }`}
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-line bg-brand-soft text-sm font-semibold text-brand"
              >
                {user.email.charAt(0).toUpperCase()}
              </span>

              <div className="min-w-0">
                <p className="max-w-48 truncate text-[0.8125rem] font-semibold text-ink">
                  {user.email}
                </p>
                <p className="text-[0.6875rem] text-ink-3">
                  Authenticated account
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={submitting}
              className="inline-flex h-9 shrink-0 items-center rounded-full border border-hairline bg-surface-2 px-4 text-[0.8125rem] font-medium text-ink-2 transition-colors duration-150 hover:border-hairline-strong hover:text-ink disabled:opacity-60"
            >
              {submitting ? "Logging out…" : "Log out"}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => open("login")}
              className="inline-flex h-9 items-center rounded-full border border-hairline bg-surface-2 px-4 text-[0.8125rem] font-medium text-ink-2 transition-colors duration-150 hover:border-hairline-strong hover:text-ink"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => open("register")}
              className="inline-flex h-9 items-center rounded-full bg-brand px-4 text-[0.8125rem] font-semibold text-brand-ink transition-colors duration-150 hover:bg-brand-strong"
            >
              Create account
            </button>
          </div>
        )}
        {(error || sessionError) && !mode && (
          <p role="alert" className="text-xs font-medium text-critical">
            {error ?? sessionError}
          </p>
        )}
      </div>

      {/*
        Portalled to the body because both headers use backdrop-blur, and a
        backdrop-filter makes an element the containing block for its
        fixed-position descendants — which would pin this overlay to the
        header instead of the viewport.
      */}
      {mode && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={close}
        >
          <div className="flex min-h-full items-center justify-center">
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="auth-title"
              onMouseDown={(event) => event.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-panel border border-hairline bg-surface p-6 text-left shadow-overlay"
            >
              <span
                aria-hidden="true"
                className="bloom pointer-events-none absolute inset-x-0 -top-24 h-48 rotate-180"
              />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">
                    FinanceIQ Account
                  </p>
                  <h2
                    id="auth-title"
                    className="mt-2 text-xl font-semibold tracking-tight text-ink"
                  >
                    {mode === "login" ? "Welcome back" : "Create your account"}
                  </h2>
                  <p className="mt-1.5 text-sm leading-6 text-ink-3">
                    {mode === "login"
                      ? "Log in to access your persistent FinanceIQ data."
                      : "Create an account for persistent goals and transaction data."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close authentication dialog"
                  className="-mr-1.5 -mt-1.5 rounded-full border border-hairline bg-surface-2 p-2 text-ink-3 transition-colors duration-150 hover:border-hairline-strong hover:text-ink"
                >
                  <IconClose size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="relative mt-6 space-y-4">
                <label className={labelClass}>
                  Email
                  <input
                    ref={emailRef}
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className={labelClass}>
                  Password
                  <input
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    required
                    minLength={mode === "register" ? 12 : undefined}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-describedby={
                      mode === "register" ? "password-help" : undefined
                    }
                    className={fieldClass}
                  />
                </label>
                {mode === "register" && (
                  <>
                    <p id="password-help" className="text-xs leading-5 text-ink-3">
                      Use 12–128 characters with at least one letter and one number.
                    </p>
                    <label className={labelClass}>
                      Confirm password
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={12}
                        maxLength={128}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className={fieldClass}
                      />
                    </label>
                  </>
                )}
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border border-critical-line bg-critical-soft px-3.5 py-2.5 text-sm font-medium text-critical"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-brand-ink transition-colors duration-150 hover:bg-brand-strong disabled:opacity-60"
                >
                  {submitting ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => open(mode === "login" ? "register" : "login")}
                className="relative mt-4 w-full rounded-lg py-1 text-center text-sm font-medium text-brand transition-colors duration-150 hover:text-brand-strong"
              >
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
