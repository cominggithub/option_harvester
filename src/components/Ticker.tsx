import Link from "next/link";

/**
 * A ticker is an instrument, not a word.
 *
 * Rendered as prose it disappears into the sentence around it — the operator's
 * complaint on 2026-08-28 — so every symbol on a page gets the same treatment:
 * tabular mono (the convention already used on /ib, /roic and the wide stock
 * list), semibold ink, and a hairline chip that survives the row-hover fill.
 * Colour is deliberately *not* used: rose/amber/emerald carry rule meaning on
 * `/risk`, so a ticker earns its emphasis from face and frame instead, and only
 * reaches for `accent` on hover, where it means "this is a link".
 *
 * `size="lede"` is for the one place the symbol is the subject of the row rather
 * than a cell in it — a pick under "What to sell next".
 */
export function Ticker({
  symbol,
  size = "inherit",
  link = true,
  className = "",
}: {
  symbol: string;
  size?: "inherit" | "lede";
  link?: boolean;
  className?: string;
}) {
  const base =
    "tnum inline-block rounded-sm bg-canvas px-1 font-semibold text-ink ring-1 ring-inset ring-line" +
    (size === "lede" ? " text-lede" : "") +
    (className ? ` ${className}` : "");
  if (!link) return <span className={base}>{symbol}</span>;
  return (
    <Link href={`/stock/${symbol}`} className={`${base} hover:text-accent hover:ring-ink-faint`}>
      {symbol}
    </Link>
  );
}
