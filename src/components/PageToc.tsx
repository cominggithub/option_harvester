/**
 * Sticky left table-of-contents for a long single-page report.
 *
 * These pages are deliberately long — `/risk` is fourteen sections, because the doctrine
 * it measures has fourteen kinds of answer — and scrolling to find "By delta" is friction
 * at exactly the moment a decision is being made. The rail is plain anchors: no client JS,
 * no scroll listeners, so it works in a server component and in the `.md` mirror.
 *
 * `count` is for the number that tells you whether a section is worth opening (how many
 * legs are flagged, how many names). `tone` lets a breach show red in the rail itself, so
 * the page's own alarm is visible without scrolling to it.
 *
 * The same pattern is inlined in `/pnl-predict`; that page can adopt this component when
 * it is next touched.
 */
export type TocItem = {
  id: string;
  label: string;
  count?: number | string | null;
  /** A heading rather than a link — groups the list. */
  group?: boolean;
  tone?: "ok" | "warn" | "bad";
};

const TONE: Record<NonNullable<TocItem["tone"]>, string> = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-rose-700",
};

export function PageToc({ items, title = "On this page" }: { items: TocItem[]; title?: string }) {
  return (
    <>
      {/* Wide screens: a sticky rail beside the content. */}
      <aside className="sticky top-4 hidden h-fit max-h-[85vh] w-44 shrink-0 self-start overflow-y-auto lg:block">
        <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{title}</p>
        <nav className="flex flex-col gap-0.5">
          {items.map((s) =>
            s.group ? (
              <p key={s.id} className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                {s.label}
              </p>
            ) : (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <span className="truncate">{s.label}</span>
                {s.count != null && s.count !== "" && (
                  <span className={`tnum text-[11px] ${s.tone ? TONE[s.tone] : "text-ink-faint"}`}>{s.count}</span>
                )}
              </a>
            ),
          )}
        </nav>
      </aside>

      {/* Narrow screens: the same anchors as one scrollable strip, so mobile keeps the jumps. */}
      <nav className="-mx-6 mb-3 flex gap-1 overflow-x-auto px-6 pb-1 text-[12px] lg:hidden">
        {items
          .filter((s) => !s.group)
          .map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="shrink-0 rounded-md border border-line bg-surface px-2 py-1 text-ink-muted hover:text-ink"
            >
              {s.label}
              {s.count != null && s.count !== "" && (
                <span className={`tnum ml-1 ${s.tone ? TONE[s.tone] : "text-ink-faint"}`}>{s.count}</span>
              )}
            </a>
          ))}
      </nav>
    </>
  );
}
