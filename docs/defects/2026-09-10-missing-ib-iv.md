# Defect record — every IV in the app was ours, and IB's was never once captured

**Date found:** 2026-09-10 · **Reported by:** user ("how do you retrieve the iv value? does
it match the last iv value in ib? we have to use same value") · **Severity:** medium (no
corrupt data; a number every screen gates on had never been checked against the broker's,
and the mechanism built to check it had been silently returning nothing for two months) ·
**Status:** four defects fixed and deployed 2026-09-10 (§ 6, § 10); the precedence decision
they exist to inform is **open** (§ 8) · **Code:** `extension/background.js`, `src/lib/ibparse.ts`,
`src/app/api/underlying-iv/route.ts` (new), `quotes.ib_iv_30_pct` (new), `src/lib/ivsanity.ts` (new)

---

## 1. Summary

Two independent defects, found together, both of the same shape: **a value that was
requested, was available, and was never stored.**

1. **`option_harvest_option_greeks.iv` had been NULL for every row since the table was
   created** (2026-07-07). 231 rows, 231 with a delta, **0 with an IV**. The pass asked IB
   for field **7283** on option contracts; IB serves 7283 only on *underlyings*, and the
   per-strike IV is **7633**. A second defect hid the first: the poll loop released a conid
   the moment delta arrived, so even a field that did arrive late was discarded.
2. **IB's own implied vol for the underlying had never been fetched at all.** The `ib_*`
   comparison columns on `quotes` — `ib_iv_pct` and friends, added specifically so the two
   sources could be diffed — were populated for **0 of 661** tickers, because the flow that
   fills them had never been run.

Consequence: every IV on every page and in every gate (`NC_IV_MIN` 40%, `HIV_IV_MIN` 50%,
the three shelf floors, the σ cushion, the cc model's `iv_rv`) is a number **this app
computes itself** — a Black–Scholes inversion of a Yahoo option chain — and there was no
way to say whether it agreed with the broker the trades are placed at. The user's question
was not answerable when it was asked.

**There is no error log for this incident either.** Nothing threw. The greeks pass reported
`updated 49/49, stale 0` — truthfully, because a delta *did* arrive for all 49 contracts.
A column that is always NULL is indistinguishable from a column nobody has populated yet,
and `/sync` had no card for a feed that had never delivered. Like
`2026-08-21-stale-delta.md`, this file is the log that should have existed.

## 2. What the user saw

Nothing on screen — which is the point. The report was a question, not a bug sighting:
*does our IV match IB's?* The honest answer at 09:46 was "we cannot tell, and here is why",
which is what turned a question into two defects.

The first hint that something was mechanically wrong came from the data, not the UI:

| table | rows | with delta | with IV |
| --- | --- | --- | --- |
| `option_harvest_option_greeks` (2026-07-07 → 09-10) | 231 | 231 | **0** |

## 3. Why it was wrong

### 3.1 — 7283 is the underlying's vol; 7633 is the strike's

IB's Client-Portal field reference is explicit, and the two entries even cross-reference
each other:

> `7283` — **Option Implied Vol. %**. A prediction of how volatile an underlying will be in
> the future. At the market volatility estimated for a maturity **thirty calendar days
> forward** of the current trading day, and based on option prices from two consecutive
> expiration months. *To query the Implied Vol. % of a specific strike refer to field 7633.*

> `7633` — **Implied Vol. %**. The implied volatility for the **specific strike** of the
> option in percentage. *To query the Option Implied Vol. % from the underlying refer to
> field 7283.*

`fetchGreeksBatchInPage` requested `31,84,86,7283,7308,7309,7310,7311` for **option**
conids. So it asked every contract for a number that only exists on its underlying. IB
answered the request — with delta, gamma, theta and vega — and simply omitted the field it
does not serve there. The mapper read `o["7283"]`, got `undefined`, and wrote nothing.

The 2026-09-10 10:01 run is the clean proof: **49 contracts asked, 49 deltas returned, 0
stale, 0 IVs.** IB was answering. We were asking the wrong question.

### 3.2 — The poll loop stopped at the first field it wanted

IB computes snapshot analytics progressively: the first response to a fresh subscription
often carries nothing, and the fields fill in over the following polls. The loop accounted
for that, but released each conid as soon as **delta** appeared:

```js
if (rows[c]["7308"] != null && rows[c]["7308"] !== "") need.delete(c);
```

Any field IB computed one poll later was requested, returned on a later poll that no longer
ran for that conid, and dropped. On its own this would have cost a fraction of the IVs; in
series with § 3.1 it made the outcome total and the cause invisible — fixing either one
alone still yields an empty column, which is exactly why the first fix (the poll condition,
shipped in 0.9.8) changed nothing and looked like the wrong diagnosis.

### 3.3 — The comparison columns were plumbing with no pump

`quotes.ib_price / ib_iv_pct / ib_iv_dte / ib_atm_* / ib_delta / ib_at` exist, are
documented as *"kept separate from the Yahoo fields so the two can be compared"*, and are
filled by `POST /api/options` from the extension's per-ticker ATM walk. That action had
never been clicked: **0 of 661** rows populated. A comparison facility that is never
exercised is a comparison facility that does not exist, and nothing on `/sync` said so
because a dataset card only appears for feeds that have a row.

### 3.4 — Then the new sweep filled only 57% per run

With `POST /api/underlying-iv` and the batched 7283 pass shipped (0.9.8), the first two runs
reported:

| run | tried | updated |
| --- | --- | --- |
| 10:18 | 630 | 361 |
| 11:03 | 630 | 363 |
| **union** | 630 | **447** |

Each pass filled a *different* ~57%. Three candidate causes, two eliminated by evidence:

* **Not the instruments.** Of the 214 names still unfilled, **209 have live option ladders**
  and trade a median **$258M/day** (filled group: $389M). Only 5 lack a ladder at all.
* **Not progressive line exhaustion.** Fill rate by 50-conid chunk, in request order:
  94%, 36%, 52%, 42%, 74%, 66%, 90%, 68%, 74%, 82%, 78%, 52%, 64%, 100%. Starvation would
  decay across the run. This does not.
* **It is IB not being ready.** `run1 ∩ run2 = 277` names; independence at p≈0.57 would
  predict ~205, so there is a persistent component (thinner chains take longer) on top of a
  large random one. 7283 is interpolated from two expiries' chains — real work — and a
  50-wide burst polled for 5 seconds does not finish it.

A miss therefore meant *"not computed yet"*, and the code treated it as an answer.

## 4. Evidence

Read-only, against prod, 2026-09-10:

```sql
-- § 3.1/3.2: the field that never arrived
SELECT count(*) rows, count(delta) with_delta, count(iv) with_iv, min(at), max(at)
FROM option_harvest_option_greeks;
--  231 |  231 | 0 | 2026-07-07 03:53 | 2026-09-10 03:02     (before the fix)
--  231 |  231 | 49 (IV 21.9%–137.8%)                        (after 7633 shipped)

-- § 3.3: plumbing with no pump
SELECT count(ib_iv_pct) FROM option_harvest_quotes;   -- 0 of 661

-- § 3.4: two runs, different halves
SELECT date_trunc('minute', ib_iv_30_at), count(*) FROM option_harvest_quotes
WHERE ib_iv_30_pct IS NOT NULL GROUP BY 1;
--  02:18Z |  84     (the survivors of run 1 that run 2 did not refresh)
--  03:03Z | 363
```

The greeks run summary that proves IB was answering (`option_harvest_sync_runs`, 10:01):
`{"stale": 0, "tried": 49, "errors": [], "updated": 49, "received": 49}`.

## 5. Impact on decisions

Once IB's number existed for 447 names, `npm run iv:compare` gave the answer the user asked
for — and it is not "they agree" or "they disagree", it is both:

* **The middle agrees.** Median gap (IB − ours) **−1.0pp**, median |gap| **1.1pp**, 334 of
  447 within 2pp, 424 within 5pp.
* **A hypothesis of mine was wrong.** Ours reads a single expiry (29 DTE for half the
  universe, 36 for the rest) where IB interpolates to exactly 30 days, so I expected the two
  cohorts to diverge. They don't: **−1.1pp at 29 DTE vs −0.7pp at 36 DTE.** The
  single-expiry mismatch is not what drives the gap.
* **The tail is ours, and it points at a real defect.** APA 44.7→12.6, MTD 55.1→27.2,
  WRB 41.6→23.3, BILI 65.2→43.9, HIMS 99.6→67.5 — all thin option markets, all with our
  number higher. The nightly ingest runs at 06:0x local, i.e. **after the US close**, when
  Yahoo's bid/ask are 0 and `getAtmIv` falls back to the **last trade** — a print that can
  be hours old and far off mid. The intraday spreads pass already fetches live bid/ask
  during US hours but does not recompute IV.
* **It changes what the app recommends.** Names that sit on a different side of a floor
  depending on the source: **18** on the NC screen, **12** on HIV (GNRC, FSLR, WPM, GDXJ,
  FCX all within 1pp of the line — coin flips either way), **4** on ETFHIV (ITB, XHB, KWEB,
  KRE), **3** on LEVHIV.
* **A distinct finding about the cushion.** IB's per-strike IV (7633) on held legs sits
  where skew says it should: deep OTM puts above our ATM reading (SOXL 90P 135.2 vs 117.7,
  TQQQ 55P 81.9 vs 57.4), OTM calls below (HIMS 37C 75.8 vs 99.6). Not an error — but it
  means the σ cushion every entry gate uses is computed from an **ATM** vol while the
  contract actually sold is priced off **its own strike's** vol. For a Δ0.15 call those are
  not the same number.

## 6. Fix

Deployed 2026-09-10 across four extension versions; `npm run check` green throughout
(extension-check 34 → 102 assertions).

1. **Ask for the right field** (0.9.9). Greeks request `…,7283,7633,7308,…`; the mapper
   reads `7633 ?? 7283`, keeping 7283 as a free fallback should IB ever serve it on a
   contract. Result: 49/49 held contracts now carry an IV.
2. **Wait for what was asked** (0.9.8). The batch poll releases a conid only when delta
   **and** an IV are present, under the same 12-poll/6s cap, so a contract IB never prices
   for IV still cannot hang the pass.
3. **A pump for the comparison** (0.9.8). New `quotes.ib_iv_30_pct` / `ib_iv_30_at`, new
   `POST /api/underlying-iv`, new batched underlying pass + popup action **Get IB IV
   (30-day, underlyings)**, and IB's value is stored **beside** ours, never over it — they
   are different measurements, and overwriting one destroys the evidence needed to choose.
   Market-data lines are released with `/iserver/marketdata/unsubscribeall` between chunks,
   without which the second chunk returns empty.
4. **Narrowing rounds instead of one sweep** (0.9.12). Round 1 stays fast (50 conids, 10
   polls ≈ 5s); each later round re-asks **only the misses** with smaller bursts and a
   longer budget (20 conids, 16 polls ≈ 10s), stopping as soon as nothing is missing. Names
   IB answers instantly still cost 5s per 50; only the stragglers pay for patience.
5. **Two failure counts, not one.** `POST /api/underlying-iv` reports `noIv` (IB returned
   the instrument but not the analytic → transient, re-ask) apart from `silent` (nothing
   came back for that conid → subscription or conid problem). "Skipped" had been hiding the
   difference between patience and a fix.
6. **Guards.** The IV floor `0 < iv ≤ 500` on write, because a cold-stream 0 stored as a
   fact would read to every IV gate as *"this instrument has no volatility"*. `/sync` gains
   an **IB 30-day IV** dataset card so a feed that has never delivered is visible as such.
   `scripts/extension-check.ts` pins: the greeks request contains 7633; a late-arriving IV
   is captured; a never-priced IV still terminates at the cap; the poll budget is
   caller-controlled (the mechanism behind the rounds); `unsubscribeall` is called; a cold
   row yields no write; and the write guards reject 0 / negative / absurd IVs.
7. **`npm run iv:compare`** reports the gap, the gap by our reading's expiry, and — the part
   that matters — which names change sides of the NC/HIV/ETFHIV/LEVHIV floors depending on
   the source.

**Found while fixing, also changed.** `POST /api/sync-log` whitelisted
`{auto, deep, login, manual}` and silently rewrote anything else to `manual`. The new sync
tiers log as `full`/`quick`, so the **first real full sync** — the one carrying greeks,
margin, IB IV and a conid re-resolve — was recorded as `manual`, indistinguishable from a
fast pull, and the docs claiming otherwise were wrong. The route now stores a recognised
tier as-is and passes through any short lower-case slug: an unfamiliar label is a smaller
problem than a wrong label nothing can detect. The 11:05 row stays mislabelled; history is
not rewritten.

**Also found:** a **0.9.6** install was still reporting every 15 minutes beside the current
one, sharing its `extId` (an unpacked extension's id derives from its path, so this is the
same folder in another Chrome profile or on another machine). Two copies against one IB tab
compete for the same finite market-data lines — which would look exactly like § 3.4. That
is handled separately by the version gate (`src/lib/extversion.ts`, `src/middleware.ts`) and
the `/sync` stale-install banner.

## 7. The lesson worth keeping

**A field you request but never receive looks identical to a field you never wanted.** The
greeks pass reported `49/49 updated` for two months while delivering half of what it asked
for, because its success measure was the field it happened to check. The generalisation for
this codebase: when a write path accepts a set of fields, the count it reports should name
*which* fields arrived — `updated 49/49` was true and useless, `noIv 267 / silent 0` is what
made the next defect solvable in one query.

**And: "we have to use the same value" is not implementable until the two values exist side
by side.** The instinct to reconcile with the broker was right, but the first useful act was
not to switch sources — it was to store both and measure. That produced a falsified
hypothesis (§ 5, the DTE cohorts), a defect in our own input (after-hours last-trade
pricing), and a named list of 37 screen flips. None of that would have come from replacing
one number with the other.

## 8. Open — the precedence decision this exists to inform

Deliberately **not** done yet:

1. **Coverage first.** 447 of 661 as of 11:03; 267 names returned no analytic in that run.
   The rounds in 0.9.12 should close most of that gap — but names IB will not stream at all
   need our value as a permanent fallback, so the endpoint is IB-first-*with*-fallback, not
   IB-only.
2. **Fix our input before choosing.** Recompute `iv_pct` from **live intraday bid/ask**
   (the spreads pass already fetches them during US hours) instead of the after-hours last
   trade. Most of the >5pp tail in § 5 should collapse, and the choice of source should be
   made against our number at its best, not at its worst.
3. **Then switch the screens**, and re-check the floors: the flip list shows the thresholds
   sit near the mode of the distribution, so a systematic 1pp shift moves ~4% of names.
4. **The frozen `cc_scores` stay on our IV** regardless. Those predictions exist to be
   validated against the inputs they were fitted on; re-pointing their input would destroy
   the record, and the model would need a re-fit first.
5. **Consider strike-level IV for the cushion** (§ 5, last bullet). The gates size cushion
   in σ from an ATM vol; the contract sold has its own. That is a doctrine question for
   `docs/short-call-strategy.md`, not a data fix.

## 9. Reproduce / verify

```bash
# The comparison, and the flips it implies:
npm run iv:compare

# The invariants that keep both defects from returning:
npx tsx scripts/extension-check.ts     # 102 assertions

# Coverage and freshness of each side:
psql "$DB" -c "SELECT count(iv_pct) ours, count(ib_iv_30_pct) ib, max(ib_iv_30_at)
               FROM option_harvest_quotes"
psql "$DB" -c "SELECT count(*) rows, count(delta) d, count(iv) iv
               FROM option_harvest_option_greeks"
```

To refill IB's side: extension popup → **Get IB IV (30-day, underlyings)** with the IB
portal tab in the foreground (or **Sync now**, which includes the pass). `/sync` → the
**IB 30-day IV** card dates it.

## 10. Follow-up — same day, two more not-an-answers

Both found after § 6 shipped, and both the same mistake in a new costume.

### 10.1 — `"7283": "0"` silently defeated the retry rounds

The narrowing rounds of § 6.4 did nothing on their first live run. The extension decided a
conid was filled when the field was merely *present*:

```js
if (iv != null && iv !== "") got.set(String(row.conid), row);
```

IB answers `"7283": "0"` for a name it has not computed. So round 1 reported **"asked 643,
filled 643"** while the backend rejected 262 of those rows as implausible, `unfilled: 0`, and
rounds 2 and 3 never ran. Zero is IB saying "not yet" in the same field it uses to say 31.6.

Fixed in 0.9.14: the in-page poll and the round bookkeeping both apply the write path's own
guard (`0 < iv ≤ 500`). The next run showed the rounds working — `round 1: 578 filled →
round 2: asked 65, +41 → round 3: asked 24, +0` — and coverage went **447 → 630 of 643**.

The residual 24 are the honest floor: four have no option market (BTCU, EVMU, URAA, NVR), and
the other twenty include liquid names (ABNB, GE, HOOD, RDDT, SCHW) and geared funds (SOXS,
DUST, FAS, PLTU), so it is not liquidity — most likely a market-data-subscription boundary on
those listings. **They will need our value permanently, which settles the fallback design: IB
first, ours as fallback, never IB-only.**

### 10.2 — MLM was screening at 166% IV

With IB's number in place for 630 names the audit could finally be run the other way, and it
found ours: **MLM 166.2% against IB's 28.9%** — 5.74×, and 6.4× MLM's own recent median. Martin
Marietta has never had 166% implied vol. It was in the NC screen and the HIV list on that
number. Same family: APA 44.9 vs 12.8, HST 56.1 vs 22.7, MTD 55.2 vs 27.2, AVY 50.7 vs 26.9.

All are § 5's last-trade artefact, now guarded at write time by **`src/lib/ivsanity.ts`**: a
hard 1–400% band, >3× the instrument's own recent median, >2× IB's reading. A rejected value
leaves the previous one in place and is kept **out of `iv_history`**, so tomorrow's median
cannot be poisoned into accepting it. A live two-sided quote is trusted at any level, because a
vol spike is what this program sells and refusing it would be worse than storing a bad print.

The guard's limit is stated in its own source rather than discovered later: at 2× IB it catches
MLM, APA, HST and MTD, and it does **not** catch AVY (1.89×), UDR (1.88×), WRB (1.79×) or UYM
(1.79×). Tightening far enough to catch those would refuse genuine spikes. Those are fixed by
computing our IV from a live mid — `scripts/ingest-spreads.ts`, § 8 item 2, which now does
exactly that and had not yet run when the session closed. Meanwhile the 13 names where the two
sources differ by more than 50% are listed by `npm run audit:metadata` as an advisory class, so
a doubtful IV is visible rather than merely tolerated.

**Pattern worth naming, because it is now three for three.** Every defect in this incident was
a *not-an-answer accepted as an answer*: 7283 on a contract that never carries it, a cold row
with no field at all, and a zero. In all three the write-path guard held, which is why the
stored data stayed clean while the diagnostics lied about coverage. Guard the write, and make
the counter report *which* field arrived — `updated 49/49` was true and useless for two months.
