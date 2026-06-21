import { prisma } from "@/lib/db";

// Full-resolution daily close history for one ticker, fetched on demand when a
// row is expanded into its detail chart. Reads our own option_harvest_daily_prices.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  const rows = await prisma.dailyPrice.findMany({
    where: { ticker: ticker.toUpperCase() },
    orderBy: { date: "asc" },
    select: { date: true, close: true },
  });
  const points = rows
    .filter((r) => r.close != null)
    .map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      close: Number(r.close),
    }));
  return Response.json(
    { ticker: ticker.toUpperCase(), points },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
