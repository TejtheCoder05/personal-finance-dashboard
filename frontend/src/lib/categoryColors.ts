/*
  One colour per spending category, shared by the donut chart, the transaction
  chips and the mobile cards, so a category never reads as two different
  colours on the same screen.

  Tuned for the dark theme: every mark is >= 3:1 against --color-surface and
  every chip's text is >= 4.5:1 against its own tint. Hue assignments preserve
  the mapping the transaction table has always used. Categories the ML model
  produces outside the known list get a stable colour from the same ramp via a
  content hash, so they never shift between renders.
*/

export interface CategoryColor {
  /** Solid fill for chart marks. */
  hex: string;
  /** Tailwind classes for a soft chip. */
  chip: string;
  /** Bare colour for dots and rules. */
  dot: string;
}

const RAMP: CategoryColor[] = [
  { hex: "#5fd99a", chip: "bg-[#13251d] text-[#5fd99a]", dot: "#5fd99a" },
  { hex: "#8fb6f5", chip: "bg-[#1a2133] text-[#8fb6f5]", dot: "#8fb6f5" },
  { hex: "#f0c063", chip: "bg-[#2a2113] text-[#f0c063]", dot: "#f0c063" },
  { hex: "#b79ae8", chip: "bg-[#241f36] text-[#b79ae8]", dot: "#b79ae8" },
  { hex: "#e6a8d6", chip: "bg-[#2b1f2b] text-[#e6a8d6]", dot: "#e6a8d6" },
  { hex: "#a49ab0", chip: "bg-[#221f26] text-[#a49ab0]", dot: "#a49ab0" },
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
