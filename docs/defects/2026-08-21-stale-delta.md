# Defect record — the delta was wrong for three days and nothing said so

**Date found:** 2026-08-21 · **Reported by:** user ("the option delta value is wrong") ·
**Severity:** high (a trading gate silently misread) · **Status:** fixed and deployed
2026-08-21 (see § 6) · **Code:** `api/greeks`, `lib/positions.ts`, now `lib/greekage.ts`

---

## 1. Summary

Every per-contract delta on `/positions`, `/pnl-predict`, `/risk`, `/orders`,
`/short-call/actions` and the RED watchlist was the value IB computed at the **2026-08-18
US close**, rendered beside marks and spots that were minutes old. The stored numbers were
**not corrupt — they were 45 hours stale**, and nothing in the schema, the API, the read
path or the UI could tell the difference.

The most expensive single consequence: a short NOW Oct-02 145 call carried a stored
Δ 0.178 while its own mark implied **0.308**. 0.30 is the roll/give-up line
(docs/short-call-strategy.md § 5) and the RED-watchlist predicate. A leg that had drifted
past the line looked comfortably inside it, on every page, for three days.

**There is no error log for this incident.** Nothing threw, nothing was null, no HTTP
status was non-200. `log/prod.log` does contain errors across the window, but not one of
them is related: they are all `next start` racing a build (`Could not find a production
build in the '.next' directory`), and the log has **zero** lines mentioning greeks or
deltas. A stale number is indistinguishable from a fresh one to every mechanism the app
had — which is precisely why it survived three days of daily use. This file is the log that
should have existed.

## 2. What the user saw

A delta that did not match the position. Concretely, the five worst legs at the moment of
the report (stored → what the leg's own mark implied):

| leg | stored Δ | true Δ | underlying move 08-18 → 08-20 |
| --- | --- | --- | --- |
| NOW C145 10-02 | 0.178 | **0.308** | 119.49 → 129.75 (+8.6%) |
| MRVL C320 09-18 | 0.078 | 0.188 | +9.7% |
| SLV C70 09-11 | 0.070 | 0.174 | +7.8% |
| GDX P78 10-16 | −0.189 | −0.077 | 88.95 → 99.85 (+12.3%) |
| NFLX C85 09-18 | 0.203 | 0.286 | +5.9% |

Direction is the tell: every call delta was understated on a name that rallied, every put
delta overstated. That is the signature of an old spot, not of a bad formula.

## 3. Why it was wrong

Five defects in series. Any one of them alone would have been survivable.

**3.1 — An IB market-data snapshot is an event, not a feed.** The extension fetches greeks
by calling `/iserver/marketdata/snapshot?fields=…7308…` for the held conids. That happens
only when a sync *runs the greeks pass*; IB replies with its last computed values.
Positions, marks, spots and balances refresh on every sync. So the delta and the mark it
is displayed next to were never on the same clock, and nothing in the design acknowledged
that.

**3.2 — Only a manual click refreshed them.** By deliberate design (documented in
CLAUDE.md), auto-sync and login-sync **skipped** greeks to avoid Chrome throttling the
in-page poll loop in a background tab. Consequence: the greeks pass had run exactly twice
in ten days (`option_harvest_sync_runs`: 08-11 manual/deep, 08-19 manual), while positions
were pulled on 08-19 ×3, 08-20, and 08-21. The freshest possible delta was whenever the
user last happened to press a button.

**3.3 — The one refresh landed while the US market was shut.** The 08-19 snapshot is
stamped `05:55:22Z` = **01:55 ET**. IB therefore served the 08-18 close's greeks. So even
the "fresh" measurement was a day old the instant it was taken.

**3.4 — The freshness timestamp actively lied.** This is the core defect.
`src/app/api/greeks/route.ts` built its update as:

```ts
const data = { at: now };                      // ← unconditional
if (g.delta != null) data.delta = g.delta;     // ← conditional
…
await prisma.optionGreek.upsert({ where: { conid }, update: data, … });
```

A contract whose snapshot came back empty — routine outside US hours, or when IB's
market-data lines are exhausted — kept its **old delta** and received a **brand-new
`at`**. The row's only timestamp described "when we last asked", while the reader would
inevitably take it for "when this delta was measured". After the fact, the age of any
given delta was unrecoverable from the database. The response did return
`updated` (contracts that actually answered), but nothing persisted that per conid, so the
signal died with the HTTP response.

**3.5 — No consumer ever read the timestamp anyway.** `getPositionGroups` selected the
whole greek row and copied only `delta` / `gamma` / `theta` onto the leg. No page showed an
age; no gate checked one; nothing cross-checked the value against anything else, even
though `lib/blackscholes.ts` — which can recover a delta from a price — already existed in
the repo for `/short-call`. The only staleness signal in the entire app was `/sync`'s
per-dataset card turning amber past 24h, and it was fed by the timestamp from § 3.4.

**Contributing:** `iv` was NULL on all 199 rows (field 7283 has never come back in the
greeks batch), so IB's own implied vol wasn't available as a sanity check on IB's own
delta — and the "only write fields IB returned" rule made that silence invisible too.

## 4. Evidence

Read-only, against prod, at the time of the report. Reproducible with
`npm run audit:greeks`.

Every stored delta came from one snapshot, 45h before the report:

```
select count(*), min(at), max(at) from option_harvest_option_greeks;
  199 | 2026-07-07 03:53:36 | 2026-08-19 05:55:22      ← 01:55 ET, after the 08-18 close
```

Re-pricing each held leg twice — once at the underlying's 08-18 close, once at the current
spot, using the σ implied by the leg's own current mark — settles whether the numbers were
*wrong* or *old*:

```
legs compared = 51
stored Δ matches the 2026-08-18 close within 0.03:  50/51
stored Δ matches TODAY's spot   within 0.03:        20/51
```

The values were right when taken and wrong when read. 17 of 51 were off by more than 0.05.
Meanwhile the marks those legs were displayed next to came from the 2026-08-21 00:55 sync
— minutes old.

Supporting counts: 148 of 199 greek rows belonged to contracts no longer held; 0 rows
carried any IV.

## 5. Impact on decisions

Not cosmetic. The effective-delta corrections moved live gates:

- **`/risk` → "|Δ| over 0.3"** (the roll line, `bookrisk.ts`): NOW C145 was absent; it is
  now listed. That is a management decision that was hidden for three days.
- **RED watchlist** (`|Δ| > 0.30` on held names): computed from the stale deltas, so a
  drifted leg could not raise it, and legs IB had never priced dropped out silently
  ("excluded, not assumed safe" — but invisibly).
- **`/risk` net Δ$, Δ-band conformance, the by-delta distribution, `/positions` row
  tinting and the `/short-call/actions` gates** all consumed the same stale field.
- **`/wl-log`** attributed RED add/removes to "|Δ| past 0.30" using it, so the change log
  explained real membership flips with a number that hadn't moved in days.

**Was anything traded off the bad value?** Not determinable, and it should not be
overstated. `option_harvest_transactions` records **13 fills on 2026-08-19** (FTNT, GDX,
LABU, MRNA, SLV, TXN, USO) — the same day as the snapshot, when the delta was at most one
session old — and **no fills recorded on 08-20 or 08-21** (latest `trade_date` = 08-19),
which is when the drift accumulated. The synced book did shrink over the window
(62 → 58 → 52 legs per `option_harvest_sync_runs`) without matching fills, so the ledger
may simply be incomplete for the last day; that gap is not investigated here. What can be
said: the exposure was three days of decisions taken against a hidden 0.31, with no trade
demonstrably caused by it. The cost is decision latency and a management signal that never
fired, not a documented realized loss.

## 6. Fix

Deployed 2026-08-21 (`npm run build && sudo systemctl restart option_harvester`; 13 pages
verified 200).

1. **Per-field freshness.** `OptionGreek.deltaAt` (`delta_at`) added and pushed to both
   DBs. `api/greeks` now moves `at` only when a greek actually arrived, stamps `deltaAt`
   when the delta did, rejects `|δ| > 1`, and returns `updated / stale / rejected`. A
   contract that answers nothing is left completely alone — its delta stays visibly old.
2. **A cross-check on every read.** New pure `src/lib/greekage.ts`: `readDelta` reports the
   measurement age, the delta implied by the leg's own mark (invert Black-Scholes for σ,
   read δ off the same model — the method `/short-call` already uses for historical fills),
   and which of the two to act on. Fresh and agreeing → IB's measurement; stale (>18h) or
   diverged (>0.05) → the model, because the mark is minutes old. Where a leg hasn't moved
   the two coincide, which is the check that the fallback isn't inventing risk.
3. **Provenance on screen.** `components/DeltaCell.tsx`: `0.31ᵐ` marks a model-derived
   value, hover gives both numbers, the implied σ and the age. `/positions` gained a **Δ
   age** column; `/positions`, `/pnl-predict` and `/risk` carry a Δ-provenance banner.
   `/sync`'s greeks card is now dated by the newest `delta_at`, with the oldest in its
   detail line.
4. **More refreshes.** Extension **0.9.6**: auto-sync and login-sync take the greeks pass
   too, but only while the IB tab is the one on screen (`tabInForeground` — active tab,
   focused window), which is the honest resolution of the § 3.2 trade-off. When skipped the
   run records `greeksSkipped` rather than leaving an old delta looking current.
5. **Gates.** `scripts/greeks-check.ts` (57 assertions, in `npm run check` → 441 over seven
   scripts) pins the thresholds, the model inversion and the decision, using this
   incident's own legs as fixtures. `npm run audit:greeks` reproduces § 4 on demand.

**Found while fixing, also changed:** `PositionSummary.maxOptAbsDelta` counted *long* legs.
Once the deltas became real, a long GDX 2028 LEAP at Δ 0.42 and a long SLV LEAP at 0.32
entered RED — a list that exists to flag **assignment** risk, which a long option cannot
carry. Restricted to short legs; RED went `[GDX, NOW, SLV]` → `[NOW]`. The old predicate
only looked correct because long legs rarely had greeks.

**Not fixed:** the per-leg action ladder in `posanalysis.ts` keys off moneyness and
captured premium, not delta, so NOW C145 still reads "hold" on `/positions` while `/risk`
flags it past the roll line. That is a doctrine question, not a data defect.

## 7. The lesson worth keeping

The failure mode was not "a bad number". It was **a number that could not be questioned**:
one column, one timestamp, no provenance, no second opinion, and a UI that rendered it with
the same authority as a live price. Every measured quantity that reaches a trading decision
needs three things attached — *when it was measured*, *what an independent method says*, and
*which one is being used*. Anything that arrives by snapshot rather than by feed should be
assumed stale until it proves otherwise, and the proof has to survive into the database.

## 8. Reproduce / verify

```bash
npm run audit:greeks     # per-leg: IB Δ + its age vs the mark-implied Δ, and the gap
npm run check:greeks     # the pure gate (57 assertions)
npm run check            # full suite (441)
```
