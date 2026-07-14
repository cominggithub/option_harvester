import { prisma } from "@/lib/db";

// The correct-conid pin registry (SecurityConid). A pin overrides the /trsrv-resolved
// Security.conid and survives the periodic re-resolve (which skips pinned tickers).
// Applying a pin also mirrors the conid into Security.conid so every consumer (OH
// push, IB option fetch, …) uses the corrected value — not just the OH watchlists.

export type PinSource = "manual" | "ib-option";

export type ApplyPinResult = { ticker: string; conid: string; source: PinSource; mirrored: boolean; skipped?: string };

// Upsert a pin and mirror it into Security.conid.
//  • manual pins always win and overwrite any existing pin.
//  • ib-option pins are authoritative for held names but must NOT clobber a manual
//    pin (the user's explicit correction), so they're skipped when a manual pin exists.
export async function applyConidPin(
  tickerRaw: string,
  conidRaw: string | number,
  source: PinSource,
  note?: string | null,
): Promise<ApplyPinResult> {
  const ticker = tickerRaw.trim().toUpperCase();
  const conid = String(conidRaw).trim();
  if (!ticker || !conid || !Number.isFinite(Number(conid))) {
    return { ticker, conid, source, mirrored: false, skipped: "invalid ticker/conid" };
  }

  if (source === "ib-option") {
    const existing = await prisma.securityConid.findUnique({ where: { ticker } });
    if (existing && existing.source === "manual") {
      return { ticker, conid, source, mirrored: false, skipped: "manual pin present" };
    }
  }

  await prisma.securityConid.upsert({
    where: { ticker },
    create: { ticker, conid, source, note: note ?? null },
    update: { conid, source, note: note ?? null },
  });
  // Mirror into Security.conid (only if we track the ticker).
  const r = await prisma.security.updateMany({ where: { ticker }, data: { conid } });
  return { ticker, conid, source, mirrored: r.count > 0 };
}
