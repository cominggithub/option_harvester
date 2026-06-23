import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Toggle a star (favorite) / option-target mark, or set a 1-5 target rating.
// Body: { ticker: string, favorite?: boolean, target?: boolean, rating?: number }
export async function POST(req: Request) {
  let body: { ticker?: string; favorite?: boolean; target?: boolean; rating?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { ticker, favorite, target, rating } = body;
  if (!ticker || (favorite === undefined && target === undefined && rating === undefined)) {
    return NextResponse.json(
      { ok: false, error: "ticker and at least one of favorite/target/rating required" },
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

  const data: { favorite?: boolean; target?: boolean; rating?: number } = {};
  if (favorite !== undefined) data.favorite = favorite;
  if (target !== undefined) data.target = target;
  // Signed: +1..+3 = call conviction, -1..-3 = put conviction, 0 = unrated.
  if (rating !== undefined) data.rating = Math.max(-3, Math.min(3, Math.round(rating)));

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
    rating: mark.rating,
  });
}
