# Short Call Analyzer — build plan

**Status: shipped 2026-08-20 (all five phases).** Version 1.0. Owner: the `option-adviser`
role (`.kiro/agents/option-adviser.json`, method in [adviser-playbook.md](adviser-playbook.md)).

What landed, and where the plan changed under contact with the data:

* All eight pages live under `/short-call/*`, one shared load (`lib/sc-data.ts`).
* Engines: `sc-rules.ts` (registry), `sc-lifecycle.ts` (chains), `sc-loss.ts`,
  `sc-actions.ts`, `sc-candidates.ts`, `sc-timeline.ts`. Checks: `npm run check`
  (369 assertions over six scripts) plus the live reconciliation `npm run reconcile:sc`.
* **Changed from the plan:** the roll-target constructor puts §4.3's *credit-positive*
  requirement ahead of the entry cushion floor. Insisting on 1.5σ made nearly every roll
  impossible — at 40 IV and 40 DTE a 1.5σ strike prices in the tens of dollars, nowhere near
  the cost of closing a position that has moved against you — so it now takes the widest
  strike on a cushion ladder that still funds the buy-back, and says when that sits below the
  entry floor: a defence, not a fresh sale.
* **Changed from the plan:** "compliance unknown" had to be split from "no rule existed".
  Every chain in the record is v0.1 (pre-spec), so the current envelope is reported as a
  separate counterfactual instead of being backdated into a breach.
* **Not built:** the frozen weekly `reviews/sc-<date>.json` artifact (§4.5) — deferred until a
  revision exists that it could measure.

Goal: turn the short-call program from *a record you read after the fact* into *an
instrument you trade from* — lifecycle-aware (created → rolled → closed), honest about
wins and losses, prescriptive on the open book and on what to open next, sliceable
week-by-week / by category / by name, and **versioned**, so the strategy can evolve
without invalidating its own history.

---

## 0. What already exists (reuse, don't rebuild)

| Page | Owns | Engine |
| --- | --- | --- |
| `/short-call` | closed-trade record: KPIs, reason attribution, cohorts (Δ / σ / DTE / hold / theme / exit), Δ×DTE zone grid, per-target verdicts, every closed trade | `src/lib/shortcall.ts` (`buildScRecord`, `buildGrid`, `buildTarget`, `classify`) |
| `/risk` | live book limits: theme HHI, σ-to-strike, trend divergence, earnings, margin ÷ NLV, side skew, per-leg verdict + priority | `src/lib/bookrisk.ts` (`buildBookRisk`, `verdictFor`, `sigmasToStrike`, `themeOf`) |
| `/pnl-predict` | open legs: greeks, earned/unearned premium, by-expiry detail | `src/lib/pnl.ts`, `src/app/pnl-predict` |
| `/transactions`, `/positions`, `/orders` | the ledger, IB state | `pnl.ts` (`computePnl`, `weeklyByMonth`, `buildRolls`), `positions.ts`, `ibparse.ts` |
| `/` + `/watchlists` | candidate supply: NC screen, HIV/LEV lists, Edge (CC model) | `securities.ts` (`NC_*` consts), `ccscore.ts`, `watchlists.ts` |

Three real gaps, and they are the reason this plan exists:

1. **No lifecycle.** `shortcall.ts` scores *legs* and excludes open ones (`openTrades` is a
   count). `pnl.ts:buildRolls` builds chains but nothing joins them to the record — so a
   position rolled four times reads as four trades, three of them tagged
   `management_cost` losses. The chain, not the leg, is the economic unit.
2. **No prescription in one place.** `verdictFor` already produces close/roll/defend/
   let_expire/hold with reasons; nothing turns that into a ranked worklist, and nothing
   ranks *what to open* against the book's own headroom and the name's own record.
3. **No time axis and no version axis.** Weekly buckets exist for total P&L, not for the
   short-call program; and thresholds live scattered across three libs with no notion of
   *which version of the strategy a trade was opened under*.

---

## 1. Analysis plan — the questions, and how each is answered

Evidence rules are the playbook's (cite `n` or `file:line`; label measured / inferred /
unknown; ≥12 trades per cohort, no cell under 3; ≥3 closed trades per name verdict).

| # | Question | Method | Unit |
| --- | --- | --- | --- |
| Q1 | What happened to each position from creation to death? | event chain from transactions: `SELL_OPEN → [BUY_CLOSE+SELL_OPEN]* → BUY_CLOSE \| EXPIRED \| ASSIGNED` | chain |
| Q2 | Win rate / loss rate | wins ÷ trades, reported **both** chain-wise and leg-wise | both |
| Q3 | Why did losses happen, and were they avoidable? | reason codes (§5) × rule compliance at entry and exit × counterfactual | chain + leg |
| Q4 | What should I do with what I hold? | `verdictFor` + roll target construction, ranked by priority and by money at risk | leg |
| Q5 | What should I open next? | candidate supply ∩ entry envelope ∩ σ-cushion ∩ name verdict ∩ theme headroom ∩ event gate | candidate |
| Q6 | How has the program behaved over time? | weekly cadence (cash view) **and** weekly vintages (cohort view) | week |
| Q7 | Which categories pay? | theme / type (ETF·stock·leveraged) / sector / IV bucket / Δ×DTE cell / rule-version | cohort |
| Q8 | Did the last strategy revision actually help? | before/after cohort split on `ruleVersion`, with n-sufficiency gate | version |

Two definitions that must be stated on every page that uses them, because they change the
headline numbers:

* **Unit of account.** *Chain* = one economic bet including its rolls. *Leg* = one
  contract as executed. The current 189-trade record is leg-based; chain-based win rate
  will read **higher** (rolled legs stop being individual losses) while chain loss *size*
  reads worse. Both are shown, never mixed in one table.
* **Win.** `realized > 0` net of commission. **Breach** = underlying traded at/through
  the strike while the position was on (path, from daily highs) — independent of win.
  **Kept %** = realized ÷ credit. **Avoidable loss** = a loss where an entry rule was
  violated at open or a management rule was violated at exit; everything else is *market*.

Invariants any implementation must satisfy (these are the tests, not decoration):

* `Σ chain.realized == Σ leg.realized` (regrouping must not create or destroy money);
* leg-wise totals reproduce today's `/short-call` KPIs exactly (no silent redefinition);
* every chain link is reachable from a transaction id (provenance, no synthesized fills);
* rule verdicts are pure functions of (leg state, rule version) — same input, same output.

---

## 2. The menu

`Short Calls` stays a single top-level entry (TopNav already carries 14 links); the
section gets its own sub-nav (`src/components/SectionNav.tsx`), the same pattern as the
anchor bar on `/pnl-predict`.

```
Short Calls  ▸  Scorecard · Lifecycle · Loss lab · Open book · What to sell · Timeline · Cohorts · Strategy
```

| Route | Page | Answers | Status |
| --- | --- | --- | --- |
| `/short-call` | **Scorecard** | Q2 + headline attribution | exists → refit |
| `/short-call/lifecycle` | **Lifecycle** | Q1 | new |
| `/short-call/losses` | **Loss lab** | Q3 | new |
| `/short-call/actions` | **Open book** | Q4 | new (thin over `bookrisk`) |
| `/short-call/candidates` | **What to sell** | Q5 | new |
| `/short-call/weekly` | **Timeline** | Q6 | new |
| `/short-call/cohorts` | **Cohorts** | Q7 | new (moves tables off Scorecard) |
| `/short-call/strategy` | **Strategy & revisions** | Q8 | new |

`/risk` stays the whole-book (calls **and** the panic-put side) limit monitor and
`/pnl-predict` stays the greeks/unearned view. The analyzer section is short-calls-only
and links out rather than re-rendering either.

### 2.1 Scorecard — `/short-call`

Leaner than today. Keeps: KPI strip (trades, credit, realized, kept %, win rate, breach
rate, avg entry Δ/σ/DTE), *What actually paid* (reason attribution), best/worst envelope
callout, and the closed-trade table. Adds: a **chain-vs-leg toggle** on the KPI strip, an
**open-book strip** (open chains, credit at risk, how many need action today → links to
Open book), and a **compliance line**: share of trades that were inside the envelope in
force *at their open date*. Moves out: the six cohort tables and the Δ×DTE grid → Cohorts.

### 2.2 Lifecycle — `/short-call/lifecycle`

One row per **chain**, newest first, expandable to its legs:

`name · theme · state · opened · age · rolls · legs · gross credit · debits paid · net realized · kept % · terminal reason · rule version · link confidence`

* **State machine** shown as a chip trail per chain: `sold → rolled ×n → closed | expired | assigned | open`.
* Per-leg detail: strike/expiry, entry premium, reconstructed entry IV/Δ/σ-cushion, exit
  premium and IV, days held, whether each roll was **credit-positive**, whether it rolled
  **up as well as out** (same-strike-further-out is flagged: §4.3 says that is not a
  defence), and whether the new expiry stayed inside 365 days.
* **Roll ledger per chain**: cumulative credit vs cumulative debits — the answer to "is
  this chain still ahead, or have I been paying to keep a bad trade alive?"
* Filters: state, theme, rolls ≥ 1, open only, rule version, link confidence.
* Open chains are first-class here (their unrealized comes from `pnl.ts`), clearly marked
  as unrealized and excluded from realized cohorts.

### 2.3 Loss lab — `/short-call/losses`

Every losing chain and leg, dissected. Four blocks:

1. **Anatomy table** — loss ÷ credit (in multiples), reason code, breach or not, days
   from open to first breach, peak vs strike, IV change, and the **rule audit**: which
   entry rule was broken at open (Δ too high, cushion <1σ, DTE outside the envelope for
   that Δ, name already rising, earnings inside life, name already on a negative verdict)
   and which management rule was broken at exit (harvested below/above 70%, rolled a
   name that had turned up, rolled past the 1-year wall, closed inside 7 days).
2. **Avoidable vs market** — the single most useful number on the page: what share of
   total loss came from trades that broke a rule you already had. Split by rule id.
3. **Counterfactuals** (labelled *inferred*, from daily bars): what would the trade have
   paid if held to expiry instead of bought back; what the roll cost versus closing and
   re-selling fresh; expected value of the <7-day exit cohort had it been left alone. This
   is the direct attack on the record's biggest leak (bought-back −$9,850 vs
   expired +$11,480) and on open question §7.5 (stop vs roll).
4. **Repeat offenders** — names and themes with recurring losses, and whether the name was
   still in a candidate list after its verdict turned negative (a §2.5 breach).

### 2.4 Open book — `/short-call/actions`

The worklist. One row per open short call, sorted by `priority` then credit at risk:

`action · name · strike/expiry · DTE · spot vs K · |Δ| · σ cushion · captured % · cost to close · credit at risk · earnings in life · trend now · rule cited · why`

* Actions come from `bookrisk.verdictFor` (`defend / close / roll / let_expire / hold`),
  restated as instructions: *harvest now*, *let it lapse*, *roll to ≥N DTE at ≥K′ for
  credit*, *close — no roll fits inside the 1-year wall*, *close — name has turned up*.
* Each row cites the rule id and shows the **margin** (e.g. `0.82σ vs 1.00 floor`,
  `Δ 0.34 vs 0.30 watch line`), never a bare colour.
* **Roll target constructor**: given the leg, propose the expiry/strike that satisfies
  §4.3 (out *and* up, credit-positive at current IV, ≥30 days room, inside 365 days) and
  say when no such roll exists. Uses `blackscholes.ts` for the credit estimate; labelled
  *inferred* since it is a model price, not a quote.
* **Book gates** at the top: the §6.2 hard limits as pass/fail with distance. If any is
  breached the page says *stop opening* and the Candidates page inherits that banner —
  that is the mechanism that makes the limits bite.

### 2.5 What to sell — `/short-call/candidates`

Merges supply with the book's own constraints. One row per candidate:

`name · type · theme · price · IV / IV-rank · trend (1M/3M/6M) · weekly ladder · next earnings · own verdict · theme headroom · proposed Δ0.15 strike & expiry · expected credit · σ cushion at that strike · Δ×DTE cell it lands in (with that cell's historical $/trade) · fit score`

* **Fit score** is a gate stack, not a black box: every §2 selection rule and §3 entry
  rule as pass/fail with margin, and the row shows *which gate it failed*. No single
  composite number without its components visible.
* Hard exclusions surfaced explicitly rather than hidden: rising names (§2.1), thin weekly
  ladder (§2.2), IV < `NC_IV_MIN` (§2.3), price band (§2.4), negative own verdict (§2.5),
  earnings inside the option's life (§2.6), inverse/short ETFs (never), theme already
  >25% of open credit (§6.2), and — new — **any name whose Δ×DTE cell is a losing cell**.
* Existing `ccScore` Edge (the Δ0.30 research track) is shown as a *reference column*
  only, clearly marked as a separate model, so it can be compared with the Δ0.15 doctrine
  without being confused for it.
* Ordering: fit score, then expected credit per unit of margin.

### 2.6 Timeline — `/short-call/weekly`

Two views over the same weeks (ISO Mon–Sun, weeks rolling into the month of their Monday
— the `pnl.ts:weeklyByMonth` convention, reused so numbers reconcile):

* **Cash view** (by realization week): credit taken, debits paid, realized, kept %,
  cumulative, opens / rolls / closes / expiries / assignments counted.
* **Vintage view** (by open week): trades opened that week and how *those* trades ended —
  the honest cohort read, since realized-week mixes vintages.
* Per-week discipline strip: avg entry Δ, avg σ cushion, avg DTE, % inside the envelope,
  % of exits that followed the harvest rule. Drift shows up here before it shows up in
  P&L, which is the point.
* Monthly rollups, and a version band across the top marking when each strategy version
  took effect — so a change in behaviour can be read against a change in rules.

### 2.7 Cohorts — `/short-call/cohorts`

Every slice in one place, each with `n`, realized, $/trade, win rate, kept %, breach rate,
and a **greyed-out row when `n` is below the threshold** (rather than omitting it — the
absence of evidence is information):

by entry Δ · by σ cushion · by DTE · by hold length · by exit type · by theme ·
**by instrument type (ETF / single stock / leveraged ETF)** · by sector ·
**by entry IV bucket and IV rank** · **by rule version** · Δ×DTE grid with drill-down to
the trades in a cell.

`by type` and `by IV rank` are new and directly test open questions §7.3 (IV rank vs
absolute IV) and the doctrine's ETF-only origin versus current stock practice.

### 2.8 Strategy & revisions — `/short-call/strategy`

The versioned face of the program:

* **Current rules**, rendered from the registry (§3) — id, rule, threshold, spec §, since
  version — so what the code enforces and what the doc says are visibly the same thing.
* **Version history** with, per version: what changed, the hypothesis, the test that would
  confirm or kill it, and the **measured effect** — before/after cohort with `n`, plus an
  explicit *not yet testable (n=7 < 12)* state where the data has not arrived.
* **Open questions register** (spec §7 + the CC doc's three gaps), each with the data it
  waits on: IV history accumulation, path-revalued stop, non-earnings event gate.
* The rendered spec markdown itself, so the page is the single place to read doctrine.

---

## 3. Engine work

New libs, all pure except the `get*` data loaders, each with a `scripts/*-check.ts`
self-check in the existing style:

| Lib | Job | Notes |
| --- | --- | --- |
| `src/lib/sc-rules.ts` | **versioned rule registry** | every threshold currently in `bookrisk.ts` / `shortcall.ts` / `securities.ts` re-homed as `{ id, title, spec, scope, since, until, params, evaluate(ctx) → { pass, margin, note } }`; plus `STRATEGY_VERSIONS[]` with `effectiveFrom`, changes, hypothesis, test, reviewAfter. Existing consts stay as re-exports so nothing breaks. |
| `src/lib/sc-lifecycle.ts` | chain builder + state machine | supersedes `buildRolls` for this section |
| `src/lib/sc-loss.ts` | loss anatomy, rule audit, counterfactuals | reads daily bars for the held-to-expiry path |
| `src/lib/sc-actions.ts` | verdict → instruction + roll-target constructor | wraps `bookrisk.verdictFor`, adds no new thresholds of its own |
| `src/lib/sc-candidates.ts` | gate-stack scorer over the NC universe | composes `securities.ts` + `sc-rules.ts` + theme headroom + name verdict |
| `src/lib/sc-timeline.ts` | weekly cash + vintage aggregation | reuses `pnl.ts` week conventions |

**Roll detection needs tightening before anything is built on it.** `buildRolls` groups by
`underlying|right` and links legs whose open is within 4 days of the previous close. That
will chain an unrelated fresh sale that happens to land in the window, and it accepts a
roll that went *down* or *in*. New criteria: same underlying and right; close and re-open
on the same or next session; new expiry **later** than the old one or new strike
**higher**; contract count equal (unequal → `partial` and flagged); and an emitted
`linkConfidence` of `certain | likely | guess` shown in the UI. Chains built on a `guess`
must never silently feed a headline number.

No schema change is required — everything derives from `option_harvest_transactions`,
`option_harvest_daily_prices`, `option_harvest_positions`, `quotes` and `trends`. **No
database writes are proposed by this plan.**

---

## 4. Strategy versioning and revision control

The strategy will keep evolving; the analyzer must not lie about its own past.

1. **Rules as data, versioned in git.** `sc-rules.ts` is the machine mirror of
   `short-call-strategy.md`. Git is the version control; the doc's changelog and the
   registry's `STRATEGY_VERSIONS` must agree, and `scripts/sc-rules-check.ts` fails when
   they drift. No rule may exist in code without an id and a spec reference.
2. **Effective dating.** Each version carries `effectiveFrom`. Every trade and chain is
   stamped with the version in force **at its open date** (`ruleVersion`).
3. **Two lenses, never mixed.** *As opened* judges a trade by the rules that existed when
   it was sold (fair, and the only valid basis for a compliance claim). *Current* judges
   it by today's rules (useful for "would I do this now?"). Every compliance number states
   which lens it used.
4. **Revisions are hypotheses.** A version bump records: what changed, why (with the
   evidence that prompted it), the test that would confirm or kill it, the `n` needed, and
   a review date. The Strategy page shows each revision's status: *pending data* /
   *confirmed* / *rejected*. A revision that cannot be tested is allowed, but it is
   labelled as such.
5. **A frozen weekly review artifact.** Mirroring the existing
   `predictions/cc-<date>.jsonl` pattern: `reviews/sc-<date>.json` snapshots rule version,
   book KPIs, open-book verdict counts, and the candidate shortlist. That archive is what
   makes "did v1.2 help?" answerable later without back-computing from a changed codebase.
   Written by an added step in `scripts/daily.sh`; no DB involvement.

---

## 5. Phasing, each phase independently shippable

Every phase ends with the atomic deploy — `npm run build && sudo systemctl restart
option_harvester` — then verification on both ports, per CLAUDE.md.

| Phase | Deliverable | Verification |
| --- | --- | --- |
| **0** | `sc-rules.ts` + `sc-lifecycle.ts` + checks. No UI. | leg-wise totals reproduce current `/short-call` KPIs exactly; `Σ chain.realized == Σ leg.realized`; registry ↔ doc changelog agree; link-confidence distribution reviewed by hand against 10 known rolls |
| **1** | Sub-nav, Scorecard refit, Cohorts page | existing numbers unchanged after the move; new slices carry `n` and grey out below threshold |
| **2** | Lifecycle, Loss lab | chain states reconcile with `pnl.ts` (`rollCount`, `expiredCount`, `boughtBackCount`, `assignedCount`); avoidable-loss shares sum to total loss |
| **3** | Open book, What to sell | every verdict cites a rule id; book gates demonstrably block the candidate list when breached |
| **4** | Timeline, Strategy & revisions | weekly sums reconcile to `weeklyByMonth`; vintage view sums to the same trade count as the record; version bands align with `effectiveFrom` |

Order is deliberate: the lifecycle engine changes what "a trade" means, so it lands before
anything that counts trades; prescription lands after the record is trustworthy.

---

## 6. Risks and honest limits

* **Chain-vs-leg will move the headline win rate.** Expected and correct, but it must be
  announced on the page, not discovered by the reader.
* **Roll linkage is a heuristic** over IB fills. Confidence must be visible; a wrong link
  merges two independent bets.
* **Counterfactuals are model output**, computed from daily bars with reconstructed IV.
  They are directional, not settlements — labelled *inferred* everywhere.
* **Δ and IV at fill remain reconstructed** until per-contract greek snapshots are
  persisted (spec §7.4). Every cohort keyed on entry Δ inherits that uncertainty.
* **One regime, overlapping windows, survivorship** — unchanged from the record's own
  caveats. More pages do not create more independent samples.
* **Scope discipline**: this section is short calls only. The panic-put book stays on
  `/risk`; the Δ0.30 CC model stays a reference column.
