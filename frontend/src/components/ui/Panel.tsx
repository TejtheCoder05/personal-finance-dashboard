/*
  Panel chrome for every card on the dashboard. Previously each section
  hand-rolled its own border/radius/padding combination, which is why radii
  drifted between 12px and 16px and padding between 16px and 24px.
*/

interface PanelProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Removes the default padding so tables can run edge to edge. */
  flush?: boolean;
}

export function Panel({ children, className = "", id, flush }: PanelProps) {
  return (
    <section
      id={id}
      className={`rounded-panel border border-hairline bg-surface shadow-panel ${
        flush ? "" : "p-5 sm:p-6"
      } ${className}`}
    >
      {children}
    </section>
  );
}

interface PanelHeaderProps {
  title: string;
  description?: string;
  /** Trailing content: a status pill, a filter cluster, an action button. */
  action?: React.ReactNode;
  className?: string;
}

export function PanelHeader({
  title,
  description,
  action,
  className = "",
}: PanelHeaderProps) {
  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-ink">
          {title}
        </h3>

        {description && (
          <p className="mt-1 text-sm leading-5 text-ink-3">{description}</p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Small-caps section label that sits above a group of panels. */
export function SectionLabel({
  children,
  meta,
  id,
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
  /** Referenced by the enclosing section's aria-labelledby. */
  id?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2
        id={id}
        className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-3"
      >
        {children}
      </h2>

      {meta && <span className="text-xs text-ink-3">{meta}</span>}
    </div>
  );
}

/** Neutral pill used for counts and static qualifiers in panel headers. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "caution";
}) {
  const tones = {
    neutral: "border-hairline bg-surface-2 text-ink-2",
    brand: "border-brand-line bg-brand-soft text-brand",
    caution: "border-caution-line bg-caution-soft text-caution",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
