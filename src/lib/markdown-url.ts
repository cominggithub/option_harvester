// Public, read-only Markdown mirrors are intentionally limited to UI pages.
// API routes are never mirrored: some GET endpoints expose machine payloads and
// mutation endpoints must not become discoverable through this feature.
const STATIC_PAGE_PATHS = new Set([
  "/",
  "/ib",
  "/orders",
  "/pnl-predict",
  "/positions",
  "/risk",
  // The recorded-analysis index. Individual analyses are matched by RISK_ANALYSIS_PATH below
  // rather than enumerated, since their addresses are data (a sequence number or a date).
  "/risk/history",
  "/roic",
  "/margin",
  "/short-call",
  // The analyzer's section pages. Mirrored because the markdown view is how the
  // option-adviser role (and any review) reads live state without touching the DB;
  // without them, seven of the eight pages were unreadable that way.
  "/short-call/actions",
  "/short-call/candidates",
  "/short-call/cohorts",
  "/short-call/lifecycle",
  "/short-call/losses",
  "/short-call/strategy",
  "/short-call/weekly",
  "/sync",
  "/transactions",
  "/upload",
  "/watchlists",
  "/wiki",
  "/wl-log",
]);

const STOCK_PATH = /^\/stock\/[A-Za-z0-9._-]+$/;
// One recorded risk analysis, addressed by sequence number, ISO date, or `latest`. A pattern
// rather than a list because these addresses are rows in a table, and the shape is narrow
// enough to enumerate exactly: digits, YYYY-MM-DD, or the literal `latest`. Anything else
// (a traversal attempt, an arbitrary slug) does not match and is not mirrored.
const RISK_ANALYSIS_PATH = /^\/risk\/history\/(?:\d+|\d{4}-\d{2}-\d{2}|latest)$/;

export function normalizePagePath(pathname: string): string {
  if (!pathname) return "/";
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

export function isShareablePagePath(pathname: string): boolean {
  const path = normalizePagePath(pathname);
  return STATIC_PAGE_PATHS.has(path) || STOCK_PATH.test(path) || RISK_ANALYSIS_PATH.test(path);
}

export function markdownPathForPage(pathname: string): string | null {
  const path = normalizePagePath(pathname);
  if (!isShareablePagePath(path)) return null;
  return path === "/" ? "/md/index.md" : `/md${path}.md`;
}

export function pagePathFromMarkdownSegments(segments: string[]): string | null {
  if (!segments.length || segments.some((part) => !part || part === "." || part === ".." || part.includes("/"))) {
    return null;
  }
  const last = segments.at(-1)!;
  if (!last.endsWith(".md")) return null;

  const stem = last.slice(0, -3);
  if (!stem) return null;
  const pageSegments = [...segments.slice(0, -1), stem];
  const path = pageSegments.length === 1 && pageSegments[0] === "index" ? "/" : `/${pageSegments.join("/")}`;
  return isShareablePagePath(path) ? normalizePagePath(path) : null;
}

export function markdownFilename(pathname: string): string {
  const path = normalizePagePath(pathname);
  if (path === "/") return "option-harvester-index.md";
  return `option-harvester-${path.slice(1).replace(/[^A-Za-z0-9._-]+/g, "-")}.md`;
}
