// Leveraged **long** ETFs — the LEV watchlist (2x/3x bulls, no inverse/short funds).
//
// Why they get their own list: a 2x/3x fund moves 2–3× the index, so its option IV is
// structurally high — the richest naked-call premium in the universe — while decay
// (daily rebalancing drag) works *for* a call writer. Inverse funds (-1x/-2x/-3x,
// "Short"/"Bear"/"UltraShort") are deliberately EXCLUDED: they're the same trade
// mirrored, so writing calls on them is a *bullish* bet on the underlying index, the
// opposite of what the NC book wants.
//
// Classification is name-based — Yahoo gives no leverage field — but the sponsors'
// naming is rigidly conventional ("Bull 3X" / "Bear 3X", "Ultra"/"UltraShort",
// "UltraPro"/"UltraPro Short", "(2x)"/"(-2x)"), so a name match is reliable here.

// Minimum leverage factor to qualify (2x and up; a plain 1x fund isn't leveraged).
export const LEV_MIN_FACTOR = 2;

// Inverse/short funds — any of these markers disqualifies a name outright. Checked
// FIRST, so "UltraPro Short QQQ (-3x)" never reads as a 3x long.
const INVERSE_RE = /\b(bear|short|inverse)\b|ultra\s*short|(?:^|[^\d.])-\s*\d+(?:\.\d+)?\s*x\b/i;

// The leverage multiple as written: "Bull 3X", "(2x)", "2x Long", "3X Shares".
const FACTOR_RE = /(?:^|[^a-z0-9.])(\d+(?:\.\d+)?)\s*x\b/i;

// ProShares' word form, used when no digits appear: Ultra = 2x, UltraPro = 3x.
const ULTRA_PRO_RE = /ultra\s*pro/i;
const ULTRA_RE = /\bultra\b/i;

// The fund's leverage factor from its name: 2 for "Ultra …(2x)", 3 for "Bull 3X",
// null when the name says nothing (an unleveraged fund) — and null for every
// inverse/short fund, which we treat as "not a long leveraged ETF" rather than -2.
export function leverageFactor(name: string | null | undefined): number | null {
  const n = (name ?? "").trim();
  if (!n || INVERSE_RE.test(n)) return null;
  const m = FACTOR_RE.exec(n);
  if (m) {
    const f = Number(m[1]);
    return Number.isFinite(f) && f > 1 ? f : null;
  }
  if (ULTRA_PRO_RE.test(n)) return 3;
  if (ULTRA_RE.test(n)) return 2;
  return null;
}

// LEV membership: an ETF (not a single stock) whose name says 2x or more long.
export function isLongLeveragedEtf(s: { type?: string | null; name?: string | null }): boolean {
  if ((s.type ?? "").toLowerCase() !== "etf") return false;
  const f = leverageFactor(s.name);
  return f != null && f >= LEV_MIN_FACTOR;
}
