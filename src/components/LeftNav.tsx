"use client";

import type { ViewId } from "@/lib/view";
import { sectorColor } from "@/lib/sectors";
import { StarIcon, TargetIcon, SproutIcon } from "@/components/icons";

type NavItem = { id: ViewId; label: string; count: number };

type Props = {
  specials: NavItem[];
  sectors: NavItem[];
  active: ViewId;
  asOf: string | null;
  onSelect: (id: ViewId) => void;
};

function specialLeading(id: ViewId) {
  if (id === "best") return <SproutIcon />;
  if (id === "favorites") return <StarIcon filled />;
  if (id === "targets") return <TargetIcon filled />;
  return <span className="dot" style={{ background: "#8b929b" }} aria-hidden />;
}

function NavRow({
  item,
  leading,
  active,
  onSelect,
}: {
  item: NavItem;
  leading: React.ReactNode;
  active: boolean;
  onSelect: (id: ViewId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
        active
          ? "bg-[#eef1f4] font-medium text-ink"
          : "text-ink-muted hover:bg-canvas hover:text-ink"
      }`}
    >
      <span className="flex w-4 shrink-0 justify-center">{leading}</span>
      <span className="flex-1 truncate">{item.label}</span>
      <span className="tnum text-[11.5px] text-ink-faint">{item.count}</span>
    </button>
  );
}

export function LeftNav({ specials, sectors, active, asOf, onSelect }: Props) {
  return (
    <aside className="flex h-full w-[236px] shrink-0 flex-col border-r border-line bg-surface">
      <nav className="scrollbar-none flex-1 overflow-y-auto px-2.5 pb-4">
        <p className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Screens
        </p>
        <div className="flex flex-col gap-0.5">
          {specials.map((item) => (
            <NavRow
              key={item.id}
              item={item}
              leading={specialLeading(item.id)}
              active={active === item.id}
              onSelect={onSelect}
            />
          ))}
        </div>

        <p className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          Sectors
        </p>
        <div className="flex flex-col gap-0.5">
          {sectors.map((item) => (
            <NavRow
              key={item.id}
              item={item}
              leading={
                <span
                  className="dot"
                  style={{ background: sectorColor(item.label) }}
                  aria-hidden
                />
              }
              active={active === item.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-line px-4 py-3 text-[10.5px] leading-relaxed text-ink-faint">
        {asOf ? <>Updated {asOf}</> : "No data yet"}
      </div>
    </aside>
  );
}
