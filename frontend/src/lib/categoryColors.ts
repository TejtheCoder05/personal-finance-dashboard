/*
  One colour per spending category, shared by the donut chart, the transaction
  chips and the mobile cards. Previously the donut coloured slices by array
  index while the table coloured chips by name, so the same category could be
  violet in one panel and amber in another.

  Hue assignments preserve the mapping the table already used. Categories the
  ML model produces outside the known list get a stable colour from the same
  ramp via a content hash, so they never shift between renders.
*/

export interface CategoryColor {
  /** Solid fill for chart marks. Every value is >= 3:1 against white. */
  hex: string;
  /** Tailwind classes for a soft chip; text side is >= 4.5:1 on its own tint. */
  chip: string;
}

const RAMP: CategoryColor[] = [
  { hex: "#0d9488", chip: "bg-teal-50 text-teal-800" },
  { hex: "#2563eb", chip: "bg-blue-50 text-blue-800" },
  { hex: "#b45309", chip: "bg-amber-50 text-amber-800" },
  { hex: "#7c3aed", chip: "bg-violet-50 text-violet-800" },
  { hex: "#be123c", chip: "bg-rose-50 text-rose-800" },
  { hex: "#64748b", chip: "bg-slate-100 text-slate-700" },
];

const NAMED: Record<string, CategoryColor> = {
  groceries: RAMP[0],
  shopping: RAMP[1],
  fuel: RAMP[2],
  dining: RAMP[3],
  entertainment: RAMP[4],
};

function hashIndex(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % RAMP.length;
}

export function getCategoryColor(category: string): CategoryColor {
  const key = category.trim().toLowerCase();
  return NAMED[key] ?? RAMP[hashIndex(key)];
}
