"use client";

import { NAV_ITEMS, NAV_TARGET_IDS } from "@/components/navigation";
import { useActiveSection } from "@/lib/useActiveSection";

/*
  Client island inside the otherwise-static page shell, so the rail can track
  scroll position without turning the whole dashboard into a client component.
*/
export default function SidebarNav() {
  const active = useActiveSection(NAV_TARGET_IDS);

  return (
    <nav aria-label="Dashboard sections" className="flex-1 px-3 py-5">
      <p className="mb-2 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-nav-ink-3">
        Dashboard
      </p>

      <ul className="space-y-0.5">
        {NAV_ITEMS.map(({ label, targetId, Icon }) => {
          const isActive = active === targetId;

          return (
            <li key={label}>
              <a
                href={`#${targetId}`}
                aria-current={isActive ? "location" : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-nav-2 text-nav-ink"
                    : "text-nav-ink-3 hover:bg-nav-2/60 hover:text-nav-ink"
                }`}
              >
                <Icon size={17} className="shrink-0" />
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
