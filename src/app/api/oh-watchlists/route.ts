import { buildOhPushLists } from "@/lib/ohpush";

export const dynamic = "force-dynamic";

// OH watchlists prepared for pushing to IB (consumed by the Chrome extension's
// "Push OH → IB"). Each list carries IB-ready rows [{C: conid}], a fixed numeric
// id, and an "OH:"-prefixed name so it never collides with the user's own IB lists.
// Tickers without a resolved conid are reported under `missing` and skipped.
// Payload built by src/lib/ohpush.ts (shared with POST /api/oh-verify).
export async function GET() {
  const lists = await buildOhPushLists();
  return Response.json({ lists });
}
