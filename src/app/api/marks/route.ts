import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cleanLabels } from "@/lib/labels";

export const dynamic = "force-dynamic";

// Toggle a star (favorite) / option-target mark, set a rating, or replace labels.
// Body: { ticker, favorite?, target?, rating?, labels?: string[] }
export async function POST(req: Request) {
  let body: {
    ticker?: string;
    favorite?: boolean;
    target?: boolean;
    rating?: number;
    labels?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { ticker, favorite, target, rating, labels } = body;
  if (
    !ticker ||
    (favorite === undefined && target === undefined && rating === undefined && labels === undefined)
  ) {
    return NextResponse.json(
      { ok: false, error: "ticker and at least one of favorite/target/rating/labels required" },
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

  const data: { favorite?: boolean; target?: boolean; rating?: number; labels?: string[] } = {};
  if (favorite !== undefined) data.favorite = favorite;
  if (target !== undefined) data.target = target;
  // Signed: +1..+3 = call conviction, -1..-3 = put conviction, 0 = unrated.
  if (rating !== undefined) data.rating = Math.max(-3, Math.min(3, Math.round(rating)));
  if (labels !== undefined) data.labels = cleanLabels(labels);

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
    labels: mark.labels,
  });
}
