# Concentration pie charts for `/risk`: three views, two weightings, one axis that has a rule

**Status: implemented and deployed 2026-09-07.** Written by the `option-adviser` role on
2026-09-07 at operator request — *"pie chart to show my position by sector, split into call and
put and merged, highlight what is dangerous."*

Implementation notes, every figure re-verified against the live prod DB before shipping:

* **Shipped as specified**: theme pie primary with `SC-B1` danger, sector pie secondary with **no**
  danger highlighting (§ 4 / A-2), merged / calls-only / puts-only views, credit ↔ assignment-notional
  weighting defaulting to credit, the acquisition wedge hatched and disclosed per slice (P-1, P-2),
  the named tail (§ 3.1), the effective-themes caption with its margin (D-1), and the `SC-E3`
  name footnote (D-2). New pure module `src/lib/concentration.ts` plus a `Donut` in `charts.tsx`.
* **The toggle is URL state**, not client state: `?pie=&w=` read server-side, each control a plain
  anchor. `/risk` stays a server component with no client JS, and the mirror renders the default
  (merged + credit) — the cut `SC-B1` is actually written against.
* **D-3 enforced structurally.** `buildPie` sets `ruleApplies` only for theme+merged+credit, and a
  slice can carry a breach only when it is true. So the sector pie refuses to flag its dominant
  35.9% slice, and no side or notional view can assert `SC-B1`. Nine assertions pin that refusal —
  it is the same defect as `riskbrief.ts:659`, which was fixed in the same change.
* **Verified numbers** (book synced 2026-09-07T08:34:24Z): 42 legs, **$18,685** credit (this file
  says $18,683 — rounding), **$644,900** notional, reconciling exactly with the page's own By-side
  table. Merged theme: Semiconductors **44.3%** ($8,279, incl. $2,726 acquisition = 33% of slice),
  Precious metals 18.7% (53% acquisition), Off-Index 15.7%. Calls: 17 legs $3,724, top theme
  Communication Services **19.8%** — inside the cap, so the breach is put-side, exactly as § 3.2
  argues. Puts: 25 legs $14,962, Semiconductors **52.6%**. Effective themes **3.8** vs floor 6
  (HHI 0.262). Over-cap names: SOXX 14.6%, TSM 13.1%, SOXL 11.7%, GDX 9.9%, ONDS 7.4%. Calls are
  **19.9%** of credit and **53.2%** of assignment notional — the § 2 claim, exact.
* **CORRECTION to § 3.1**: the merged tail is **7** smaller themes ($1,875, 10.0%), not nine —
  there are 13 themes and the head shows 6. The tail count is computed at render time, so the
  page is right regardless.
* **Extension**: § 3.2 asked that the calls view "say so plainly rather than leave the reader to
  infer". There is now a computed "Which side is it?" line naming both sides' top themes and the
  conclusion, so it cannot drift from the slices it describes.

**Scope discipline held: no new threshold, no new rule id, no engine verdict change.**

Original brief follows.

---

## 1. The axis: sector is not the axis any rule caps

There is no sector limit anywhere in the program. `sc-rules.ts` defines
`MAX_THEME_CREDIT_SHARE` (0.25), `MIN_EFFECTIVE_THEMES` (6) and `MAX_NAME_CREDIT_SHARE` (0.05).
**No sector constant exists.** `SC-B1` evaluates `concentration.maxTheme`, and `themeOf()`
(`bookrisk.ts:68`) maps a ticker to a curated cluster, falling back to its sector only when the
ticker is not in one.

The page already makes the argument, in its own caption under Correlated themes:

> *Themes, not sectors, are the diversification that counts: SOXX (Info Tech), SOXL (Leveraged)
> and TSM (Off-Index) are three sector labels and one semiconductor bet. Sector HHI 0.238 vs
> theme HHI 0.262.*

What that means for this chart, measured on today's book:

| axis | largest slice | rule | verdict |
| --- | --- | --- | --- |
| **sector** | Off-Index **35.9%** ($6,703) | — none — | not assessable |
| **theme** | Semiconductors **44.3%** ($8,277) | SC-B1, cap 25% | **fails by 19.3pp** |

A sector pie with danger highlighting would put the warning on Off-Index — a bucket with no
limit — while the actual breach, Semiconductors, is split across three sector slices (Info
Tech, Leveraged / Inverse, Off-Index) and is invisible on that axis.

**Requirement A-1.** Ship the **theme** pie as the primary chart. It is the axis SC-B1 is
evaluated on, so it is the only one whose slices can carry a pass/fail.

**Requirement A-2.** The sector pie may ship as a secondary view — it answers "what am I
exposed to in GICS terms", which is a legitimate question — but it must be labelled
*"no rule caps this axis; the diversification test is by theme"* and must carry **no danger
highlighting whatsoever**. A red slice implies a limit; there isn't one.

---

## 2. The weighting: credit and assignment notional rank the slices differently

The book's credit and its exposure are not proportional, and the difference is largest on
exactly the side the program is named after:

| side | legs | credit | share | assignment notional | share |
| --- | --- | --- | --- | --- | --- |
| Short calls | 17 | $3,723 | **19.9%** | $343,400 | **53.2%** |
| Short puts (premium) | 21 | $10,391 | 55.6% | $207,700 | 32.2% |
| Short puts (acquisition) | 4 | $4,569 | 24.5% | $93,800 | 14.5% |

**A credit-weighted pie shows the naked-call book as a fifth of the position. By exposure it is
over half.** The calls are the side with no upper bound on loss, and the side the entire
doctrine is written about; a chart that renders them as the small wedge is actively misleading
about which risk is being run.

The ranking of themes also changes with the weighting:

| theme | credit | notional | rank |
| --- | --- | --- | --- |
| Semiconductors | 44.3% | 27.7% | #1 → #1 |
| Precious metals | 18.7% | 14.8% | #2 → #2 |
| Off-Index | 15.7% | 11.7% | #3 → #3 |
| Communication Services | 4.0% | 9.3% | #4 → #5 |
| **Copper & materials** | 3.8% | 2.2% | **#5 → #12** |
| **Information Technology** | 3.5% | 10.0% | **#6 → #4** |
| Broad index | 2.4% | 6.0% | #8 → #6 |

**Requirement W-1.** A weighting toggle: **credit** (default) and **assignment notional**.
Credit is the default because SC-B1's threshold is defined on credit share — the pie must
default to the basis its own gate uses, or the highlighted slice will not match the gate.

**Requirement W-2.** Whichever weighting is showing, print the call share on **both** bases in
one line beneath the chart: `calls 19.9% of credit · 53.2% of assignment notional`. This is the
single most decision-relevant sentence the chart can carry and it must not depend on which
toggle happens to be active.

---

## 3. The three views

### 3.1 Merged (calls + puts), by theme — the primary chart

Slices: 13 themes. Danger per §4. Today: Semiconductors 44.3%, Precious metals 18.7%,
Off-Index 15.7%, then ten slices under 5%.

**Collapse the tail.** Ten slices below 5% are unreadable and each is a single leg. Show the
top 6 and aggregate the rest as `9 smaller themes · $1,874 · 10.0%`, expandable. Do **not**
sort the tail into "Other" silently — name the count and the dollars, because `MIN_EFFECTIVE_THEMES`
is a *count* rule and hiding the tail hides its input.

### 3.2 Calls only

17 legs, $3,723. Today's slices: Communication Services 19.8%, Information Technology 17.8%,
Off-Index 13.7%, Semiconductors 10.9%, Broad index 8.3%, China 7.7%, Crypto-linked 6.2%,
Biotech 6.0%, Energy & oil 5.6%, Consumer Discretionary 4.1%.

Note what this view reveals that the merged one hides: **the call book is not the concentrated
one.** Its largest theme is 19.8%, inside the 25% cap. The 44.3% breach is almost entirely a
put-side phenomenon. Nothing in the doctrine caps a theme *per side*, so this view carries no
gate — but it carries the diagnosis, and the copy under it should say so plainly rather than
leave the reader to infer that calls are the problem.

### 3.3 Puts only, with the acquisition wedge drawn separately

25 legs, $14,960. Semiconductors 52.6% ($7,873, of which **$2,726 is the declared SOXX
acquisition put**), Precious metals 23.3% ($3,490, of which **$1,843 is declared GDX**),
Off-Index 16.2%, Copper & materials 4.7%, Crypto-linked 1.7%, Broad index 0.9%,
Consumer Staples 0.5%.

**Requirement P-1.** The acquisition portion of each slice must be rendered distinctly —
hatched, or as an inner ring — and labelled *"assignment is the goal here
(`docs/acquisition-puts.md`)"*. `$4,569` of the $18,683, 24.5% of the book, is a position whose
success condition is the opposite of the rest. A pie that colours it the same as a premium put
tells the operator to reduce a position they deliberately opened.

**Requirement P-2, and this one is subtle.** `SC-B1` **includes** the acquisition book in the
theme share, while `SC-B4` **excludes** it. That asymmetry is defensible — correlated deltas
rise together whatever the intent, which is the page's own argument in the Acquisition section
— but it must be stated on the chart: `Semiconductors 44.3% incl. $2,726 declared acquisition
(33% of the slice)`. Otherwise the operator reads a 19.3pp breach and cannot tell that a third
of it is intentional. Do **not** change what SC-B1 counts; only disclose it.

---

## 4. Danger highlighting — only where a rule exists

Four highlights, each keyed to a registry id, each showing **margin** and not just a colour.
Values as of the 08:34Z sync.

| level | rule | slice | now | limit | margin |
| --- | --- | --- | --- | --- | --- |
| critical | `SC-B1` | Semiconductors | 44.3% | 25% | **−19.3pp** |
| critical | `SC-E3` | name SOXX | 14.6% | 5% | **−9.6pp** |
| high | `SC-E3` | names TSM 13.1%, SOXL 11.7%, GDX 9.9%, ONDS 7.4% | — | 5% | 4 further names over |
| high | `MIN_EFFECTIVE_THEMES` | whole chart | 3.8 (1/HHI 0.262) | ≥6 | **−2.2 themes** |
| high | `SC-B4` | side view | puts $10,391 vs calls $3,723 | puts ≤ calls | **−$6,668** |

**Requirement D-1.** Effective themes is a property of the *whole* pie, not a slice. Render it
as a caption with its margin — `3.8 effective themes against a floor of 6` — not as a colour.
It is the number that says "this pie should have more slices", which no per-slice highlight can
express.

**Requirement D-2.** Name-level breaches (`SC-E3`) do not belong on a theme pie as slices; there
are 32 names. Surface them as a one-line footnote naming the offenders and their shares, which
is where the operator's next sale is actually constrained.

**Requirement D-3.** No highlight without its margin in the label. `riskbrief.ts:659` is the
standing example of why: it currently prints *"Semiconductors is 44% of open credit, inside the
25% cap"* on candidate rows, because its `else` branch never compares the share to the cap.
A pie legend built the same way would repeat the error in colour.

---

## 5. What not to build

* **No danger colours on the sector pie** (A-2). No rule, no verdict.
* **No pie for the 5% name cap.** 32 slices is noise; the footnote in D-2 carries it.
* **No "Other" bucket without its count and dollars** (3.1) — the count is a rule input.
* **No per-side theme gate.** The doctrine caps themes for the book, not per side. Views 3.2
  and 3.3 are diagnostic; do not invent a threshold for them.
* **No third weighting.** Δ$ is tempting and is already on the tables, but it is signed and
  therefore cannot be a pie. Leave it in `By sector` / `Correlated themes` where it belongs.

---

## 6. Data, provenance, staleness

Everything needed exists: `concentration.themes` / `.sectors` carry legs, credit, atRisk,
margin and delta per bucket, and `right` plus `intent` are on every `BookLeg`
(`bookrisk.ts:155–159`). The acquisition split needs no new field — `intent === "acquisition"`
is already set at `bookrisk.ts:571`.

The chart must inherit the page's freshness line: credit and notional come off the **IB book
snapshot** (currently 08:34Z today), not the live quote. If the book is stale the pie is stale,
and a chart looks more current than a table does — so the snapshot timestamp belongs *on* the
chart, not only at the top of the page.

---

## 7. Verification

1. Σ slices must equal the page's own `By side` and `Correlated themes` totals: $18,683 credit,
   $644,900 notional, 42 legs. A pie that does not reconcile with the table above it is worse
   than no pie.
2. `npm run check` must pass untouched — no rule ids or thresholds change here.
3. `npx tsx scripts/page-markdown-check.ts` — `/md/risk.md` mirrors `/risk`. Decide deliberately
   what the mirror emits for a chart: the recommendation is the **underlying table**, since the
   mirror is what this adviser role and any future review reads.
4. Deploy atomically — `npm run build && sudo systemctl restart option_harvester` — then verify.
   A build without the restart is the client-side-exception failure seen at 17:04 today.
