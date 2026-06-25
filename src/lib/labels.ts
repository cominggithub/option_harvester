// User stock labels. The catalog is derived (seeds ∪ in-use) — no vocabulary
// table: a custom label exists once it's assigned to a stock and vanishes when
// it's unassigned everywhere. Create = type a new tag; delete = unassign it.
export const SEED_LABELS = [
  "nc",
  "np",
  "low vol",
  "high price",
  "no option",
  "bad option date",
  "low price",
  "value invest",
] as const;

// Rule-based labels computed from the data (see securities.ts computeAutoLabels).
// They're auto-derived, so they're not user-editable — the editor hides them.
export const AUTO_LABELS = [
  "low vol",
  "no option",
  "bad option date",
  "high price",
  "low price",
] as const;

// Normalize a raw label list: trim, drop empties, lowercase, dedupe, cap count.
export function cleanLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const v of raw) {
    const s = String(v).trim().toLowerCase().slice(0, 40);
    if (s) seen.add(s);
  }
  return [...seen].slice(0, 20);
}

// Per-label color (muted, editorial — matches the sector/trend palette). Known
// labels get a meaning-carrying swatch; custom labels hash to a stable fallback.
export type LabelColor = { bg: string; fg: string };

const LABEL_COLORS: Record<string, LabelColor> = {
  nc: { bg: "#e3f1e9", fg: "#1f7a44" }, // call green (matches Signal NC)
  np: { bg: "#e7e9fb", fg: "#4f46e5" }, // put indigo (matches Signal NP)
  "value invest": { bg: "#e4eefb", fg: "#1d4ed8" },
  "low vol": { bg: "#fbf0d9", fg: "#8a6500" },
  "bad option date": { bg: "#fbe7d6", fg: "#b45309" },
  "no option": { bg: "#f7e6e3", fg: "#c0392b" },
  "low price": { bg: "#eef1f4", fg: "#5b6470" },
  "high price": { bg: "#eef1f4", fg: "#5b6470" },
};

const FALLBACK: LabelColor[] = [
  { bg: "#e6efe9", fg: "#3f6b50" },
  { bg: "#efe9f4", fg: "#6b4f7a" },
  { bg: "#e9eef4", fg: "#42566b" },
  { bg: "#f4ece4", fg: "#7a5b3f" },
  { bg: "#e4f0f1", fg: "#3f6b6f" },
];

export function labelColor(name: string): LabelColor {
  const fixed = LABEL_COLORS[name];
  if (fixed) return fixed;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

// Seeds first (in their canonical order), then any custom labels in use, sorted.
export function labelCatalog(used: Iterable<string>): string[] {
  const seeds = SEED_LABELS as readonly string[];
  const extra = [...new Set(used)].filter((l) => l && !seeds.includes(l)).sort();
  return [...seeds, ...extra];
}
