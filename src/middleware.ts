import { NextResponse, type NextRequest } from "next/server";
import { EXT_VERSION_HEADER, MIN_EXT_VERSION, isStaleExtVersion } from "@/lib/extversion";

/**
 * Refuse writes from an out-of-date Chrome extension.
 *
 * One place rather than fifteen route handlers: the check needs nothing but a header, so
 * putting it in a route would mean repeating it in `positions`, `orders`, `trades`,
 * `watchlist`, `balances`, `sync-log`, `greeks`, `margin`, `options`, `underlying-iv`,
 * `security-conids`, `underlying-conids`, `oh-verify`, `marks` and `upload` — and
 * forgetting it in the sixteenth.
 *
 * Reads are left alone. A stale install fetching `/api/oh-watchlists` is harmless, and
 * blocking GETs would only make its failure mode harder to read. `/api/ext-log` is also
 * exempt on purpose: that is the channel a stale install uses to say who it is, and
 * silencing it would remove the only evidence that it exists (see lib/extversion.ts).
 *
 * The 409 body is what the extension keys on (`staleExtension`), and it carries the
 * required version so the install can name it in its own popup.
 */
export function middleware(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/ext-log")) return NextResponse.next();

  const version = req.headers.get(EXT_VERSION_HEADER);
  if (!isStaleExtVersion(version)) return NextResponse.next();

  return NextResponse.json(
    {
      error: `extension ${version} is out of date — this backend requires ${MIN_EXT_VERSION} or newer`,
      staleExtension: true,
      version,
      minVersion: MIN_EXT_VERSION,
    },
    { status: 409 },
  );
}

export const config = { matcher: "/api/:path*" };
