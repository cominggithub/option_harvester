"use client";

import { useMemo, useState } from "react";
import { SortArrow } from "@/components/icons";

// A small generic sortable table.
//
// Written because /margin has three tables that all want the same behaviour and none of them fit
// DataTable, which is built around SecurityRow. The contract is deliberately narrow: a column
// declares how to SORT itself (`value`) separately from how to RENDER itself (`cell`), because
// every interesting column here is formatted — "48.3%", "$4,557" — and sorting formatted strings
// is how a table ends up claiming $9,000 is less than $842.
//
// `value` returning null sorts to the END in both directions rather than being treated as zero: a
// name with no price is not the cheapest name, it is an unknown, and putting it at the top of an
// ascending cost sort would be a lie about the cheapest trade available.

export type Column<T> = {
  key: string;
  header: string;
  /** Sort key. Return null for "no value" — those rows sink to the bottom either way. */
  value?: (row: T) => number | string | null;
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** Tooltip on the header — used here to carry each column's formula. */
  title?: string;
  className?: string;
};

export function SortableTable<T>({
  rows,
  columns,
  initialSort,
  initialDir = "desc",
  rowKey,
  maxHeight,
}: {
  rows: T[];
  columns: Column<T>[];
  initialSort?: string;
  initialDir?: "asc" | "desc";
  rowKey: (row: T, i: number) => string;
  /** Optional scroll cap, so a 300-row table does not push the rest of the page away. */
  maxHeight?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(initialSort ?? null);
  const [dir, setDir] = useState<"asc" | "desc">(initialDir);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.value) return rows;
    const get = col.value;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      // Nulls last, always — see the note above.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string" || typeof bv === "string" ? String(av).localeCompare(String(bv)) : av - bv;
      return dir === "asc" ? cmp : -cmp;
    });
  }, [rows, columns, sortKey, dir]);

  const click = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.value) return;
    if (key === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      // Numbers open descending (biggest cost first is the question being asked), text ascending.
      const first = rows.length ? col.value(rows[0]) : null;
      setDir(typeof first === "string" ? "asc" : "desc");
    }
  };

  return (
    <div className={maxHeight ? "overflow-auto" : undefined} style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th
                key={c.key}
                title={c.title}
                onClick={() => click(c.key)}
                className={[
                  "whitespace-nowrap px-3 py-2 font-medium text-muted",
                  c.align === "right" ? "text-right" : "text-left",
                  c.value ? "cursor-pointer select-none hover:text-ink" : "",
                  c.title ? "underline decoration-dotted decoration-from-font underline-offset-4" : "",
                ].join(" ")}
              >
                {c.header}
                {sortKey === c.key ? <SortArrow dir={dir} /> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={rowKey(r, i)} className="border-b border-line/50 hover:bg-line/20">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={[
                    "whitespace-nowrap px-3 py-1.5",
                    c.align === "right" ? "text-right tabular-nums" : "",
                    typeof c.className === "string" ? c.className : "",
                  ].join(" ")}
                >
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 ? <p className="px-3 py-3 text-muted">Nothing to show.</p> : null}
    </div>
  );
}
