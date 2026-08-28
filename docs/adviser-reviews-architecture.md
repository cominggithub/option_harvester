# Adviser reviews — frozen analysis snapshots under `/risk`

**Status: proposed, 2026-08-28. Not built.** Written by the `option-adviser` role at the
operator's request. Storage layout and the report contracts are inside the adviser's own
write permission (`docs/**`) and can start immediately; the three reader routes under
`/risk/reviews` are `src/` work and belong to the default agent.

---

## 0. Why this exists, and what it is not

`/risk`, `/short-call/*` and `/pnl-predict` are all `force-dynamic`: they re-derive
everything at read time and **keep nothing**. That is deliberate — a Sync alone changes what
the brief says, with nothing to re-run — but it has a cost the operator has now hit: there is
no previous reading to compare against. When margin utilisation moves from 78% to 66%, or a
theme cap goes from breached to clear, nothing in the system records that it moved, why, or
whether the rules or the book changed underneath it.

This is the artifact `short-call-analyzer-plan.md` §4.5 specified and deliberately did **not**
build (`reviews/sc-<date>.json`), deferred "until a revision exists that it could measure".
Two revisions now exist (short calls `1.2`, acquisition puts `1.1`) with **zero closed chains
under either** (`system-gaps.md` §5), so the frozen artifact is the mechanism that makes "did
the revision help?" answerable at all, rather than a convenience.

**The one rule that makes the whole thing work:** a published review is **immutable and
self-contained**. It embeds every number it cites. It must render identically in a year's time
with the database offline. A report that re-queries at render time is not a snapshot — it is
just `/risk` with an older headline, and it would silently rewrite its own history.

Division of labour, so neither surface duplicates the other:

| Surface | Answers | Lifetime |
| --- | --- | --- |
| `/risk`, `/short-call/*` | what is true **now** | none — regenerated per load |
| `/risk/reviews/<runId>` | what was true **then**, and what the adviser concluded from it | permanent, write-once |

---

## 1. The three reports

The operator's naming, kept verbatim as slugs. Each is a separate document with a separate
question, a separate unit of account and a separate time direction. They are never merged,
because the commonest analytical error available here is judging one by another's frame.

| # | Slug | Name | Question | Unit | Time |
| --- | --- | --- | --- | --- | --- |
| 1 | `strategy` | **Strategy improvement** | Given everything that has happened, what should the rules be? | **chain** primary, leg secondary, never mixed in one table | retrospective |
| 2 | `risk` | **Risk analysis** | What am I exposed to right now, and what do I do next? | **leg** | present |
| 3 | `targets` | **Potential target** | What may I sell, and what does each candidate fail? | **candidate** | forward |

### 1.1 Strategy improvement — required sections

1. **The book as it stood** — every open position, one row per leg: name, right, strike,
   expiry, qty, DTE, |Δ| with provenance and age, σ cushion, IV, credit, open P/L, captured %,
   theme, trend, days to earnings. This is the "list my current position" the operator asked
   for, and it is here as well as in report 2 because the strategy question needs the book as
   *evidence*, not as a worklist.
2. **The closed record** — legs and chains side by side, each labelled: closed count, credit,
   realized, kept %, win rate, breach rate; by terminal state; rolls and bad rolls. Source
   `npm run reconcile:sc`, with `system-gaps.md` §14 attached: **its open side is not premium
   at risk** and must not be quoted as such.
3. **Cohorts that carry a conclusion** — entry-keyed only (Δ, DTE, cushion, theme, instrument
   class, IV bucket). Every cohort prints `n`; below 12 trades, or with any cell under 3, it is
   greyed and explicitly cannot carry a conclusion. Exit-keyed cohorts appear only with the
   selection-effect caveat (`system-gaps.md` §2) and never as a causal claim.
4. **Rule-by-rule reading** — for each id in `sc-rules.ts` touched by this review: what the
   record says about it, under which lens (*as opened* vs *current*), and whether the evidence
   is sufficient.
5. **Proposals** — in the playbook's shape (`FINDING / EVIDENCE / CONFIDENCE / PROPOSAL /
   TEST / COST`), ordered by expected impact. A proposal without a falsifiable test and an `n`
   is not admissible.
6. **Rejected this run** — ideas considered and killed, with the number that killed them.
   Carried forward from `docs/sessions/`, because a review is where a killed idea comes back.
7. **What could not be verified, and why.**

### 1.2 Risk analysis — required sections

1. **Preconditions** (§4) — pass/fail, at the top, before any finding. A review run against a
   six-day-old book is not a measurement of today, and must say so before it says anything else.
2. **Book gates** — all `SC-B*` plus `AP-4`, each pass/fail **with margin** in its own unit
   (`66% vs 60% limit`, not a red dot). `openingBlocked` state stated explicitly, since it is
   what makes report 3 conditional.
3. **Findings, worst-first** — each with its numbers, the **mechanism** (why that number hurts),
 the action, and the rule ids breached. Liquidity outranks everything, because the broker acts
   before a thesis resolves.
4. **The three books, separately** — naked calls, premium puts, acquisition puts. A declared
   acquisition leg may never be reported as an inversion, an assignment risk or a breach
   (`acquisition-puts.md` §6); it is judged on effective basis and funding (`AP-4`,
   `R-DELIVERY`).
5. **Next steps** — per leg, one verdict with the rule cited. Ordered by money at risk.
   Balance-sheet closes are labelled distinctly from harvests, because §4.4 forbids acting on
   the mark in the acquisition book.
6. **What changed since the previous run** — mechanical, from `data.json` (§3), not prose.
7. **What could not be verified, and why.**

### 1.3 Potential target — required sections

1. **Inherited banner** — if any `SC-B*` gate failed in report 2, this report opens with *stop
   opening* and every candidate below is explicitly "for after you have made room". The
   candidate list is not permission.
2. **Gate stack per candidate** — every `SC-S*` and `SC-E*` rule as pass / fail / **unknown**,
   with margin. `unknown` is never rendered as a pass: a missing or stale earnings date is a
   data gap (`SC-S6`), not an event-free name.
3. **Preference fit with its components printed** — grinding-down slope, IV rich *and*
   deflating, σ cushion, credit, own record. No composite score without its parts visible.
4. **Proposed structure** — strike, expiry, Δ, credit, σ cushion, the Δ×DTE cell it lands in
   and that cell's historical $/trade — all labelled **inferred** (Black-Scholes from the last
   ingest's ATM IV; there is no live chain).
5. **Vol regime line** — how many sellable names have IV falling vs rising, so an absence of
   badges reads as "the preference is unavailable today" rather than as an oversight.
6. **Theme and name headroom** the candidate would consume if sold.

---

## 2. Storage layout

One directory per run, under the only tree the adviser can write:

```
docs/reviews/
  README.md                      the protocol + the write-once rule
  <runId>/
    meta.json                    provenance and preconditions (§4)
    data.json                    every metric this run cites, keyed (§3)
    strategy.md                  report 1
    risk.md                      report 2
    targets.md                   report 3
    sources/                     raw read-only captures, verbatim
      risk.md  positions.md  pnl-predict.md
      short-call.md  cohorts.md  losses.md  lifecycle.md  candidates.md  weekly.md
      reconcile-sc.txt
      check.txt
```

* **`runId` = `YYYY-MM-DD-HHmm`**, Asia/Taipei, matching how the rest of the repo dates things.
  Two runs on one day are ordinary — the operator syncs more than once — so the time is part of
  the id, not optional.
* **Write-once.** A published run directory is never edited, exactly as
  `docs/sessions/YYYY-MM-DD-*.md` is never edited. A correction is a **new run** whose
  `meta.json` names the run it corrects. This is not fussiness: if a review can be edited, a
  comparison between two runs stops meaning anything.
* **`sources/` is the receipts drawer.** Storing the raw `/md/*.md` captures is what makes "put
  all the data that you reference in the html" true rather than asserted: any number in a
  report can be traced to the text it was read from, months later, without the database. It is
  plain text and compresses in git.

### 2.1 Markdown, not hand-written HTML — and why

The operator asked for HTML. I am proposing **markdown source rendered to HTML by the route**,
and the reason is the operator's own stated goal:

* **Comparison is the point, and `git diff` is the cheapest comparison engine that exists** —
  on markdown it is readable, on hand-written HTML it is noise. Two runs of the same report
  diff to exactly the findings that changed.
* The house pattern already runs this direction in reverse (`/md/*.md` mirrors of every page),
  so markdown-as-canonical is consistent with the repo rather than a new convention.
* Hand-authoring three HTML documents per run costs the adviser a large fraction of its context
  per review, which comes directly out of analysis quality.

The literal requirement — *all referenced data present in the delivered page* — is met by
`data.json` being **inlined** into the rendered HTML as a
`<script type="application/json" id="review-data">` block, plus the numbers appearing inline in
the prose tables. So the served page is self-contained and machine-readable, while the stored
source stays diffable. If the operator prefers stored HTML anyway, say so and it becomes
`strategy.html` etc. with `data.json` embedded — the rest of this design is unchanged, only
comparison degrades.

---

## 3. `data.json` — the comparison contract

This is the single most important design decision, because it is what makes two runs
comparable **mechanically** rather than by re-reading prose.

A **flat, dotted, stable key space**, one entry per cited metric:

```json
{
  "runId": "2026-08-28-1025",
  "metrics": {
    "book.legs":            { "value": 44,     "unit": "count",  "source": "/md/risk.md", "asOf": "2026-08-28T02:25Z" },
    "book.credit":          { "value": 19697,  "unit": "usd",    "source": "/md/risk.md", "asOf": "2026-08-28T02:25Z" },
    "gate.SC-B2.value":     { "value": 0.66,   "unit": "ratio",  "limit": 0.60, "pass": false, "ruleId": "SC-B2" },
    "gate.SC-B1.topTheme":  { "value": 0.42,   "unit": "ratio",  "limit": 0.25, "pass": false, "ruleId": "SC-B1", "label": "Semiconductors" },
    "record.chains.closed": { "value": 164,    "unit": "count",  "n": 164, "source": "reconcile:sc" },
    "record.chains.realized": { "value": -5873, "unit": "usd",   "n": 164, "source": "reconcile:sc" }
  }
}
```

Rules for the key space:

* **Keys are append-only and never repurposed.** Renaming `gate.SC-B2.value` silently breaks
  every historical comparison. A changed definition gets a **new** key and the old one stops
  being emitted.
* **Every metric carries `source` and `asOf`.** A metric with no provenance is not admissible,
  because the comparison has to be able to tell "the book moved" from "the input got fresher".
* **`n` is mandatory wherever the metric is a cohort statistic.** A cohort below threshold is
  emitted with `"belowThreshold": true` rather than omitted — absence of evidence is
  information (`/short-call/cohorts` already works this way).
* **Rule metrics carry `ruleId` and `limit`** so the comparison can say *breach cleared* /
  *breach opened* without parsing prose.

### 3.1 Attribution: three reasons a number can change

Every keyed difference between two runs is classified, and this is what turns a diff into a
finding:

| Class | Meaning | Example |
| --- | --- | --- |
| **book moved** | the positions or prices changed | credit $19,697 → $16,000 after a harvest |
| **rules moved** | the threshold changed | `SC-B2` limit 60% → 55% in a new version |
| **data quality moved** | the same book measured better or worse | margin what-if coverage 45% → 100% after a Deep sync |

Without this split a review reports a Deep sync as a risk event. `meta.json` carries the rules
versions and the input freshness precisely so the classifier has something to read.

---

## 4. `meta.json` — provenance and preconditions

```json
{
  "runId": "2026-08-28-1025",
  "generatedAt": "2026-08-28T10:25:50+08:00",
  "head": "b5542f5",
  "rulesVersions": { "shortCall": "1.2", "acquisitionPuts": "1.1" },
  "previousRunId": "2026-08-21-1500",
  "correctsRunId": null,
  "trigger": "operator: portfolio synced",
  "inputs": {
    "ibBalances":      { "asOf": "2026-08-28",        "ageH": 0 },
    "ibBook":          { "asOf": "2026-08-28T10:22+08:00", "ageH": 0.05 },
    "priceIvIngest":   { "asOf": "2026-08-27T22:14Z", "ageH": 12.2 },
    "marginWhatIfs":   { "coverage": 0.45, "asOf": "2026-08-11", "ageH": 408 },
    "deltaProvenance": { "measured": 44, "modelled": 0, "lowConfidence": 0, "allCurrent": true },
    "ivHistoryDays":   63
  },
  "preconditions": [
    { "id": "book-fresh",     "pass": true,  "detail": "IB book 0.1h old, limit 24h (BOOK_STALE_HOURS)" },
    { "id": "delta-fresh",    "pass": true,  "detail": "44/44 measured and current" },
    { "id": "margin-covered", "pass": false, "detail": "45% of legs priced — per-leg attribution is a floor" }
  ],
  "gaps": ["system-gaps §14", "system-gaps §6", "system-gaps §5"]
}
```

**Preconditions gate the claims, not the run.** A failed precondition never blocks a review —
the operator still needs the reading — but any finding that depends on the failed input must
either state the age inline or be withheld. That is `system-gaps.md` §10, which is currently
unfixed on the live page and should not be reproduced here.

---

## 5. Routes — the handoff to the default agent

All under `/risk`, as requested. Four thin server components; **no new engine, no schema
change, no writes.**

| Route | Renders |
| --- | --- |
| `/risk/reviews` | index of runs, newest first: runId, trigger, rules versions, gates failing, headline metrics, and the *changed since previous* count |
| `/risk/reviews/<runId>` | the run: three tabs (`SectionNav.tsx`, same pattern as `/short-call/*`), defaulting to **Risk analysis** |
| `/risk/reviews/<runId>/strategy` · `/targets` | reports 1 and 3 |
| `/risk/reviews/compare?a=&b=` | keyed diff of two runs' `data.json`, classified per §3.1 |

Implementation notes that will otherwise cost a debugging session:

1. **`export const dynamic = "force-dynamic"` and read the filesystem per request.** Reviews
   are added by writing files, not by deploying. A statically-generated index would not show a
   new review until the next build — which is exactly the failure mode where the operator
   writes a review and concludes the feature is broken.
2. **Path safety.** `runId` comes from the URL: validate against `/^\d{4}-\d{2}-\d{2}-\d{4}$/`
   and resolve inside `docs/reviews/`, rejecting anything that escapes it. This route reads
   arbitrary-looking paths off disk on a **port that is already publicly reachable and
   unauthenticated** (`system-gaps.md` §11), so traversal here is not theoretical.
3. **Render markdown with the site's own typography** — reuse the existing renderer rather
   than adding a dependency, and keep the editorial/financial-terminal styling (`docs/spec.md`
   §8): monospaced tabular figures, hairline rules, no cards.
4. **Inline `data.json`** into the HTML as `<script type="application/json" id="review-data">`
   so the served page is self-contained per the requirement.
5. **Add the review paths to `markdown-url.ts:STATIC_PAGE_PATHS`** if the `/md/*.md` mirrors
   should cover them — the allow-list is explicit and a missing entry returns 404. Dynamic
   `runId` segments need a pattern there, like `STOCK_PATH`.
6. **`/risk` gets one line**: *latest adviser review — `<runId>`, N gates failing, M findings
   changed* → link. That is the only change to the live page; the live brief keeps its job.

Cost estimate: one page + three sub-pages + a diff view over files that already exist, no
engine work. The risk is scope creep into re-deriving numbers server-side — which must be
refused, because it breaks §0's immutability rule.

---

## 6. Protocol

**Trigger.** "Run the review" / "re-run the analysis" / any request for risk + target analysis
against the current strategy. Also expected after **a sync** or **a doctrine change** — the two
events that make the previous run stale.

**Steps.**

1. **Capture, read-only, in this order:** `git log -1`; `/md/risk.md`, `/md/positions.md`,
   `/md/pnl-predict.md`, `/md/short-call.md` and its section mirrors; `npm run reconcile:sc`;
   `npm run check`. Everything goes to `sources/` verbatim.
2. **Fill `meta.json`**, evaluate preconditions, and record which findings they constrain.
3. **Emit `data.json`** — every metric the three reports will cite, keyed per §3.
4. **Write the three reports**, each citing only keys present in `data.json`.
5. **Diff against `previousRunId`** and write the *what changed* section of report 2 from the
   keyed comparison, classified per §3.1.
6. **Report to the operator**: what was recorded, what changed, and what was deliberately left
   out.

**Refusals that keep the artifact honest.**

* No number in a report that is absent from `data.json`.
* No open-premium figure from `reconcile:sc` (`system-gaps.md` §14) — open premium comes from
  `/risk` or `/positions`.
* No compliance rate while every closed chain is `v0.1` — counterfactual only (§5 of gaps).
* No causal claim from an outcome-defined cohort (§2 of gaps).
* No specific trade recommendation: the reports state rules, margins and verdicts from the
  engines; the decision is the operator's.

### 6.1 Making the memo persist

This document is the memo, but the adviser only loads what its agent config lists. For the
instruction to survive a new conversation, **`.kiro/agents/option-adviser.json` needs
`file://docs/reviews/README.md` (and this file) added to `resources`**. That file is outside the
adviser's write permission — hand it to the default agent or edit it directly. Without it, the
next session will not know that reviews are expected to be written.

---

## 7. What this does not solve

* **It cannot make an unmeasurable thing measurable.** Compliance still needs 12 closed trades
  under v1.1 (`system-gaps.md` §5); the loss-cap question still needs a path-revalued backtest
  the data cannot support (§4). A frozen review makes the wait *visible* — each run restates
  `n` and how far it is from the threshold — which is the whole value while the answer is
  pending.
* **It inherits every gap in its inputs.** Reconstructed entry greeks (§1), ledger-vs-broker
  disagreement on the open set (§14), 63 days of IV history (§12). Freezing a number does not
  validate it; `meta.json` records what was wrong with it at the time.
* **It is not an audit trail of trades.** `/transactions` and the ledger own that. A review is
  an *interpretation*, and its value depends on being honest about being one.
* **Two runs are not two independent samples.** The record is one regime with overlapping option
  lives (§13). Ten reviews of the same book are ten readings, not evidence accumulating.
