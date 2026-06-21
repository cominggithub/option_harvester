import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Toggle a star (favorite) or option-target mark for one ticker.
// Body: { ticker: string, favorite?: boolean, target?: boolean }
export async function POST(req: Request) {
  let body: { ticker?: string; favorite?: boolean; target?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { ticker, favorite, target } = body;
  if (!ticker || (favorite === undefined && target === undefined)) {
    return NextResponse.json(
      { ok: false, error: "ticker and at least one of favorite/target required" },
      { status: 400 },
    );
  }

  // Guard: only mark tickers this project actually tracks.
  const exists = await prisma.security.findUnique({
    where: { ticker },
    select: { ticker: true },
  });
  if (!exists) {
    return NextResponse.json({ ok: false, error: "Unknown ticker" }, { status: 404 });
  }

  const data: { favorite?: boolean; target?: boolean } = {};
  if (favorite !== undefined) data.favorite = favorite;
  if (target !== undefined) data.target = target;

  const mark = await prisma.mark.upsert({
    where: { ticker },
    create: { ticker, ...data },
    update: data,
  });

  return NextResponse.json({
    ok: true,
    ticker,
    favorite: mark.favorite,
    target: mark.target,
  });
}
