import Link from "next/link";

/**
 * A ticker is an instrument, not a word.
 *
 * Rendered as prose it disappears into the sentence around it — the operator's
 * complaint on 2026-08-28 — so every symbol gets the same treatment: tabular
 * mono (the convention already used on /ib, /roic and the wide stock list),
 * semibold, tight tracking, and a chip that survives the row-hover fill.
 *
 * Hue is deliberately not used to carry it. On `/risk` rose, amber and emerald
 * mean "breach", "caution" and "passes", and the severity and gate chips are
 * pale fills of exactly those — so a ticker earns its emphasis from face, frame
 * and weight instead, and only reaches for `accent` on hover, where it means
 * "this is a link".
 *
 * Two weights, because the same symbol plays two roles:
 *
 * * `cell` (default) — a grey pill. Used where the ticker identifies a row among
 *   forty others; a solid fill repeated down a whole table would read as noise.
 * * `target` — a solid ink pill at 16px, for the one place the symbol *is* the
 *   subject rather than a label on it: a pick under "What to sell next". It sits
 *   immediately beside a pale gate chip, so it needs to win against a chip, not
 *   against prose.
 */
export function Ticker({
  symbol,
  variant = "cell",
  link = true,
  className = "",
}: {
  symbol: string;
  variant?: "cell" | "target";
  link?: boolean;
  className?: string;
}) {
  const shape = "tnum inline-block rounded-sm font-semibold tracking-tight ring-1 ring-inset";
  const skin =
    variant === "target"
      ? "text-lede px-2 bg-ink text-surface ring-ink"
      : "px-1.5 bg-line text-ink ring-ink-faint/30";
  const base = `${shape} ${skin}${className ? ` ${className}` : ""}`;
  if (!link) return <span className={base}>{symbol}</span>;
  const hover =
    variant === "target"
      ? "hover:bg-accent hover:ring-accent"
      : "hover:bg-accent hover:text-surface hover:ring-accent";
  return (
    <Link href={`/stock/${symbol}`} className={`${base} ${hover}`}>
      {symbol}
    </Link>
  );
}
