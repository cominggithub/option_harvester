# Liquidity surfaces: the shared denominator, the margin shock, and three labels

**Status: Phase 1 implemented and deployed 2026-09-07. Phases 2 and 3 not started.** Written by
the `option-adviser` role on 2026-09-07 after an operator question — *"what is the safe range of
my excess liquidity with respect to cash and NLV, and where am I now?"* — that the pages could
not answer.

Implementation notes, every figure re-verified against the live prod DB before shipping:

* **Shipped**: the six "settled cash" labels (D-3.1), the cushion denominator (D-3.2), the
  unused-NLV-vs-cushion clause (D-3.3), and the always-rendered cushion ladder (D-4) as a new
  `#cushion` section on `/risk`. New pure module `src/lib/cushion.ts`; no engine change, no new
  threshold, no rule id.
* **Also fixed, as commissioned**: `riskbrief.ts:659`. Its `else` branch asserted "inside the
  ${cap} cap" for any non-zero share without ever comparing, so a theme at 44.3% printed
  *"inside the 25% cap"* on the same candidate row whose `SC-B1` gate correctly failed. It now
  compares and carries the margin in percentage points on BOTH branches. Pinned by six new
  assertions in `scripts/riskbrief-check.ts` (over / under / exactly-at-cap).
* **Verified numbers** (26 balance snapshots, latest 2026-09-07T08:34:24.518Z): `settled_cash`
  is NULL in **0 of 26** rows — claim confirmed. Cushion **20.7%** of NLV $131,902, which is
  **22.9%** of the $119,274 cash it is measured from. `CUSHION_THIN` is **$946 (+1.0% of
  maintenance)** away; `CUSHION_CRITICAL` is **$14,136 (+15.4%)**. SC-B5's unused NLV is
  **30.3%**, 9.6pp from the cushion. All as specified.
* **CORRECTION to § 1 — the cash identity is not universal.** This file states that excess
  liquidity equals cash − maintenance "exact on 5 of 5 snapshots". Across **all 26** it is exact
  on **16** and fails on **10** — every July snapshot, by up to **$64,828** (2026-07-22), where
  IB was evidently reporting a different basis. The five most recent do agree, which is
  presumably what was sampled. Consequence for the build: the ladder's identity-free arithmetic
  (`room = excessLiquidity − k × NLV`) is always shown, but the "maintenance may rise $X"
  framing is **checked against the rendered snapshot** and withheld when the identity fails,
  since there the conversion has no basis. `scripts/concentration-check.ts` pins that refusal
  against the real 2026-07-27 row.

**Scope discipline held: no threshold, rule id, verdict or doctrine change.** `MAX_MARGIN_PCT_NLV`,
`MIN_UNUSED_NLV`, `CUSHION_THIN`, `CUSHION_CRITICAL`, `MAX_DELIVERY_SHARE_OF_CASH` and
`MAX_NAME_DELIVERY_SHARE_OF_CASH` are untouched.

Original brief follows.

---

## 1. What was measured

Source: `psql SELECT` on `option_harvest_account_balances`, prod, read-only, 2026-09-07.
Four most recent snapshots, in dollars as stored.

| date | net_liquidation | total_cash | equity_with_loan | maint_margin | excess_liquidity | cushion |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-03 | 129,150.10 | 118,583.64 | 118,583.64 | 90,412.47 | 28,171.17 | 0.218127 |
| 2026-09-01 | 131,185.95 | 117,519.31 | 117,519.31 | 85,520.04 | 31,999.27 | 0.243923 |
| 2026-08-31 | 130,712.66 | 117,072.41 | 117,072.41 | 83,817.54 | 33,254.87 | 0.254412 |
| 2026-08-28 | 133,925.21 | 117,499.61 | 117,499.61 | 88,234.57 | 29,265.05 | 0.218518 |

Three identities hold on **4 of 4** snapshots:

1. `excess_liquidity = equity_with_loan − maint_margin` — exact to the cent on 09-03, 09-01
   and 08-31; 1¢ on 08-28.
2. `available_funds = equity_with_loan − init_margin` — exact on all four.
3. `equity_with_loan = total_cash` — exact on all four. (`settled_cash` is **NULL** on all
   four; see D-3.)

So in this account the broker's cushion is, arithmetically, **cash minus the maintenance
requirement**. NLV is $10,566 larger than the cash the cushion is actually measured against
(09-03), and it is NLV that appears in the denominator of the printed percentage —
`bookrisk.ts:698`, and IB's own `cushion` field agrees (`0.218127 × 129,150.10 = 28,171.2`).

**Correction to an earlier reading.** In conversation on 2026-09-07 this was first described as
the page mixing bases. It is not: `prisma/schema.prisma:479` documents `cushion` as
*excess liquidity / NLV*, and that is IB's own definition, faithfully reproduced. The defect is
narrower and is D-3 below.

Confidence: **measured** for the identities (n = 4 consecutive snapshots, one account, one
broker). **Inferred** for the causal reading of IB's field semantics — the identities may be
an artifact of an all-cash account holding no stock, and would need re-checking if spot
positions ever appear.

---

## 2. The gap that matters: two gates, one pile of dollars

`acqputs.ts:332` — `const cash = balance?.totalCash ?? null;` — makes AP-4's denominator
**total cash**. §1 identity 3 makes total cash the same quantity the cushion is measured
against. So:

```
total cash $118,584
├──────────────────────────────────────────────────────────┤
│ maintenance margin $90,412  (SC-B2, SC-B5, cushion)      │  ← claim 1
├──────────────────────────────────────────────────────────┤
│ promised delivery  $93,800  (AP-4, AP-7, R-DELIVERY)     │  ← claim 2
└──────────────────────────────────────────────────────────┘
     unclaimed by either: $118,584 − $93,800 = $24,784 = 19.2% of NLV
```

Nothing in `bookrisk.ts` or `acqputs.ts` subtracts one claim from the other. Each gate reads
the whole $118,584 as available to it, and both currently pass or fail on their own terms:
cushion 21.8% **passes** the 20% floor, AP-4 79.1% **passes** the 80% cap by 0.9pp ($1,067).

Ring-fence the delivery promise and the cushion is 19.2% — it **fails**. That is spec §7.3
("the cash is not ring-fenced") expressed as the number it has always lacked.

**The honest limit on that number.** $24,784 is an *upper bound on the conflict*, not the
ring-fenced cushion. On assignment the acquisition puts' own maintenance margin is released
and replaced by margin on the delivered shares, so part of claim 1 and claim 2 are the same
requirement counted twice. The size of that overlap is the maintenance attributable to the
GDX and SOXX legs, and it is **not currently knowable**: `option_harvest_position_margin`
covers **29% of legs, newest what-if 2026-08-11 (27 days old)** (`/md/sync.md`, Position
margin card). Any surface built here must carry that as a stated bound, not print 19.2% as a
fact.

---

## 3. The defects, cheapest first

### D-1 · There is no ring-fenced cushion anywhere — computed or shown

Not computed. `bookrisk.ts:697–698` produces `excessLiquidity` and
`excessLiquidityPctOfNlv`; `acqputs.ts` produces `delivery`, `cash` and `deliveryVsCash`.
Nothing joins them. `riskbrief.ts:295` gets closest — it warns when delivery *exceeds* cash —
but that is the 100% case, not the interaction at 79%.

Classification: **not computed**. Cost: lib computation + one tile.

### D-2 · The only shock view on the page is an at-expiry P&L table, and it reads as reassurance

`bookrisk.ts:411–417` `shockBook()` is captioned, correctly, *"at-expiry intrinsic, every
underlying moved by the same %, no IV/time effects"*. Its worst cell on the current book is
**+$13,403** (+20% move). A reader scanning `/risk` for "how much market move can I absorb"
finds a table whose worst case is a profit — while the mechanism that actually ends the
program is the maintenance requirement expanding *before* expiry, at 21.8% cushion, with
assignment notional of $607,800 = 4.7× NLV.

Classification: **computed, but it answers a different question than the one the page's own
brief raises** (`riskbrief.ts:140–155`, R-MARGIN: *"a rally raises the requirement long before
any expiry resolves"*). Cost: lib computation + one table. Blocked on margin coverage.

### D-3 · Three labels that name the wrong quantity

1. **"of settled cash"** — `page.tsx:411`, `page.tsx:497`, `riskbrief.ts:257`, `:295`,
   `acqputs.ts:161`, `sc-rules.ts:541` all say *settled cash*. The value is `totalCash`
   (`acqputs.ts:332`), and `settled_cash` is NULL in every row of the table. The two differ
   exactly when unsettled trades are outstanding — which is precisely when "can I fund a
   delivery" has a different answer.
2. **"22% cushion"** — numerator is cash-based, denominator is NLV. The consequence is not
   cosmetic: the printed percentage moves when the option book's mark moves, even with cash
   and margin unchanged. On its own basis the same dollars are **23.8%**.
3. **`unusedNlvPct`** — `sc-actions.ts:187` computes it as `1 − marginPct`, so SC-B5's
   "unused NLV" is 30.0% while the cushion is 21.8%. Two different numbers, both presented as
   headroom, differing by 8.2pp with no explanation on the page.

Classification: **stale-or-unprovenanced rendering**. Cost: strings only. No engine change.

### D-4 · The cushion is never evaluated against its own thresholds, and vanishes when healthy

Excess liquidity reaches `/risk` in exactly two places, both as a bare number:

* `page.tsx:667` — a sub-clause on the Maint. margin tile:
  `· excess liquidity $28,171 = 22% cushion ·`
* `riskbrief.ts:154` — one evidence bullet inside the R-MARGIN finding.

Three defects follow:

1. **No threshold, no margin.** `CUSHION_THIN` (20%) and `CUSHION_CRITICAL` (10%) exist only as
   branch conditions at `riskbrief.ts:140` and `:156`, where they select a severity and a
   sentence. The 20% reaches the page only inside prose (`riskbrief.ts:155`, `:163`); **10%
   never appears on the page at all**, though it is the line at which the broker acts. This
   breaks the playbook's rule that every threshold the program is judged by is visible as
   pass/fail **and margin** at the moment of the decision.
2. **No rule id.** SC-B5 evaluates `unusedNlvPct` = `1 − margin ÷ NLV` (`sc-actions.ts:187`),
   which is 30.0% — a different quantity from the cushion's 21.8%. So the cushion is a
   threshold with no rule, and cannot be cited by id in a review.
3. **It disappears when the book is healthy.** `riskbrief.ts:139–165` pushes R-MARGIN only when
   margin > 60%, and R-CUSHION only when cushion < 20%. With margin ≤ 60% **and** cushion ≥ 20%
   neither fires, and the cushion leaves the brief entirely — leaving only the tile sub-clause.
   The number is least visible exactly when it is being used to decide how much new risk to
   open, which is the one moment it governs.

Classification: **computed, shown as a bare number, never evaluated.** Cost: rendering only —
the inputs (`excessLiquidity`, `excessLiquidityPctOfNlv`, `bookrisk.ts:697–698`) and the
constants (`riskbrief.ts:49–50`) all already exist.

---

## 4. What to build

### Phase 1 — labels and the cushion ladder (rendering only; no engine, no new thresholds)

* Replace "settled cash" with "cash" wherever the value is `totalCash`, in the six locations
  in D-3.1. If settled cash is genuinely wanted, that is a separate ingest change — the
  extension would have to populate `settled_cash`, which it currently does not.
* Cushion tile: print the denominator. Suggested: `excess liquidity $28,171 = 21.8% of NLV
  (23.8% of the $118,584 it is measured against)`.
* Where SC-B5's unused-NLV figure and the cushion appear together, add one clause naming the
  difference: unused NLV is `1 − maintenance ÷ NLV`; the cushion is
  `(cash − maintenance) ÷ NLV`.

**A cushion ladder, always rendered (D-4).** Promote excess liquidity out of the tile
sub-clause and the conditional finding into a standing element of the liquidity block, drawn
against its own two thresholds with the distance to each in both units the operator can act on
— percentage points, and dollars of maintenance margin. On the 09-03 numbers:

```
  ██████████▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░
  0%        10%       20%       30%      40%
  █ IB liquidates   ▓ thin: replace only   ░ healthy
                      ▲ 21.8%  $28,171

  1.8pp above the 20% floor — maintenance may rise $2,342 (+2.6%) before "replace, never add"
 11.8pp above IB's 10% line — maintenance may rise $15,257 (+16.9%) before the broker acts
```

Requirements on it:

* **Rendered unconditionally**, whether or not R-MARGIN or R-CUSHION fires. The reason is D-4.3:
  a number that only appears when it is already bad cannot inform an opening decision.
* **Both distances shown**, and in dollars of maintenance as well as percentage points. "1.8pp"
  is abstract; "$2,342 of margin" is the same fact in the unit that new positions consume.
* **Denominator stated**, per D-3.2.
* **No new rule id.** Until the cushion is given one deliberately, label the two lines by their
  constant names (`CUSHION_THIN`, `CUSHION_CRITICAL`) or as "IB's own floor", not as `SC-B*`.
* **The arithmetic is exact and needs no per-leg data**: the crossing points are
  `maintenance = cash − k × NLV` for k = 0.20 and 0.10. This is why the ladder belongs in
  Phase 1 and not behind the Deep-sync blocker.

**Decision that changes:** how much may be opened, and whether a harvest is urgent. Today the
page says *stop opening* on SC-B2 and prints 22% with no scale; the ladder says how many dollars
of margin separate the book from the state where even replacement selling stops.

**Decision that changes:** none directly for the label fixes — they are the precondition for
trusting the numbers in Phases 2 and 3. The cushion ladder above does change a decision, and
Phase 1 is worth shipping on its own for that reason.

### Phase 2 — the ring-fenced cushion (one derived quantity, one tile)

In `bookrisk.ts`, alongside `excessLiquidityPctOfNlv`, add:

```
cashLessDelivery          = totalCash − acquisition.delivery
ringfencedCushionBound    = cashLessDelivery ÷ nlv          // upper bound on the conflict
apMaintMarginKnown        = Σ maintMargin over declared acquisition legs with a what-if
apMaintMarginCoverage     = declared legs with a what-if ÷ declared legs
```

Render as a tile in the Acquisition book section — not in the liquidity block, because the
finding belongs to the interaction and readers must not mistake it for a broker figure:

```
Cushion if the delivery promise is ring-fenced
19.2% of NLV  ($24,784)                       floor 20% — fails by 0.8pp
Upper bound on the conflict: the acquisition legs' own maintenance margin
would be released on assignment and is double-counted here.
Known for <n> of 4 declared legs — newest what-if 27d old.
```

There are **4 declared legs / 8 contracts** (GDX 78P ×5, GDX 63P ×1, GDX 65P ×1, SOXX 420P ×1,
per `/md/risk.md` Acquisition book, 09-03). How many of the four carry a what-if row in
`option_harvest_position_margin` was **not measured for this proposal** — the tile must read it
rather than assume it, and must degrade to "coverage unknown" if the join returns nothing.

Rules to cite: `SC-B5` and `AP-4` together, with the note that **neither is breached by this
number** — it is the two read against each other, which is spec §7.3, still open.

**Decision that changes:** whether "the cushion is fine at 21.8%" survives contact with the
delivery promise. Today it appears to; ring-fenced it does not. That is the difference between
"free margin before opening" and "you have no free margin at all".

**Test:** after a Deep margin sync brings declared-leg coverage to 8/8, compute (a) cushion,
(b) cushion less delivery, (c) cushion less delivery plus released acquisition maintenance. If
(c) ≥ 20%, §7.3 is an accounting artifact and this tile should say so; if (c) < 20%, the
ring-fence is a real constraint and belongs in the gate stack as a proposed `SC-B6` / `AP-8`
with its own `effectiveFrom` and review date. **Do not add that rule until (c) is measurable.**

### Phase 3 — the margin shock (one table, blocked on coverage)

A companion to the existing Parallel shock, answering the question that table does not:

| Move | Est. maintenance | Cushion | Verdict |
| --- | --- | --- | --- |
| −10% | … | … | |
| −5% | … | … | |
| 0% | $90,412 | 21.8% | current |
| +5% | … | … | |
| +10% | … | … | thin < 20% |
| +20% | … | … | IB acts < 10% |

Plus the two crossing points stated in plain terms: the move at which the cushion reaches 20%,
and the move at which it reaches 10%. At constant cash the arithmetic on today's numbers gives:

* **20% (thin)** — maintenance $92,754, i.e. **+$2,342, +2.6%** of the current requirement.
* **10% (IB acts)** — maintenance $105,669, i.e. **+$15,257, +16.9%**.

That first line is the one that matters and it is not on any page: the cushion is 2.6% of a
margin move away from the state whose own rule says *replace, never add*. Both sentences can
ship in Phase 2 if Phase 3 stalls, because neither needs per-leg data.

**Hard precondition.** This needs a per-leg margin model, and per-leg what-if coverage is 29%
on a 27-day-old pass. Built today the estimate would be a floor derived from a floor. Options,
in order of honesty:

1. Get coverage to ~100% with a Deep sync, then model per-leg maintenance under a shifted
   spot and re-sum. Label it *inferred*, name the model, and show coverage on the table.
2. Ship only the account-level crossing points (above), which need no per-leg data at all —
   they are arithmetic on `excess_liquidity` and `maint_margin`.
3. Do nothing and leave `system-gaps.md` §6 as the record of why.

Recommended: **(2) now, (1) when coverage allows.** Do not ship a per-leg shock at 29%
coverage.

---

## 5. What this proposal deliberately does not do

* **No new gate.** The ring-fenced cushion is displayed as a *reading*, not a pass/fail, until
  the overlap in §2 is measurable. A gate that fires on a double-counted number would tell the
  operator to stop opening for an arithmetic reason, which is the failure mode the three-books
  split exists to prevent.
* **No change to AP-4's denominator.** Total cash may well be the right basis; that is a
  doctrine question for `acquisition-puts.md` §3.4 and belongs to the operator. This file only
  records that the label and the field disagree.
* **No claim that the book is safer or riskier than `/risk` currently says.** Every gate keeps
  its current verdict: SC-B2 fails at 70.0%, SC-B5 fails at 30.0% unused, cushion passes at
  21.8%, AP-4 book passes at 79.1%, AP-4 name fails on GDX at 43.7%.
* **No backfill of `settled_cash`.** That is an extension/ingest change and is out of scope.

---

## 6. Verification for the implementing agent

1. `npm run check` — 629 assertions, nine scripts. A doc↔registry drift is a build failure; no
   rule ids or thresholds change here, so `sc-rules-check` and `bookrisk-check` must pass
   untouched.
2. `npx tsx scripts/page-markdown-check.ts` — `/md/risk.md` must still mirror `/risk`. Phase 1
   changes its bytes on purpose; Phases 2–3 add sections.
3. Re-derive the §1 identities after any balance-model change:
   `excess_liquidity = equity_with_loan − maint_margin` must still hold to the cent.
4. Deploy atomically — `npm run build && sudo systemctl restart option_harvester` — then load
   `/risk` and confirm the new tile against a fresh `psql` read of the same snapshot.

## 7. Caveats on every number in this file

The book behind all of it is the **2026-09-03 06:39Z** snapshot — marks from the 09-02 close,
two US sessions missing, no sync landed as of 2026-09-07 07:05Z (`/md/sync.md`: *last sync 4d
ago*; extension v0.9.6 reporting *"no account yet (still logging in)"*). Balances are IB's own
fields and are current as of that snapshot; per-leg margin is 29% covered and 27 days old;
`system-gaps.md` §6 and §14 both apply. Re-measure before implementing, and re-measure again
before believing any figure in §4.
