# Strategy improvement — 2026-09-01 10:02

**Run** `2026-09-01-1002` · **Previous** [`2026-08-28-1544`](../2026-08-28-1544/strategy.md) (4 days)
· Keys in [`data.json`](data.json) · live-book read in [`risk.md`](risk.md)

This report is a **delta**. Run 1's findings F-1 to F-6 are not restated; each is checked against four
more days of data and marked *held / strengthened / weakened*. Unit of account is labelled everywhere.

---

## 1. The record improved, and the reason is measurable

| | Run 1 | This run | Δ |
| --- | --- | --- | --- |
| Closed **legs** | 211 | 221 | +10 |
| Legs realized | −$5,793 | **−$3,660** | **+$2,133** |
| Legs kept % | −11.6% | −7.0% | +4.6pp |
| Legs win rate | 64.9% | 66.5% | +1.6pp |
| Closed **chains** | 164 | 174 | +10 |
| Chains realized | −$5,873 | **−$3,970** | **+$1,903** |
| Chains kept % | −12.9% | −8.2% | +4.7pp |
| Chains win rate | 68.9% | **70.1%** | **crosses the ≥70% program target** |
| Worst chain | −$10,086 MRNA | unchanged | — |
| Rolls / bad rolls | 47 / 10 | 47 / 10 | unchanged |

Attribution of the +$1,903, chain-wise: **6 new expiries** took expired from 75 → 81 and +$13,481 →
**+$14,973** (+$1,492, 93.8% win, 85.5% kept); **4 new buy-backs** took bought-back from 87 → 91 and
−$19,593 → **−$19,182** — i.e. the four new buy-backs netted **+$411**.

**What this is evidence for.** `SC-M1` (harvest at 70%) is the rule that produced it: the closes in
this window were profitable, wide-cushion positions taken at high captured percentages. Buy-backs
netting positive is the same point from the other side — run 1's F-5 and the `/risk` brief both say
closing at the give-up line is the defence, and four more data points agree.

**What it is not evidence for.** The win rate crossing 70% is a **program-target** crossing on a
cumulative record, not a validated revision. All **174** chains are still `v0.1`; `n = 0` under v1.1+.
And credit kept is **−8.2%** against a ≥30% target, so one of the two success criteria is met and the
other is not close.

---

## 2. Run 1's findings, re-checked

### F-1 (the 2026-08-19 biotech event owns the deficit) — **strengthened**

The event legs are unchanged at −$11,854 on $913 of credit, but the deficit they sit against shrank
from −$5,793 to **−$3,660**. That pair is now **324% of the program's net leg deficit**, up from 205%.
Nothing else in the record moved materially. The concentration of the loss in one correlated pair on
one day is now more extreme, not less.

### F-2 (one leg determines the shape of the cohort tables) — **held, and now easier to see**

Every ex-event figure moved further into the black while the raw numbers stayed negative:

| Cohort (legs) | n | Raw | Ex MRNA leg #2 | Run 1's ex-figure |
| --- | --- | --- | --- | --- |
| Δ 0.20–0.30 | 108 | −$8,982 | **+$1,322** | +$880 |
| cushion 1–1.5σ | 85 | −$4,949 | **+$5,355** † | +$3,808 |
| DTE 35–45 | 118 | −$7,934 | **+$2,370** | +$373 |
| IV ≥ 75% | 54 | −$6,092 | **+$4,212** | +$2,988 |

† same 1.0σ boundary ambiguity as run 1 — cushions render to one decimal.

**P-4 (do not retune the envelope) is reinforced.** Four days ago the 35–45 DTE row was −$91/trade and
"flat ex-event"; it is now −$67/trade and **+$20/trade ex-event**. A revision written on the raw row in
either run would have been wrong in the same way.

### F-2b · What *did* strengthen on its own merits

Two cohorts improved without any event adjustment, and both are entry-keyed, which makes them the
legitimate kind:

* **Δ 0.10–0.20**: 66 → **74** trades, +$4,478 → **+$6,169**, +$68 → **+$83/trade**, win 79% → **81%**.
  The core band is now the strongest it has read in the reviewed period.
* **Cushion 1.5–2σ**: 18 → **19** trades, +$1,075 → **+$1,476**, +$60 → **+$78/trade**, win 89%, credit
  kept 73% → **78%**.

`SC-E3`'s 1.5σ floor now has **19 trades** above it at +$78/trade and 78% credit kept. That is above the
12-trade threshold and it is the cleanest support the cushion rule has had. It is also, per
[`risk.md`](risk.md) R-2, the rule that was broken three times out of three in the last four days.

### F-3 (the compliant roll produced the deficit) — **held, untested**

47 rolls, 10 bad — both unchanged. No new roll since run 1, so nothing new to say. `SC-M3` still tests
legality and not wisdom.

### F-4 (contracts per name breached by twelve names) — **held, one case worsened**

IONQ went from 4 contracts across two legs to **6 contracts across four legs** (calls ×3, P35 ×1,
P30 ×2) against a 1–2 cap. ONDS remains at 21, TTD at 12. Still no gate surfaced (`system-gaps` §9),
and this run supplies a fresh instance of the consequence: the new IONQ P30 ×2 raised a name that was
already 3× over its contract cap.

### F-5 (holds ≤7 days are the worst cohort) — **held exactly**

`cohort.hold.lte7` is **unchanged at 23 legs / −$17,233**: no position was closed inside a week during
this window. Meanwhile 22–45d went 81 → **90** legs at +$4,682 → **+$6,680** and >45d 32 → **33** at
+$5,975 → **+$6,111** (97% win). The monotonic hold-length pattern is intact and the discretionary-panic
behaviour did not recur.

### F-6 (per-name verdicts have no size term) — **held**

MRNA still reads *too few trades* on 2 closed trades and −$10,086, and **MRNA is still on the candidate
list** (one gate short, `SC-S1` trend up). A live MRNA C200 remains on the book.

---

## 3. The new finding

### F-7 · The doctrine's stop-opening instruction is not binding on the operator, and that is now measured

**FINDING.** Between the two runs, with **all five `SC-B*` gates breached in both**, three new short
puts were opened — **3 of 3 inside the `SC-E3` 1.5σ cushion floor** (0.9σ, 0.9σ, 0.4σ) — while the six
positions closed were drawn from the *widest-cushion* end of the harvest ladder and none of the three
sub-1σ legs the previous run named was touched.

**EVIDENCE.** `churn.legsOpened` = 3, `churn.newLegsUnderSigmaFloor` = **3**,
`churn.openedWhileBlocked` = true. Opened: IONQ P30 ×2 (0.9σ), SLV P52 ×2 (0.9σ), WPM P125 (**0.4σ**,
6% OTM), $447 of credit combined. Closed: LULU C145 (2.3σ), ORCL C190 (1.8σ), IBIT P29 (1.8σ), MRVL
C320 (1.7σ), SLV C70 ×3 (1.3σ), COPX C105 (1.0σ). `gate.SC-B3.shareInside1Sigma` 0.36 → **0.46**.
Run 1's `risk.md` §2 R-1 action line read: *"do not open until the cushion is back above 20%"*, and
R-4's read *"refuse new sales under 1.5σ"*.

**MECHANISM.** The gate stack computes and renders correctly — `/short-call/candidates` carries the
*stop opening* banner and every row is labelled — so this is not an instrumentation failure. It is that
**the page's hardest instruction is the one with the least surface**: a banner above a list of twenty
attractive candidates is competing with the list, and the list wins. Meanwhile the three legs actually
opened are not even on that list, so they never passed through the gate stack at all. The gate stack
screens *candidates*; it does not screen *trades*.

This is the same structural gap as F-3 in a different place. A roll is a new sale that the entry rules
never see. A manually chosen name is a new sale that the entry rules never see. In both cases the rules
exist, compute correctly, and are not in the path.

**CONFIDENCE.** Measured for the leg states. **The open/close attribution is derived by hand** from two
captures — no engine emits a book diff — so a close-and-reopen at the same strike would be invisible to
me. `n = 3` entries, so this is a statement about *process*, not a cohort result.

**Bias to state plainly.** The record improved this window. That is the condition in which a
discipline finding is easiest to dismiss and most worth making: the +$1,903 came from positions opened
weeks ago, and the three new legs contribute +$6 of open P/L so far.

---

## 4. Proposals

Run 1's P-1 to P-5 stand unchanged and are not re-argued. Status:

| | Proposal | Status |
| --- | --- | --- |
| P-1 | per-chain loss cap | still blocked on a path-revalued backtest (`system-gaps` §4) |
| P-2 | unscheduled-event gate | still reasoned-not-evidenced, n=3 Biotech |
| P-3 | cap simultaneous same-theme entries | **now has a second instance**: SLV P52 and WPM P125 are both Precious metals, opened together |
| P-4 | do not retune the envelope | **reinforced** — see F-2 |
| P-5 | surface contracts-per-name; calendar rule | **reinforced** — see F-4 |

### P-6 · Put the entry gates in the path of a trade, not just of a candidate

**PROPOSAL.** A **pre-trade check** surface: enter symbol / right / strike / expiry / qty and get the
full `SC-S*` + `SC-E*` + `SC-B*` stack evaluated with margins for *that* contract — the same
`evaluateRules` call the candidates page already makes, against an arbitrary leg rather than a
generated one. Include the roll case, so a proposed roll's new leg is evaluated as an entry (F-3).

**Why this and not a stronger banner.** The gates already render and were already read; the failure was
that the three trades never went through them. A check the operator can run on a contract they are
actually about to sell is the smallest change that puts a rule in the decision path. It also creates
the artifact that would let a future run say *the gate was consulted and overridden* rather than
*the gate was not consulted* — which are different problems with different fixes, and today they are
indistinguishable.

**TEST.** Not a strategy hypothesis, so no cohort. The measurable claim: after it exists, the share of
newly-opened legs that clear `SC-E3` at entry should rise. **Disproved if** new legs keep landing under
1.5σ at the same rate, which would mean the constraint is deliberate preference rather than oversight —
and *that* would be a doctrine question (is the 1.5σ floor right for the put book?) rather than a
compliance one.

**COST.** Page surface + a thin loader. No new engine, no threshold, no schema.

### P-7 · Emit a book diff between two dates

**PROPOSAL.** A function that takes two position snapshots and returns opened / closed / changed legs.
This run's F-7 — the most actionable finding in it — required hand-comparison of two markdown captures,
and it is the one number a review most obviously needs: *what did I do since last time*.

**TEST.** Mechanical. **Disproved if** it cannot distinguish a close-and-reopen from a hold, which is
the one case my manual method gets wrong.

**COST.** Lib computation, and it makes §4 of every future `risk.md` generated rather than derived.

---

## 5. Rejected — unchanged from run 1

"Stop buying back" (four more buy-backs netted **+$411** this window — the third independent
confirmation); "Δ0.20–0.30 is a losing band"; "cap entry IV"; "single stocks are the problem";
"abandon 35–45 DTE"; "raise the GDX acquisition cap". Full reasoning in run 1 §6.

**One addition.** *"The strategy is working, the record improved $1,903."* The improvement came from
`SC-M1` harvests on positions opened weeks earlier. The trades opened **in** this window were three
sub-floor entries carrying +$6. A record can improve and the process can degrade in the same window,
and this window is that.

---

## 6. What could not be verified

* Everything in run 1 §7 still applies: reconstructed Δ/IV at fill, the 1.0σ boundary case, the
  untestable loss cap, zero chains under v1.1+, the excluded long book.
* **The open/close diff is hand-derived** (P-7 exists because of it).
* **Whether the three new entries were deliberate overrides or oversights** — nothing records an
  override, which is half of P-6's point.
* **Margin attribution degraded** to 34% coverage with 21-day-old what-ifs.
* **`system-gaps` §12** — I did not re-read the `iv_history` day count this run, so the IV-rank caveat
  is carried forward from run 1 rather than re-measured.
