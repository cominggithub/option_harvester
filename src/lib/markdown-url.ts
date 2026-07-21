// Public, read-only Markdown mirrors are intentionally limited to UI pages.
// API routes are never mirrored: some GET endpoints expose machine payloads and
// mutation endpoints must not become discoverable through this feature.
const STATIC_PAGE_PATHS = new Set([
  "/",
  "/ib",
  "/orders",
  "/pnl-predict",
  "/positions",
  "/sync",
  "/transactions",
  "/upload",
  "/watchlists",
  "/wiki",
  "/wl-log",
]);

const STOCK_PATH = /^\/stock\/[A-Za-z0-9._-]+$/;

export function normalizePagePath(pathname: string): string {
  if (!pathname) return "/";
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

export function isShareablePagePath(pathname: string): boolean {
  const path = normalizePagePath(pathname);
  return STATIC_PAGE_PATHS.has(path) || STOCK_PATH.test(path);
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
