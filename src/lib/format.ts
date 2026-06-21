const CAP_UNITS: [number, string][] = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** Compact market cap split into number + unit so the unit can be dimmed. */
export function formatMarketCapParts(
  value: bigint | number | null | undefined,
): { num: string; unit: string } {
  if (value == null) return { num: "—", unit: "" };
  const n = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(n) || n <= 0) return { num: "—", unit: "" };
  for (const [scale, suffix] of CAP_UNITS) {
    if (n >= scale) {
      const v = n / scale;
      return { num: v >= 100 ? v.toFixed(0) : v.toFixed(2), unit: suffix };
    }
  }
  return { num: n.toFixed(0), unit: "" };
}

/** Compact USD market cap: 4.96T, 812.3B, 95.0M. */
export function formatMarketCap(value: bigint | number | null | undefined): string {
  const { num, unit } = formatMarketCapParts(value);
  return `${num}${unit}`;
}

/** Compact share volume: 118.6M, 24.2M, 940.2K. */
export function formatVolume(value: bigint | number | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

/** Price with two decimals and thousands separators. */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Signed percentage: +1.23%, -0.45%. */
export function formatChangePct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Implied volatility as a whole-ish percent: 23.3%. */
export function formatIv(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export function formatTimestamp(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
