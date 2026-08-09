/*
  Loading / empty / error presentation shared by every data panel. These were
  previously duplicated in five components with drifting copy and markup.
*/

import { IconInbox, IconWarning } from "@/components/ui/Icons";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-surface-3 ${className}`} />
  );
}

/**
 * Wraps a set of skeletons. `aria-busy` plus a polite label means screen
 * readers announce the wait instead of reading an empty region.
 */
export function LoadingRegion({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  className = "",
}: {
  title: string;
  message?: string | null;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border border-critical-line bg-critical-soft p-4 ${className}`}
    >
      <IconWarning size={18} className="mt-px shrink-0 text-critical" />

      <div className="min-w-0">
        <p className="text-sm font-semibold text-critical">{title}</p>

        {message && (
          <p className="mt-1 text-sm leading-5 text-critical/90">{message}</p>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  message,
  icon,
  className = "",
}: {
  title: string;
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border border-dashed border-hairline-strong bg-surface-2 px-6 py-10 text-center ${className}`}
    >
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink-3 shadow-panel">
        {icon ?? <IconInbox size={18} />}
      </span>

      <p className="text-sm font-medium text-ink">{title}</p>

      {message && (
        <p className="mt-1 max-w-xs text-sm leading-5 text-ink-3">{message}</p>
      )}
    </div>
  );
}
