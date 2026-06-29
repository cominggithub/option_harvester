/**
 * Recent headlines for one ticker (live from Yahoo) with a lightweight
 * negative-event flag. Yahoo gives no sentiment score, so `flagNegative` just
 * substring-matches a bearish-event lexicon — rough but free and deterministic;
 * it's a "look here" prompt, not a verdict. Fetches are cached per ticker.
 */
import YahooFinance from "yahoo-finance2";
import { unstable_cache } from "next/cache";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

export type NewsItem = {
  title: string;
  publisher: string | null;
  link: string;
  published: string | null; // ISO
  negative: boolean;
};

// Bearish-event substrings (lowercased). Kept broad on purpose — false positives
// are cheap (the user still sees the headline), missed bad news is not.
const NEGATIVE = [
  "downgrade", "downgraded", "cut to", "price target cut", "target cut", "slash", "lowers guidance",
  "guidance cut", "cuts guidance", "miss", "misses", "disappoint", "lawsuit", "sued", "sues", "probe",
  "investigat", "subpoena", "fraud", "recall", "layoff", "job cuts", "plunge", "plummet", "slump",
  "slumps", "sink", "tumble", "crash", "halt", "bankrupt", "default", "warns", "warning", "weak",
  "scandal", "resign", "sec charge", "sec sues", "fine", "delist", "short seller", "short-seller",
  "selloff", "sell-off", "drops", "slides", "downbeat", "cut rating", "underperform", "bearish",
];

export function flagNegative(title: string): boolean {
  const t = title.toLowerCase();
  return NEGATIVE.some((w) => t.includes(w));
}

async function fetchNews(ticker: string): Promise<NewsItem[]> {
  try {
    const s = await yf.search(ticker, { newsCount: 8, quotesCount: 0 });
    return (s.news ?? [])
      .map((n) => {
        const pt = n.providerPublishTime as unknown;
        const published =
          pt instanceof Date ? pt.toISOString() : typeof pt === "number" ? new Date(pt).toISOString() : null;
        const title = n.title ?? "";
        return { title, publisher: n.publisher ?? null, link: n.link ?? "#", published, negative: flagNegative(title) };
      })
      .filter((n) => n.title);
  } catch {
    return [];
  }
}

// Cached per ticker for 30 min so repeated page views don't hammer Yahoo.
export function getNews(ticker: string): Promise<NewsItem[]> {
  const t = ticker.toUpperCase();
  return unstable_cache(() => fetchNews(t), ["news", t], { revalidate: 1800 })();
}

// ponytail: minimal check. Run: npx tsx scripts/news-check.ts
export function _selfCheck(): void {
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("news self-check: " + m); };
  assert(flagNegative("Analyst downgrades NVDA on weak guidance"), "should flag downgrade/weak");
  assert(flagNegative("Company faces SEC probe over accounting"), "should flag probe");
  assert(!flagNegative("Nvidia hits record high on strong demand"), "should not flag a positive headline");
  // eslint-disable-next-line no-console
  console.log("news self-check OK");
}
