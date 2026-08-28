# Risk analysis — 2026-08-28 15:44

**Run** `2026-08-28-1544` · **HEAD** `3148407` · **Rules** short calls v1.2, acquisition puts v1.1
· **Previous run** none (this run establishes the key space)
· Every number here is keyed in [`data.json`](data.json); receipts in [`sources/`](sources/).

**Frozen snapshot. Nothing on this page re-derives.** For the live reading, `/risk`.

---

## 0. Preconditions — read before the findings

| Check | | Detail |
| --- | --- | --- |
| Book fresh | **pass** | IB sync 2026-08-28 10:22, 5.4h old against `BOOK_STALE_HOURS` = 24 |
| Δ measured | **pass** | 44 of 44 legs carry a **current IB measurement**; 1 diverges from its mark by >0.05. No modelled fallbacks, no low-confidence legs — this is the best delta state the book has been in |
| Ingest fresh | **pass** | price/IV 2026-08-27T22:14Z, 17.5h — one session |
| Margin coverage | **FAIL** | 45% of legs priced by IB what-if, newest **2026-08-11 (17 days)**. Per-leg margin attribution is a **floor**; the account-level requirement below is not affected |
| Open set reconciled | **FAIL** | `system-gaps` §14 unfixed. No open-premium figure in this report comes from `reconcile:sc` |
| Compliance measurable | **FAIL** | all 164 closed chains are v0.1. Envelope statements are counterfactual, never compliance |

Two findings below are constrained by a failed precondition and say so inline.

---

## 1. Book gates — all five book rules breached

`sc-actions.ts:buildGates` → `openingBlocked = true`. The doctrine's answer to "what should I
open" is **nothing**, until the book is fixed.

| Rule | Measure | Value | Limit | | Margin |
| --- | --- | --- | --- | --- | --- |
| `SC-B1` | top theme share (Semiconductors) | **42%** | 25% | fail | −17pp |
| `SC-B1` | effective themes (1/HHI) | **4.2** | ≥6 | fail | −1.8 |
| `SC-B2` | maintenance ÷ NLV | **66%** | 60% | fail | −6pp |
| `SC-B3` | legs inside 1σ of strike | **36%** (16 of 44) | 15% | fail | −21pp |
| `SC-B4` | premium put credit vs call credit | **$10,242 vs $4,887** | puts ≤ calls | fail | −$5,355 |
| `SC-B5` | unused NLV (dry powder) | **22% cushion** | ≥50% | fail | — |
| `SC-E4` | top single name (SOXX) | **14%** | 5% | fail | −9pp |

`SC-B2` is quoted from **IB's own account requirement** ($88,235 of NLV $133,925), not from the
per-leg sum ($39,919 at 45% coverage) — the gate must not be evaluated on a number that is
structurally a floor (`system-gaps` §6).

---

## 2. Findings, worst first

### R-1 · Liquidity is the binding constraint, not the market — `SC-B2`, `SC-B5`

**Evidence.** Maintenance margin **$88,235 = 66% of NLV** ($133,925) against a 60% limit.
Excess liquidity $29,265 = **22% cushion**. Assignment notional $670,250 = **5.0× NLV**.

**Mechanism.** Short option margin is recomputed continuously, so a rally raises the
requirement long before any expiry resolves. At this cushion the broker chooses which positions
close, and when — which converts a book that would have been fine at expiry into realised
losses in the worst names. This is why liquidity outranks every other finding: the broker acts
before a thesis resolves.

**Action.** Free margin before anything else. Nine legs are already past 70% captured
($4,439 credit, +$3,324 open); close the ones inside 1σ first, since those are simultaneously
the `SC-B3` breach. Do not open until the cushion is back above 20% — which it currently is at
22%, so the constraint that actually binds is `SC-B2`'s 66%.

**Confidence.** Measured (IB account figure, 2026-08-28). Direction of travel is *worse
intraday*: `sessions/latest.md` recorded 64% / 24.2% on 08-27 and 66% / 22% now.

---

### R-2 · The book is one bet wearing nine tickers — `SC-B1`

**Evidence.** Semiconductors **$8,312 of $19,697 credit = 42%** across 9 legs, $173,300 of
assignment exposure. **4.2 effective themes** against a floor of 6. Sector HHI 0.230 vs theme
HHI 0.239 — the two agree here, so the usual "sector labels hide the bet" defence does not even
apply; the concentration is visible either way.

**Mechanism.** Diversification is measured across themes because correlated names move together
in exactly the scenario that hurts. At 42% one sector move decides the book's month, and
"judge the book, not the trade" stops being available as a defence.

**Action.** Add nothing in Semiconductors; take the next harvest from it. Note the three legs
that make it up are spread across three sector labels (SOXX = Info Tech, SOXL = Leveraged,
TSM = Off-Index) and are one bet.

**Confidence.** Measured.

---

### R-3 · SOXX alone is 14% of open credit — `SC-E4`

**Evidence.** SOXX $2,726 credit in **one leg**; top-5 names **54%** of credit; 14.1 effective
names against a §3 floor of 20.

**Mechanism.** The program's premise is that no single trade can matter. A name at 14% can move
the record on its own — which is precisely how the worst outcome in the closed book happened
(see the Strategy report, F-1).

**Action.** Do not add to it. Size the next sale on a name outside the top five.

**Note on framing.** SOXX is a *declared acquisition put* (`lib/acqputs.ts`), so its **delivery
obligation** is judged under `AP-4` and not as an inversion or an assignment risk. The
single-name **credit concentration** breach stands regardless of intent: correlated exposure is
real even when it is wanted (`acquisition-puts.md` §6).

---

### R-4 · A third of the book is inside one expected move — `SC-B3`, `SC-E3`

**Evidence.** **16 of 44 legs (36%)** sit inside 1σ of their strike against a 15% limit.
Tightest: MSTR P100 **0.38σ**, IONQ P35 0.62σ, SOXL P90 0.76σ, ONDS P5.5 0.83σ, B P33 0.88σ.

**Mechanism.** Cushion in σ is the measure the record says predicts outcomes, and %OTM flatters
these: an expected move is IV·√t, so a 30%-OTM strike on a 130-IV name is nearer than a 12%-OTM
strike on a 43-IV one. A book with this share inside 1σ is not diversified against a single
broad move — the legs breach together, which is the same failure mode as R-2 expressed in
distance rather than in theme.

**Action.** Roll the tightest legs out and up for credit, or close them. Refuse new sales under
1.5σ. Zero legs are currently past the 0.30 roll line or ITM, so this is a pre-emptive move,
not a rescue.

**Confidence.** Measured, and unusually well-measured this run: all 44 deltas are current IB
measurements rather than mark-implied fallbacks.

---

### R-5 · The premium book has inverted — `SC-B4`

**Evidence.** Premium short puts **$10,242** of credit against short calls **$4,887**.
$4,569 of declared acquisition puts correctly **excluded** from the test. Net share-equivalent
delta **+$716**.

**Mechanism.** The panic-put pivot is a separate book with the opposite exposure. When it
dominates, the account is long the market while the documentation and the target selection still
describe a short-call program — the risk being run is not the risk being measured.

**Action.** Either rebalance toward calls or state explicitly that the put book is now the
primary program and judge it by its own rules (`strategy.md` § 三). This is a documentation
decision as much as a trading one.

**Confidence.** Measured. Note the net Δ$ of +$716 is nearly flat, so the *directional* content
of the inversion is currently small — the finding is about which book the account is actually
running, not about an imminent loss.

---

### R-6 · Eight legs are held over an earnings print, two this week — `SC-S6`

**Evidence.** $6,278 of credit (32% of book credit) and $113,600 of assignment exposure over a
print. This week: **HPE C70** (print 2026-09-02, 30d of room to expiry) and **LULU C145**
(print 2026-09-03, 8d of room).

**Mechanism.** A gap is not drawn from the distribution IV describes, so the σ cushion does not
price it: a leg 2σ away tonight can be through the strike at the open. This is the risk single
stocks add over ETFs, and §2.6 is a hard gate for a reason.

**Action.** LULU is already at 84% captured and the page reads *close (harvest)* — taking it
resolves the print and frees margin in one move. HPE is at 4% captured with 35 DTE and reads
*hold*; it is also one of the four calls on a rising name (R-7), so it is the leg where two
findings meet.

---

### R-7 · Four short calls sit on names that have turned up — `SC-S1`, `SC-M5`

**Evidence.** COPX C105, CVNA C90, HPE C70, MRNA C200. 70% of legs are on non-rising
underlyings, so 30% are not.

**Mechanism.** The direction filter, not the strike, is what makes a naked call safe. Once the
trend turns up the only remaining defence is distance, and the record says distance alone loses.

**Action.** §4.5 forbids **rolling** these — close and redeploy. Note MRNA C200 is a live short
call on the name that produced the entire program deficit; it is 40% OTM at 1.7σ and reads
*hold*, but it is the position where the operator should be most willing to pay to be out.

---

### R-8 · The acquisition book's delivery promise is at its cap — `AP-1`, `AP-4`, `AP-7`

**Evidence.** 8 contracts promising **$93,800** of delivery = **80% of $117,500** settled cash
(cap 80%) and 70% of NLV. GDX 7 contracts / $51,800 = **44% of cash against its 40% name cap**;
effective basis $71.37 (−31.2% vs spot $104). SOXX 1 contract / $42,000, basis $392.74 (−25.3%).
**Nothing ITM**, so delivery is hypothetical today. Fill-weighted, the promise buys **$9,061**
of accumulation — 10% of the cash it reserves.

**Mechanism.** The exposure here is not the mark, it is the obligation. If several legs are
assigned in the same week the cash has to be there simultaneously — and the same cash currently
backs the premium book's margin, because nothing ring-fences it (`acquisition-puts.md` §7.3).
An assignment you cannot fund is a forced sale of something else, at the worst moment.

**Action (computed, not opinion).** `AP-7` gives up the weakest claim on reserved cash first:
**1× GDX 78P 2026-10-16, |Δ| 0.04, releases $7,800 for about $36** → GDX to 37% of cash, book to
$86,000 (73%). §4.5 requires this **before opening anything anywhere else in the account**.
This is a **balance-sheet close, not a harvest** — the reason is the cap, and the freed cash is
not a re-sell budget.

**What the 10% fill-weighted figure does and does not license.** It is a verdict on the
*strikes* — at |Δ| 0.04–0.15 these are barely an accumulation plan — and **not** permission to
reserve less than the full obligation, because one theme's deltas rise together.

---

### R-9 · 90% of the book's decay expires within eight weeks — no rule to breach

**Evidence.** $350/day of theta now, **$35/day after 2026-10-23**; 34 of 44 legs inside the
window. By DTE bucket, 41% of credit sits in 91–180 days but only 16% in the 35–45 target window.

**Mechanism.** Theme and name diversification are in the spec; **time is not**
(`system-gaps` §8). When the whole book expires together, the program must re-sell an entire
book at once, in whatever market exists that week and with whatever margin is free — which,
given R-1, may be none.

**Action.** Ladder new sales past the cluster. The rule that would make this bite does not
exist yet; it is proposed in the Strategy report (P-3).

---

## 3. Parallel shock — the directional bet, stated

| Move | Short calls | Short puts | Book at expiry |
| --- | --- | --- | --- |
| −20% | +$4,887 | +$10,710 | **+$15,597** |
| −10% / −5% / +5% | +$4,887 | +$14,810 | +$19,697 |
| +10% | +$4,742 | +$14,810 | +$19,552 |
| +20% | **−$871** | +$14,810 | **+$13,940** |

Both wings hold credit at every point in the grid, so this book has no losing scenario **at
expiry** under a parallel move. That is the honest good news, and it is also the trap: R-1 is a
*path* risk, not an endpoint risk. The broker can force the book closed at +10% long before the
+$19,552 expiry value is realised. The shock table and the margin gate are answering different
questions and the margin one is the one that binds.

---

## 4. What to do now — 44 legs, one verdict each

From `bookrisk.ts:verdictFor`, with the acquisition ladder run separately
(`acquisitionVerdictFor`).

| Verdict | Legs | Credit | Open P/L |
| --- | --- | --- | --- |
| Reduce contracts (`AP-4`) | 1 | $612 | +$430 |
| Close (harvest) | 9 | $4,439 | +$3,324 |
| Hold | 34 | $14,647 | +$6,646 |
| Roll / defend / let-expire | 0 | — | — |

**Harvest ladder, worst-cushion first** — this is the order that satisfies R-1 and R-4 together:

| Leg | DTE | σ to K | Kept | Credit | Open P/L | Note |
| --- | --- | --- | --- | --- | --- | --- |
| SOXL P90 | 21d | **1.0σ** | 77% | $1,099 | +$845 | biggest single release, tightest cushion, Semiconductors |
| AG P13 | 140d | 1.0σ | 79% | $884 | +$701 | print 2026-10-29 |
| COPX P66 | 140d | 1.1σ | 77% | $543 | +$416 | |
| B P33 | 203d | **0.9σ** | 72% | $700 | +$502 | print 2026-11-09 |
| ORCL C190 | 14d | 1.8σ | 56% | $299 | +$166 | print 2026-09-10, 1d before expiry |
| LULU C145 | 14d | 2.3σ | 84% | $239 | +$200 | print 2026-09-03 — resolves R-6 |
| GLW C215 | 35d | 2.2σ | 70% | $319 | +$225 | |
| SPCX C182.5 | 28d | 2.1σ | 72% | $235 | +$169 | |
| IBIT P29 | 84d | 1.8σ | 83% | $120 | +$100 | smallest |

Zero legs read *roll*: no leg is past the 0.30 line, ITM, tested, or short of roll room. The
book's problem this run is **size and concentration**, not per-leg distress.

---

## 5. What changed since the previous run

No previous run exists. Two movements are recorded from `sessions/latest.md` for continuity, and
both are classified per the architecture's §3.1:

| Change | From (08-28 10:00) | To (this run) | Class |
| --- | --- | --- | --- |
| Closed legs / realized | 210 / −$5,279 | 211 / −$5,793 | **data quality moved** — one newly-captured closing fill, not a restatement |
| Chain realized | −$5,162 | −$5,873 | **data quality moved** — same fill |
| Maintenance ÷ NLV | 64% (08-27) → 66% | 66% | **book moved** — tightened intraday |
| Δ provenance | mark-implied off 18–29h measurements | 44 measured, all current | **data quality moved** — the 10:22 sync |

From the next run onward this section is generated from the keyed diff.

---

## 6. What could not be verified

* **Per-leg margin attribution.** 45% coverage, newest what-if 17 days old. How much of the
  $88,235 this program is responsible for versus the LEAPs and the put book is an estimate
  (`system-gaps` §6). A Deep sync fixes it.
* **The open ledger set.** `system-gaps` §14 — 40 open chains / $152,642 in `reconcile:sc` that
  the broker does not hold. Every open figure here comes from `/risk` and `/positions` instead.
* **The long book.** 2 long legs are excluded from this analysis by construction and reported
  only as a count. `system-gaps` §7 says their share-equivalent delta is the largest single
  directional exposure in the account, which means the +$716 net Δ$ in R-5 is **not** the
  account's directional position.
* **Contracts per name.** §3 caps it at 1–2; `SC-E4` evaluates it, but I did not verify where it
  is rendered, so I am not claiming it is missing (`system-gaps` §9 asserts it is).
* **Four roll links are guesses** out of 39 rolled chains, so four chain stories are inference.
