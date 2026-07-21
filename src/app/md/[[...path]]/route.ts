import type { NextRequest } from "next/server";
import { htmlPageToMarkdown } from "@/lib/page-markdown";
import {
  markdownFilename,
  pagePathFromMarkdownSegments,
} from "@/lib/markdown-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MARKDOWN_HEADERS = {
  "Content-Type": "text/markdown; charset=utf-8",
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "no-referrer",
};

function markdownError(message: string, status: number): Response {
  return new Response(`# ${status}\n\n${message}\n`, { status, headers: MARKDOWN_HEADERS });
}

function localPageUrl(request: NextRequest, pagePath: string): URL {
  // Always fetch our own loopback server. Never trust Host as an outbound target:
  // doing so would turn this read-only mirror into an SSRF proxy.
  const port = request.nextUrl.port || process.env.PORT || "19210";
  const url = new URL(pagePath, `http://127.0.0.1:${port}`);
  url.search = request.nextUrl.search;
  return url;
}

function publicPageUrl(request: NextRequest, pagePath: string): URL {
  // nextUrl.origin reflects Next's bind address (often 0.0.0.0), not necessarily
  // the URL the reader used. Host is safe here because it is emitted only as link
  // metadata; outbound fetching remains locked to loopback in localPageUrl().
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "https" ? "https" : "http";
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;
  const origin = new URL(`${protocol}://${host}`).origin;
  const url = new URL(pagePath, origin);
  url.search = request.nextUrl.search;
  return url;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path = [] } = await context.params;
  const pagePath = pagePathFromMarkdownSegments(path);
  if (!pagePath) return markdownError("Unsupported Markdown page URL.", 404);

  const sourceUrl = publicPageUrl(request, pagePath);
  const targetUrl = localPageUrl(request, pagePath);

  let page: Response;
  try {
    page = await fetch(targetUrl, {
      cache: "no-store",
      headers: {
        Accept: "text/html",
        Cookie: request.headers.get("cookie") ?? "",
        "User-Agent": "Option-Harvester-Markdown-Mirror/1.0",
      },
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    console.error("Markdown mirror page fetch failed", { pagePath, error });
    return markdownError("The source page could not be rendered.", 502);
  }

  if (!page.ok) {
    return markdownError(`The source page returned HTTP ${page.status}.`, page.status === 404 ? 404 : 502);
  }

  try {
    const { markdown } = htmlPageToMarkdown(await page.text(), sourceUrl);
    return new Response(markdown, {
      status: 200,
      headers: {
        ...MARKDOWN_HEADERS,
        "Content-Disposition": `inline; filename="${markdownFilename(pagePath)}"`,
      },
    });
  } catch (error) {
    console.error("Markdown mirror conversion failed", { pagePath, error });
    return markdownError("The rendered page could not be converted to Markdown.", 500);
  }
}
