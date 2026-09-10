/**
 * Metadata audit — is what we believe about each instrument still true?
 *
 * Standing goal #1 (CLAUDE.md § How we work) in executable form. Every screen in this app
 * gates on instrument metadata: `type` decides whether a name can be an ETF target at all,
 * `sector` drives the analyzer's tabs and the theme fallback, `conid` decides whether a
 * watchlist row can reach IB, and the option-market facts (`iv_pct`, `weekly_buckets`)
 * decide membership of NC / HIV / the shelf lists. None of that is checked anywhere: a
 * renamed ticker, a fund typed as a stock, or a name whose options stopped listing simply
 * keeps being screened on whatever we last stored.
 *
 * Read-only. Prints one section per defect class, worst first, and exits 1 if any BLOCKING
 * class is non-empty — so it can gate a deploy. Advisory classes (things that are true but
 * not wrong, e.g. a fund with no option market we deliberately track) print and do not fail.
 *
 * Run: npm run audit:metadata
 */
import { prisma } from "../src/lib/db";
import { SECTOR_ORDER } from "../src/lib/sectors";
import { LEV_ETFS, isInverseFund, leverageFactor, LEV_MIN_FACTOR } from "../src/lib/leveraged";
import { OFF_INDEX_SECTOR } from "../src/lib/enrich";

const num = (v: unknown): number | null => (v == null ? null : Number(v));
const DAY = 86_400_000;

type Finding = { ticker: string; detail: string };
type Section = { key: string; title: string; why: string; blocking: boolean; findings: Finding[] };

async function main() {
  const secs = await prisma.security.findMany({
    include: { quote: true, trend: true },
    orderBy: { ticker: "asc" },
  });
  const active = secs.filter((s) => s.isActive);
  const positions = await prisma.position.findMany({ select: { symbol: true, right: true } });
  const held = new Set(positions.map((p) => p.symbol.toUpperCase()));
  const heldOptions = new Set(positions.filter((p) => p.right != null).map((p) => p.symbol.toUpperCase()));
  const now = Date.now();

  const sections: Section[] = [];
  const add = (key: string, title: string, why: string, blocking: boolean, findings: Finding[]) =>
    sections.push({ key, title, why, blocking, findings });

  // ── 1. identity ────────────────────────────────────────────────────────────
  add(
    "name-is-ticker",
    "Name is just the ticker",
    "the ingest fell back to the symbol because Yahoo returned no name — the row was never enriched. " +
      "A description IS required too: IBM, MSCI and UBER are legitimately named after their ticker in the " +
      "constituent list, and flagging them taught nothing",
    true,
    active
      .filter((s) => s.name.trim().toUpperCase() === s.ticker.toUpperCase() && !s.description)
      .map((s) => ({ ticker: s.ticker, detail: `name "${s.name}", no description` })),
  );

  add(
    "no-quote",
    "No quote row at all",
    "the security exists but no ingest has ever priced it, so every screen silently skips it",
    true,
    active.filter((s) => !s.quote).map((s) => ({ ticker: s.ticker, detail: `sector ${s.sector}` })),
  );

  add(
    "stale-quote",
    "Quote older than 3 days",
    "the daily ingest should touch every active name; a stale row means its fetch has been failing unnoticed",
    true,
    active
      .filter((s) => s.quote && now - s.quote.asOf.getTime() > 3 * DAY)
      .map((s) => ({ ticker: s.ticker, detail: `as of ${s.quote!.asOf.toISOString().slice(0, 10)}` })),
  );

  // ── 2. classification ──────────────────────────────────────────────────────
  const known = new Set<string>(SECTOR_ORDER as readonly string[]);
  add(
    "unknown-sector",
    "Sector outside SECTOR_ORDER",
    "the analyzer groups by sector; an unlisted value renders in no tab and falls back to itself as a risk theme",
    true,
    active.filter((s) => !known.has(s.sector)).map((s) => ({ ticker: s.ticker, detail: `sector "${s.sector}"` })),
  );

  // A geared fund typed "stock" silently leaves LEV/LEVHIV/LEVMIX (isLongLeveragedEtf
  // requires type === "etf"), which is how a 3x fund would quietly stop being screened.
  add(
    "geared-not-etf",
    "Geared fund not typed as an ETF",
    "isLongLeveragedEtf() requires type=etf, so this fund is invisible to every LEV list",
    true,
    active
      .filter((s) => s.type !== "etf" && (leverageFactor(s.name) ?? 0) >= LEV_MIN_FACTOR)
      .map((s) => ({ ticker: s.ticker, detail: `type ${s.type} · "${s.name}"` })),
  );

  // The curated shelf is the source of truth for the geared universe (lib/leveraged.ts).
  const shelf = new Map(LEV_ETFS.map((e) => [e.ticker, e]));
  add(
    "shelf-not-ingested",
    "On the curated geared shelf but not in the universe",
    "LEV_ETFS is spliced into the ingest list, so a missing one means the ingest never ran or the symbol is wrong",
    true,
    LEV_ETFS.filter((e) => !secs.some((s) => s.ticker === e.ticker)).map((e) => ({ ticker: e.ticker, detail: `${e.factor}x ${e.family}` })),
  );

  add(
    "shelf-name-drift",
    "Shelf fund's stored name no longer states its leverage",
    "the LEV classifier reads the NAME; if the stored name loses its factor the fund drops off the shelf silently",
    true,
    active
      .filter((s) => shelf.has(s.ticker) && !shelf.get(s.ticker)!.hazard)
      .filter((s) => (leverageFactor(s.name) ?? 0) < LEV_MIN_FACTOR)
      .map((s) => ({ ticker: s.ticker, detail: `"${s.name}" reads ${leverageFactor(s.name) ?? "no factor"}` })),
  );

  // An inverse fund reaching a long list is a bullish bet on the index it shorts.
  add(
    "inverse-on-shelf",
    "Inverse fund on the curated LONG shelf",
    "writing a call on a -2x/-3x fund is a bullish bet on its index — the opposite of the book's intent",
    true,
    LEV_ETFS.filter((e) => isInverseFund(e.name)).filter((e) => !e.hazard).map((e) => ({ ticker: e.ticker, detail: `"${e.name}"` })),
  );

  // ── 3. IB reachability ─────────────────────────────────────────────────────
  add(
    "no-conid",
    "No IB conid",
    "a name without a conid cannot be pushed to an IB watchlist and cannot be snapshotted for greeks or IV",
    true,
    active.filter((s) => !s.conid).map((s) => ({ ticker: s.ticker, detail: held.has(s.ticker) ? "HELD" : `sector ${s.sector}` })),
  );

  add(
    "held-not-tracked",
    "Held instrument missing from the universe",
    "a position we cannot screen is a position no gate can see",
    true,
    [...held].filter((t) => !secs.some((s) => s.ticker === t)).map((t) => ({ ticker: t, detail: "in positions, not in securities" })),
  );

  // ── 4. option-market facts the screens gate on ─────────────────────────────
  add(
    "no-iv-held-option",
    "No IV, but we hold options on it",
    "every cushion, roll and target gate on this name is computed from an IV that does not exist",
    true,
    active
      .filter((s) => heldOptions.has(s.ticker) && num(s.quote?.ivPct) == null)
      .map((s) => ({ ticker: s.ticker, detail: `ladder ${s.quote?.weeklyBuckets ?? 0}` })),
  );

  add(
    "no-iv",
    "No IV (not held)",
    "no option market, or the chain fetch failed — the name is inert for every IV screen",
    false,
    active
      .filter((s) => !heldOptions.has(s.ticker) && num(s.quote?.ivPct) == null)
      .map((s) => ({ ticker: s.ticker, detail: `type ${s.type} · ladder ${s.quote?.weeklyBuckets ?? 0} · $${Math.round(num(s.quote?.price) ?? 0)}` })),
  );

  add(
    "implausible-iv",
    "IV outside 1–500%",
    "a garbled inversion; stored as a fact it would move every IV floor it touches",
    true,
    active
      .filter((s) => {
        const iv = num(s.quote?.ivPct);
        return iv != null && (iv < 1 || iv > 500);
      })
      .map((s) => ({ ticker: s.ticker, detail: `iv ${num(s.quote?.ivPct)}%` })),
  );

  add(
    "iv-dte-out-of-band",
    "IV measured outside 21–45 DTE",
    "the strategy sells 30–45 DTE; an IV read off a far expiry is not the vol being sold",
    false,
    active
      .filter((s) => {
        const d = s.quote?.ivDte;
        return d != null && (d < 21 || d > 45);
      })
      .map((s) => ({ ticker: s.ticker, detail: `${s.quote!.ivDte} DTE` })),
  );

  // The guard (lib/ivsanity.ts) stops the impossible from being written; this surfaces what
  // it deliberately lets through, so a doubtful IV is visible rather than merely tolerated.
  add(
    "iv-disagrees-with-ib",
    "Our IV disagrees with IB by more than 50%",
    "one of the two is wrong on a number every screen gates on; usually ours, inverted from an after-hours last trade",
    false,
    active
      .filter((s) => {
        const ours = num(s.quote?.ivPct);
        const ib = num(s.quote?.ibIv30Pct);
        return ours != null && ib != null && ib > 0 && (ours / ib > 1.5 || ib / ours > 1.5);
      })
      .map((s) => ({
        ticker: s.ticker,
        // Provenance is printed because it decides what the disagreement MEANS. A "last"
        // reading that disagrees with IB is most likely our own after-hours artefact and
        // tonight's intraday pass may fix it; a "mid" reading that still disagrees was taken
        // off a live two-sided quote, so the gap is real and belongs to something else —
        // strike selection, or our single-expiry reading against IB's 30-day constant
        // maturity. The first is a data defect, the second is a measurement difference, and
        // only the second bears on whether the screens should switch to IB's number.
        detail:
          `ours ${num(s.quote?.ivPct)!.toFixed(1)}% vs IB ${num(s.quote?.ibIv30Pct)!.toFixed(1)}% ` +
          `(${(num(s.quote?.ivPct)! / num(s.quote?.ibIv30Pct)!).toFixed(2)}×, ours ${s.quote?.ivSrc ?? "unstamped"})`,
      })),
  );

  // Did the intraday repricing actually reach the universe? This is the one-line answer, and
  // the reason it is advisory rather than blocking: a name Yahoo will not quote two-sided
  // (or quotes 90% wide, which is not a quote) can only ever have a last-trade reading, and
  // that is a fact about its option market rather than a defect in ours. What it does tell
  // you is whether the 23:30/01:00/02:30 pass ran at all — before 2026-09-10 nothing stamped
  // provenance, so a universe-wide "unstamped" means the timer has not fired since.
  add(
    "iv-not-mid-priced",
    "IV still inverted from a last trade",
    "the intraday pass either has not run or could not get a usable two-sided quote; a last-trade IV on a thin chain " +
      "is the input that produced every name in the class above",
    false,
    active
      .filter((s) => s.quote?.ivPct != null && s.quote?.ivSrc !== "mid")
      .map((s) => ({ ticker: s.ticker, detail: `src ${s.quote?.ivSrc ?? "unstamped"}` })),
  );

  add(
    "no-trend",
    "No trend row",
    "NC and the cc screen require 1M/3M/6M trend; without it a name can never qualify, silently",
    false,
    active.filter((s) => !s.trend).map((s) => ({ ticker: s.ticker, detail: `sector ${s.sector}` })),
  );

  // ── 5. hygiene ─────────────────────────────────────────────────────────────
  add(
    "off-index-not-held",
    "Off-Index and no longer held",
    "these enter only because a position existed; once closed they linger in every screen as unclassified",
    false,
    active
      .filter((s) => s.sector === OFF_INDEX_SECTOR && !held.has(s.ticker))
      .map((s) => ({ ticker: s.ticker, detail: `"${s.name}"` })),
  );

  add(
    "duplicate-name",
    "Two tickers, one name",
    "usually a rename or a class-share pair; worth a look because one of them may be delisted",
    false,
    (() => {
      const byName = new Map<string, string[]>();
      for (const s of active) byName.set(s.name, [...(byName.get(s.name) ?? []), s.ticker]);
      return [...byName.entries()]
        .filter(([, ts]) => ts.length > 1)
        .map(([name, ts]) => ({ ticker: ts.join(" / "), detail: `both "${name}"` }));
    })(),
  );

  // ── report ─────────────────────────────────────────────────────────────────
  const width = 78;
  console.log(`Metadata audit · ${active.length} active instruments (${secs.length} rows) · ${new Date().toISOString().slice(0, 16)}Z\n`);
  let blockingTotal = 0;
  for (const s of sections) {
    if (!s.findings.length) continue;
    if (s.blocking) blockingTotal += s.findings.length;
    console.log(`${s.blocking ? "✕" : "·"} ${s.title} — ${s.findings.length}`);
    console.log(`  why it matters: ${s.why}`);
    const shown = s.findings.slice(0, 20);
    for (const f of shown) console.log(`    ${f.ticker.padEnd(12)} ${f.detail}`.slice(0, width + 12));
    if (s.findings.length > shown.length) console.log(`    … and ${s.findings.length - shown.length} more`);
    console.log("");
  }
  const clean = sections.filter((s) => !s.findings.length).map((s) => s.key);
  if (clean.length) console.log(`clean: ${clean.join(", ")}\n`);
  console.log(
    blockingTotal === 0
      ? "No blocking metadata defects."
      : `${blockingTotal} BLOCKING metadata defect${blockingTotal === 1 ? "" : "s"} — see above.`,
  );
  if (blockingTotal > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("metadata-audit failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
