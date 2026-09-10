// Muted, categorical sector accent colors (kept low-saturation on purpose so the
// page reads as a data document, not a dashboard template).
const SECTOR_COLORS: Record<string, string> = {
  "Information Technology": "#2f6f9f",
  "Communication Services": "#7a5ca6",
  "Health Care": "#3f8f7a",
  Financials: "#1f6b4f",
  "Consumer Discretionary": "#b5713a",
  "Consumer Staples": "#9a8a3f",
  Industrials: "#5c6470",
  Energy: "#a8552f",
  Materials: "#8a6d52",
  Utilities: "#4a7c9e",
  "Real Estate": "#9a5f7a",
  // Non-GICS ETF buckets (broad/foreign/bond/commodity funds).
  "Broad Market": "#46505c",
  International: "#6a7b8c",
  Commodities: "#9c7b3a",
  "Fixed Income": "#5f6b7a",
  // Geared funds (2x/3x long + inverse) — high-IV, decay-prone premium targets.
  "Leveraged / Inverse": "#8a4a4a",
  "ETF / Funds": "#3a3f47",
  "Off-Index": "#6b7280",
};

// Canonical GICS order, then the ETF-only buckets; "ETF / Funds" pinned last.
export const SECTOR_ORDER = [
  "Information Technology",
  "Communication Services",
  "Health Care",
  "Financials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Industrials",
  "Energy",
  "Materials",
  "Utilities",
  "Real Estate",
  "Broad Market",
  "International",
  "Commodities",
  "Fixed Income",
  "Leveraged / Inverse",
  "ETF / Funds",
  // Instruments that entered because a POSITION existed (enrich.ts OFF_INDEX_SECTOR):
  // non-index stocks, foreign listings, crypto trusts. Listed here so they have a defined
  // rank and colour instead of falling through sectorRank as "unknown" — they are a real
  // bucket, not a data defect, and scripts/metadata-audit.ts treats an unlisted sector as
  // one.
  "Off-Index",
];

export function sectorRank(sector: string): number {
  const i = SECTOR_ORDER.indexOf(sector);
  return i === -1 ? SECTOR_ORDER.length : i;
}

export function sectorColor(sector: string): string {
  return SECTOR_COLORS[sector] ?? "#5c6470";
}

/** Stable url-safe anchor id for a sector. */
export function sectorSlug(sector: string): string {
  return sector.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
