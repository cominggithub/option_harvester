# Proposed amendment: unleveraged ETFs as the short-call universe (v1.3 candidate)

> **LANDED 2026-09-17 as short-call spec v1.3.** The operator accepted §5.A and §5.B and chose
> **calls only** on §8.1: *"move to unleveraged etf. call only. i have another strategy for put —
> i only sell put which is what i want to buy."* Then added a third instruction not in this
> file: **"the goal is to prevent huge market drop cause loss. also never sell call for inverse
> etf."** That turned `SC-S7` from an existing-but-overridable rule into a hard veto and is the
> reason v1.3 ships two rule changes rather than one — see § 10.
>
> In force: `SC-S8` (new), `SC-S7` (veto), `SC-M4` (re-scoped), registry v1.3,
> `docs/short-call-strategy.md` § 2.7. Findings `R-UNIVERSE` and `R-INVERSE` report legs the
> doctrine would no longer open. §8.2 (a loss cap for non-ETF underlyings) remains **open**.

**Status: proposal, not doctrine.** Written 2026-09-17 after the operator, reading finding
`SC-M4` ("nothing caps the size of a single loss, and one chain — MRNA — is 14.9× its own
credit"), concluded: *"I know I can't escape from that kind of sudden price jump. What I can do
is change my target from single company to ETF."*

That conclusion is **supported by the record, and it restores the doctrine's own original
position** — `docs/strategy.md` §一.2 rejected single stocks outright for gap risk, and §五
re-admitted them behind an earnings gate. This file is the evidence that the re-admission was
wrong, plus the one qualification the operator's framing is missing: **"ETF" cannot mean
"geared ETF"**, because on the measurement that matters geared funds are worse than single
stocks.

Landing this is a deliberate act by the operator. `docs/strategy.md`, `docs/short-call-strategy.md`
and `src/lib/sc-rules.ts` are not touched by this file.

---

## 1. FINDING: the loss was un-escapable, and a stop would not have capped it either

MRNA, reconstructed from the fills (`option_harvest_transactions`) and the daily bars
(`option_harvest_daily_prices`):

| date | action | fill |
| --- | --- | --- |
| 2026-07-22 | sold 2× 79C exp 2026-08-28 | $1.53 → +$305 credit · spot 58.07 · **36% OTM** |
| 2026-08-14 | rolled: bought 2× 79C, sold 2× 80C exp 2026-09-25 | −$87 / +$373 · spot 63.32 · **26% OTM** |
| 2026-08-19 | bought back 2× 80C | **$53.38 each → −$10,677** |

Chain: **$678 credit, −$10,086 realized, 14.9×.**

The roll on 08-14 was **credit-positive, out, and up** — compliant with every management rule in
force. The entry was 36% OTM. Nothing about this trade broke a written rule except the cushion
floor, and the cushion was not what killed it.

What happened on 08-19:

| date | prev close | day low | day close | move |
| --- | --- | --- | --- | --- |
| 2026-08-18 | — | 62.13 | **62.96** | −2.3% |
| 2026-08-19 | 62.96 | **114.46** | **174.38** | **+177.0%** |

**The day's low was 114.46.** Price never existed between 62.96 and 114.46. There was no
moment at which any order — stop, limit, roll, or close — could have filled inside that range.

### 1.1 This refutes the finding's own recommendation

`SC-M4`'s *Do* line currently reads: *"Adopt a hard per-chain loss cap (a stop at 2–2.5× credit,
or a defined-risk wing)."* The stop half is **refuted by the trade that motivated it**:

* a 2.5× stop on $678 of credit trips at **$1,695**;
* at the 08-19 low (114.46) the 80C was already **$34.46 intrinsic = $3,446/contract**, so two
  contracts were worth **≈$6,892 — 10.2× the credit — before the first tick printed**;
* the actual exit at $53.38 cost $10,677, so the stop would have saved $3,785 of a $10,304 loss
  and still booked **10× credit**, not 2.5×.

A stop is an escape mechanism. It presupposes a continuous price path. **Only three things bound
a naked short call's loss when the path is discontinuous:**

1. **a long wing above the short** (loss capped at width × 100 − credit, absolutely);
2. **size** (the loss is linear in contracts and in spot − strike);
3. **not selling that underlying at all.**

The operator's proposal is (3), applied at the level of the instrument class. That is why it
works where a stop does not.

**CONFIDENCE: measured.** Fills and bars are ours; the arithmetic is arithmetic. What is
*inferred*: the catalyst. A +177% single-day move in a biotech is not the scheduled print that
§五's earnings gate screens for, so the gate that was supposed to make single stocks admissible
would not have caught this — but the specific event is not in our data.

---

## 2. EVIDENCE: gap risk by instrument class, measured on our own bars

269,352 daily bars across 806 instruments. **Un-escapable up-gap** = `day_low / prev_close − 1`,
i.e. how far price was already past the previous close before any order could fill. This is the
quantity that matters for a short call; a full-day move overstates the danger because part of it
is tradeable.

| class | names | bars | worst 1-day | **worst un-escapable up-gap** | bars with gap >15% | **frequency** |
| --- | --- | --- | --- | --- | --- | --- |
| single stock | 530 | 184,171 | 191.3% | **191.3%** | 38 | 0.0206% |
| geared ETF | 64 | 19,007 | 94.6% | **35.6%** | 7 | **0.0368%** |
| ETF (1x) | 212 | 66,174 | 28.6% | **16.6%** | 2 | **0.0030%** |

Two results, and they point in opposite directions:

**2.1 Unleveraged ETFs are a different risk class.** Worst un-escapable gap **16.6%** against a
single stock's 191.3%, and a >15% gap is **7× rarer per bar**. The load-bearing consequence:
**in 66,174 unleveraged-ETF bars, no un-escapable gap ever exceeded 16.6%** — so a strike 20% or
more OTM on a 1x ETF has never once been jumped through in our history. MRNA's was 26% OTM.

**2.2 Geared ETFs are worse than single stocks on frequency.** 0.0368% of bars carry a >15%
un-escapable gap — **1.8× more often than single stocks and 12× more often than 1x ETFs**. Their
worst gap is smaller (35.6%) but they deliver it far more regularly, which is what a book of
many small bets actually experiences. Ours in the data: **KOLD +35.6%** (2026-02-02, closed
+48.5%), **BOIL +27.9%** (2026-01-20). A 3x fund converts a 12% index gap into a 36% fund gap by
construction; leverage multiplies the discontinuity, not just the volatility.

**2.3 The single-stock tail is smaller than the raw number, and still decisive.** Four of the
five largest "gaps" are corporate-action artifacts, not price events: **DD +191.3% / +136.7%**
(2025-04/05, ≈2.9×), **MNST +99.6%**, **APH +99.2%** (≈exactly 2×, i.e. split adjustments
applied to one side of the series), and **ECHO/SATS +69.4%** — the EchoStar listing move already
documented in the universe-hygiene work. Excluding artifacts, the genuine single-name tail in
our data is **~29–82%**: MRNA +81.8%, HONA +35.0%, HIMS +33.2%, ORCL +29.2%. That is still **5×
the worst 1x-ETF gap**, and MRNA is the one that actually cost money. Reporting 191% as the
tail would be building doctrine on a split adjustment.

---

## 3. EVIDENCE: what our own closed trades say

`/short-call/cohorts`, instrument class, 243 closed legs:

| class | trades | realized | per trade | win rate | credit kept | breached |
| --- | --- | --- | --- | --- | --- | --- |
| ETF (1x) | 56 | **+$1,141** | +$20 | 64% | **+11%** | 29% |
| leveraged ETF (2x) | 2 | +$232 | +$116 | 100% | +55% | 0% |
| leveraged ETF (3x) | 15 | **−$137** | −$9 | 53% | **−3%** | 20% |
| single stock | 170 | **−$2,357** | −$14 | **69%** | **−6%** | 15% |

**The argument is not "single stocks lose money."** Single stocks have the *highest* win rate in
the table (69%), and the −$2,357 contains MRNA's −$10,304 — so **ex-MRNA the 168 other
single-stock legs made roughly +$7,900, about +$47 per trade, more than double the ETF cohort's
+$20.** Single stocks were the more profitable class right up until they weren't.

That is the precise case for the operator's decision, and it is stronger than a mean comparison:
**the expectancy is fine and the tail is not survivable.** One realisation of a risk that no
management rule can reach converted 168 profitable trades into a losing cohort, and it is
**4.3× the entire program's current net deficit** (−$10,086 against −$1,582 at S#3).

The 3x cohort is the counter-evidence to a naive "move to ETFs": negative, kept −3%, 20%
breached, and on §2.2 it carries the highest gap frequency of any class. `n=15` is thin, so this
is *suggestive* on P/L and *measured* on gaps.

---

## 4. EVIDENCE: the live book's exposure to the same event

35 short legs, spot from the latest ingest, analysis **#5** (2026-09-17):

| class | side | legs | assignment notional | **loss on an MRNA-style +82% gap** | loss on the worst-ever 1x-ETF gap (+16.6%) |
| --- | --- | --- | --- | --- | --- |
| single stock | calls | **12** | $241,500 | **−$102,234** | −$410 |
| geared ETF | calls | 2 | $32,100 | −$13,961 | $0 |
| ETF (1x) | calls | **0** | — | — | — |

**Twelve single-stock call legs carry a $102,234 overnight tail against $2,765 of total call
credit and $130,554 of NLV — 78% of the account, in one night, unreachable by any order.** The
same book written on unleveraged ETFs, hit by the largest ETF gap in 66,174 bars, loses $410.

Short puts are excluded from this table because a short put's loss is **bounded** (strike → 0):
the 11 single-stock put legs risk at most $118,600, and 82% *up* is harmless to them. Bounded is
not small, but it is a different argument and it is not this one.

Composition of the live book by class: single stock **23 legs** (AG AKAM B BILI DDOG FSLR HIMS
HPE IONQ JBL KO MSTR NVDA ON ONDS SMCI TSM TTD UPST WPM), ETF 1x **7** (COPX GDX SLV SOXX),
geared **5** (BOIL NUGT NVDL TQQQ TZA).

---

## 5. PROPOSAL

The smallest change that acts on the finding, in three parts. Part A is the operator's decision
restated as a rule; B is the qualification the evidence forces; C is the transition.

**A. New selection rule — `SC-S8` (proposed): short calls are written on unleveraged,
non-inverse ETFs only.** Single stocks are excluded from the call universe. This restores
`strategy.md` §一.2 and supersedes §五's earnings-gate relaxation, on the grounds that the gate
addressed the wrong hazard: an earnings date is scheduled and avoidable, and the loss that
actually happened was neither.

**B. Geared funds are excluded from the call universe too**, on §2.2 (highest gap frequency of
any class) and §3 (−$137 over 15 trades, kept −3%). This **supersedes the premise of
`docs/proposals/leveraged-etf-sleeve.md`** for the call side — that file's own ordering
condition ("must not land ahead of a loss-size cap") is satisfied here not by adding a cap but by
removing the exposure. Its IV-based findings stand and remain the best argument for what to
write *within* the admissible class; unleveraged ETFs at IV ≥ 30% is the shelf `ETFHIV` already
computes.

**C. Existing single-stock legs run off; they are not force-closed.** Twelve call legs, of which
the current action board already wants ON C90 (92% captured), FSLR C250 (82%) and UPST C36 (81%)
closed as harvests, and DDOG C265 / HPE C67 / SMCI C48 closed under `SC-S1` (rising names).
Following the existing board retires half the exposure without a single new decision. The rest
expire inside 29 days.

**What this proposal does NOT claim.** It does not remove tail risk; it exchanges
**idiosyncratic** tail risk for **correlated** tail risk. A single-name gap hits one leg; an
index gap hits every leg simultaneously. So in an ETF-only book `SC-B1` (theme concentration)
and `SC-B3` (share inside 1σ) become *more* load-bearing, not less — and `SC-B3` is already
failing at 46% against a 15% limit. An ETF-only book that is 39% semiconductors has not solved
the problem, it has renamed it.

**What it gives up.** Premium: ETF IV is structurally lower, and §3's ETF cohort earns +$20 per
trade against single stocks' ex-MRNA +$47. Expect the book's theta to fall for the same margin.
The trade is explicitly *expectancy for survivability*, and it should be stated that way rather
than sold as a free improvement.

**What it removes for free.** `SC-S6` (earnings before expiry) disappears structurally — ETFs
have no prints. Six of the current book's flagged legs are that finding.

---

## 6. TEST — what would confirm or kill this

| # | Hypothesis | Cohort / data | `n` required | What kills it |
| --- | --- | --- | --- | --- |
| 1 | 1x ETFs do not gap through a ≥20%-OTM strike | daily bars, all 1x ETFs | already 66,174 bars | any un-escapable up-gap >20% appearing; **re-run quarterly** — this is a claim about a tail, so absence of evidence decays |
| 2 | The ETF cohort's +11% credit kept survives out of sample | closed legs, class = ETF 1x | **+30 legs** beyond the current 56 | kept% turning negative, or breach rate rising above the single-stock 15% |
| 3 | Losing the single-stock premium does not starve the book | theta ÷ margin, before vs after | 2 months of an ETF-only book | theta per $1k of maintenance falling below the current $3.96/day without a compensating fall in drawdown |
| 4 | Correlated gap risk does not replace what was removed | `/risk` parallel shock, −20% node | each analysis | the −20% node going negative, which it has already nearly done: **+$13,293 at #1 → +$1,967 at #5** |

Test 4 is the one to watch. It is already moving the wrong way for a different reason (the call
side was harvested), and an ETF-only book concentrates the same exposure.

---

## 7. COST — where the change lands

| Layer | Change |
| --- | --- |
| Doctrine | `docs/strategy.md` §一.2 / §五 — restore the single-stock exclusion for calls, state why the earnings gate was the wrong instrument. `docs/short-call-strategy.md` §2 — new `SC-S8`, and the changelog entry v1.2 → v1.3. |
| Rule registry | `src/lib/sc-rules.ts` — add `SC-S8`, version bump; `scripts/sc-rules-check.ts` enforces doc↔registry agreement, so both move together or the check fails. |
| Candidates gate | `src/lib/sc-candidates.ts` — the gate stack refuses a single-stock or geared call. Machinery exists: `isPlainWritable` / `isLevWritable` / `leveraged.ts`. |
| Screens | `ETFHIV` (unleveraged only, IV ≥ 30%) already computes the admissible shelf; no new list needed. |
| Pages | `/risk` § *Why it fails* gains the corrected `SC-M4` mechanism (a stop cannot cap a gap). `/short-call/strategy` renders the new rule automatically from the registry. |
| Audit | none — `audit:metadata` already validates instrument type, which is what the rule gates on. |

---

## 8. Two decisions only the operator can make

1. **Scope: calls only, or puts too?** The gap argument is asymmetric — a short put's loss is
   bounded at strike→0 and an up-gap is harmless to it. The 11 single-stock premium puts are a
   *bounded* $118,600 exposure. Excluding single-stock puts as well is defensible for
   simplicity, but it is not what this evidence proves. **Recommended: calls only.** The
   acquisition book is already ETF-only (GDX, SOXX) and is untouched either way.
2. **Does `SC-M4` still get a loss cap?** This proposal removes the exposure rather than capping
   it, which is why B satisfies the geared-sleeve file's ordering condition. But a defined-risk
   wing remains the only mechanism that bounds a gap *arithmetically*, and it would let single
   names back in later on a rule rather than on a memory. **Recommended: keep `SC-M4` open,
   re-scope it from "adopt a stop" — now refuted — to "a wing is the only cap, and it is the
   price of admission for any non-ETF underlying."**

---

## 9. What could not be verified

* **The catalyst behind MRNA's +177%** is not in our data. The claim that §五's earnings gate
  would not have caught it rests on the move's size and shape, not on a confirmed event date.
* **Survivorship.** `option_harvest_daily_prices` holds current and recently-retired tracked
  names. A stock that gapped and was then delisted is under-represented, which biases §2
  *against* single stocks being as dangerous as they are — the true tail is worse, not better.
* **The 2x cohort (`n=2`) says nothing.** It is in the table only because omitting it would
  flatter the argument.
* **`SC-B3` at 46% inside 1σ is not addressed by this proposal at all.** It is the worst live
  finding and it is orthogonal: an ETF-only book can breach it identically.
* **No `src/` change has been made.** Nothing in this file is in force.

---

## 10. What the proposal got wrong, added at landing

The operator's stated goal is **"prevent a huge market drop causing loss."** This file was
written about *up*-gaps on short calls, because that is what killed MRNA. Those are different
scenarios and the file did not connect them. Three corrections:

**10.1 A market drop is not a short-call problem — except on one instrument.** A broad drop is
*good* for every short call on a long underlying; the $273,600 of call notional gains. The drop
scenario is a **put-side** exposure: at −20% the 21 short puts lose $13,571 of intrinsic, at
−30% **$41,689**, and the margin requirement rises while it happens. That is bounded (strike →
0) but it is the real exposure to the stated fear.

**10.2 A short call on an inverse fund is the single exception, and it was live.** TZA is −3x
small caps, so a market drop sends it *up* by three times the index move. Short 3× the 55C at
spot 44.90 for $133 of credit: **−$5,052 at a −20% index move (38× credit), −$9,093 at −30%
(68× credit)** — a worse multiple than MRNA's 14.9×, on a position already open. It is the only
leg in the book correlated the wrong way for the scenario the program most fears, and at a −30%
drop it lands on top of the put book's $41,689 for a combined **~$50,782, 39% of NLV**, at
expiry intrinsic alone — the margin call arrives earlier.

`SC-S7` had banned inverse funds since v1.0. The position existed anyway because a single failed
gate rendered as an overridable *"one gate short — permitted if you override that rule
deliberately."* **The rule was not the failure; the presentation was.** Hence v1.3's third
change: universe rules are marked `veto` and are removed from the candidate list in every tier,
and `R-INVERSE` reports any that are already open.

**10.3 The put decision resolves the drop scenario doctrinally, not arithmetically.** The
operator's rule — *"I only sell put which is what I want to buy"* — makes every put an
acquisition put, so a market drop **delivers shares at a chosen basis** rather than producing a
loss. That is coherent, and it means the drop risk is a **funding** risk, not a P/L risk:
$267,500 of assignment obligation against $118,000 of cash. That is `acquisition-puts.md` §7.3
(the cash is not ring-fenced) and it is now the book's largest unresolved exposure.

**Consequence not yet acted on:** if every put is an acquisition put, the **17 premium put legs
($8,204, 53% of open credit) are doctrinally homeless** — they are neither short calls (this
spec) nor declared acquisitions (`acquisition-puts.md`). They need to be re-declared or run off,
and `SC-B4`'s call-vs-premium-put inversion test loses its meaning if the premium put book is
supposed to be empty. Not changed here: the operator said puts are governed by a separate
strategy, and this file has no authority over it.
