// Minimal inline icons — no icon-library dependency.

export function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9 6.2 20.9l1.1-6.47L2.6 9.85l6.5-.95L12 2.5z"
        fill={filled ? "#e0a000" : "none"}
        stroke={filled ? "#e0a000" : "currentColor"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Covered-call target: a bullseye.
export function TargetIcon({ filled }: { filled: boolean }) {
  const c = filled ? "#1f7a44" : "currentColor";
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="none" stroke={c} strokeWidth="1.7">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" fill={filled ? "#1f7a44" : "none"} stroke="none" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function SortArrow({ dir }: { dir: "asc" | "desc" | null }) {
  if (!dir) return null;
  return (
    <span className="ml-0.5 inline-block text-[9px] leading-none text-ink">
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

// Best-harvest qualifier: a small sprout.
export function SproutIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden fill="none" stroke="#1f7a44" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21v-8" />
      <path d="M12 13c0-3 2.5-5 6-5 0 3.5-2.5 5-6 5z" fill="#d9efe0" />
      <path d="M12 14c0-2.5-2-4.5-5-4.5 0 3 2 4.5 5 4.5z" fill="#d9efe0" />
    </svg>
  );
}
