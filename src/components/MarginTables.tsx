"use client";

import { SortableTable, type Column } from "@/components/SortableTable";
import type { MarginBrief, MarginEstimateRow } from "@/lib/marginbrief";
import type { RateCardRow } from "@/lib/marginrate";

// The /margin tables. Client-side so the columns sort; every number is computed server-side and
// passed in, so nothing here can disagree with lib/marginrate.ts.

const pct = (v: number | null | undefined, dp = 1) => (v == null ? "—" : `${(v * 100).toFixed(dp)}%`);
const usd = (v: number | null | undefined) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);

/** Colour the rate, not the dollars: 25% of notional is the fact worth noticing. */
const rateTone = (r: number | null | undefined) =>
  r == null ? "" : r >= 0.25 ? "text-rose-400 font-semibold" : r >= 0.15 ? "text-amber-400" : "";

type Leg = MarginBrief["legs"][number];

export function RateCardTable({ rows }: { rows: RateCardRow[] }) {
  const cols: Column<RateCardRow>[] = [
    { key: "cls", header: "Class", value: (r) => r.cls, cell: (r) => r.cls },
    { key: "right", header: "Right", value: (r) => r.right, cell: (r) => (r.right === "P" ? "put" : "call") },
    { key: "n", header: "n", align: "right", value: (r) => r.n, cell: (r) => r.n, title: "How many held legs of this class and right the median rests on" },
    {
      key: "median",
      header: "Median rate",
      align: "right",
      value: (r) => r.median,
      cell: (r) => <span className={rateTone(r.median)}>{pct(r.median)}</span>,
      title: "median( maintenance ÷ notional ) over the legs in this bucket",
    },
    {
      key: "range",
      header: "Range",
      align: "right",
      value: (r) => r.max - r.min,
      cell: (r) => (
        <span className="text-muted">
          {pct(r.min)} – {pct(r.max)}
        </span>
      ),
      title: "Lowest and highest measured rate in the bucket. Sorts by the width of the spread.",
    },
  ];
  return <SortableTable rows={rows} columns={cols} initialSort="median" rowKey={(r) => `${r.cls}${r.right}`} />;
}

export function LegsTable({ legs }: { legs: Leg[] }) {
  const cols: Column<Leg>[] = [
    { key: "symbol", header: "Symbol", value: (l) => l.symbol, cell: (l) => <span className="font-medium">{l.symbol}</span> },
    { key: "cls", header: "Class", value: (l) => l.cls, cell: (l) => <span className="text-muted">{l.cls}</span> },
    {
      key: "leg",
      header: "Leg",
      value: (l) => `${l.right}${l.expiry ?? ""}`,
      cell: (l) => (
        <span className="text-muted">
          {l.right === "P" ? "put" : "call"} {l.strike} {l.expiry ?? ""}
        </span>
      ),
    },
    { key: "contracts", header: "Contracts", align: "right", value: (l) => l.contracts, cell: (l) => l.contracts },
    {
      key: "maint",
      header: "Maintenance",
      align: "right",
      value: (l) => l.maintMargin,
      cell: (l) => <span className="font-semibold">{usd(l.maintMargin)}</span>,
      title: "IB's own what-if for this exact position. Not a model.",
    },
    {
      key: "notional",
      header: "Notional",
      align: "right",
      value: (l) => l.notional,
      cell: (l) => <span className="text-muted">{usd(l.notional)}</span>,
      title: "strike × 100 × contracts",
    },
    {
      key: "rate",
      header: "% notional",
      align: "right",
      value: (l) => l.rate,
      cell: (l) => <span className={rateTone(l.rate)}>{pct(l.rate)}</span>,
      title: "maintenance ÷ (strike × 100 × contracts)",
    },
    {
      key: "cushion",
      header: "Frees % of cushion",
      align: "right",
      value: (l) => l.shareOfCushion,
      cell: (l) => pct(l.shareOfCushion),
      title:
        "maintenance ÷ excess liquidity. This leg's margin is ALREADY deducted from excess liquidity, so read it as what CLOSING the leg would release, as a share of the cushion you have now — not as what it is currently consuming. Can exceed 100% for a large leg against a small cushion.",
    },
    {
      key: "age",
      header: "What-if age",
      align: "right",
      value: (l) => l.ageDays,
      cell: (l) => <span className="text-muted">{l.ageDays != null ? `${l.ageDays.toFixed(0)}d` : "—"}</span>,
      title: "How old IB's figure is. A stale what-if prices a position that has since moved.",
    },
  ];
  return <SortableTable rows={legs} columns={cols} initialSort="maint" rowKey={(l, i) => `${l.symbol}${l.right}${l.strike}${l.expiry}${i}`} />;
}

export function EstimatesTable({ rows }: { rows: MarginEstimateRow[] }) {
  const cols: Column<MarginEstimateRow>[] = [
    { key: "ticker", header: "Ticker", value: (e) => e.ticker, cell: (e) => <span className="font-medium">{e.ticker}</span> },
    { key: "cls", header: "Class", value: (e) => e.cls, cell: (e) => <span className="text-muted">{e.cls}</span> },
    { key: "price", header: "Price", align: "right", value: (e) => e.price, cell: (e) => (e.price != null ? `$${e.price.toFixed(2)}` : "—") },
    {
      key: "iv",
      header: "IV",
      align: "right",
      value: (e) => e.ivPct,
      cell: (e) => <span className="text-muted">{e.ivPct != null ? `${e.ivPct.toFixed(0)}%` : "—"}</span>,
    },
    {
      key: "putRate",
      header: "Put rate",
      align: "right",
      value: (e) => e.put.rate,
      cell: (e) => <span className={rateTone(e.put.rate)}>{pct(e.put.rate)}</span>,
      title: "Median rate for this class and right, from the rate card above",
    },
    {
      key: "putUsd",
      header: "Put $",
      align: "right",
      value: (e) => e.put.dollars,
      cell: (e) => <span className="font-semibold">{usd(e.put.dollars)}</span>,
      title: "put rate × price × 100 × 1 contract (strike assumed at the money)",
    },
    {
      key: "putCushion",
      header: "Put % cushion",
      align: "right",
      value: (e) => e.put.shareOfCushion,
      cell: (e) => pct(e.put.shareOfCushion),
      title: "put $ ÷ excess liquidity — what OPENING one contract would consume of the cushion you have now. Nothing is held here, so unlike the held-legs table this margin is not yet deducted.",
    },
    {
      key: "putMax",
      header: "Put max",
      align: "right",
      value: (e) => e.put.contracts,
      cell: (e) => <span className="text-muted">{e.put.contracts ?? "—"}</span>,
      title: "floor( excess liquidity ÷ put $ ) — contracts the cushion absorbs before it is gone",
    },
    {
      key: "callRate",
      header: "Call rate",
      align: "right",
      value: (e) => e.call.rate,
      cell: (e) => <span className={rateTone(e.call.rate)}>{pct(e.call.rate)}</span>,
      title: "Median rate for this class and right, from the rate card above",
    },
    {
      key: "callUsd",
      header: "Call $",
      align: "right",
      value: (e) => e.call.dollars,
      cell: (e) => <span className="font-semibold">{usd(e.call.dollars)}</span>,
      title: "call rate × price × 100 × 1 contract (strike assumed at the money)",
    },
    {
      key: "callCushion",
      header: "Call % cushion",
      align: "right",
      value: (e) => e.call.shareOfCushion,
      cell: (e) => pct(e.call.shareOfCushion),
      title: "call $ ÷ excess liquidity — what OPENING one contract would consume of the cushion you have now.",
    },
    {
      key: "n",
      header: "Basis",
      align: "right",
      value: (e) => e.put.n,
      cell: (e) => <span className="text-xs text-muted">{e.put.provenance === "none" ? "none" : `class, n=${e.put.n}`}</span>,
      title: "Where the rate came from: always a class median here, never a what-if on this name",
    },
    { key: "lists", header: "Lists", value: (e) => e.lists.join(" "), cell: (e) => <span className="text-xs text-muted">{e.lists.join(" ")}</span> },
  ];
  return <SortableTable rows={rows} columns={cols} initialSort="putUsd" rowKey={(e) => e.ticker} maxHeight="70vh" />;
}
