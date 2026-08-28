# Potential target — 2026-08-28 15:44

**Run** `2026-08-28-1544` · **Rules** short calls v1.2 · Keys in [`data.json`](data.json) ·
receipts in [`sources/risk.md`](sources/risk.md), [`sources/short-call-candidates.md`](sources/short-call-candidates.md)

---

## 0. STOP OPENING

**All five §6.2 book gates are breached** — `SC-B1`, `SC-B2`, `SC-B3`, `SC-B4`, `SC-B5`. The
doctrine's instruction is to fix the book before adding risk, and `openingBlocked = true` is what
makes that bite rather than advise.

| Gate | Value | Limit |
| --- | --- | --- |
| `SC-B1` theme / effective themes | Semiconductors **42%** · **4.2** themes | 25% · ≥6 |
| `SC-B2` maintenance ÷ NLV | **66%** | 60% |
| `SC-B3` legs inside 1σ | **36%** (16 of 44) | 15% |
| `SC-B4` premium puts vs calls | **$10,242 vs $4,887** | puts ≤ calls |
| `SC-B5` dry powder | **22%** cushion | ≥50% NLV unused |

**Everything below is for after room has been made.** Selling any of it today makes the findings
in [`risk.md`](risk.md) worse, whatever the premium looks like. The nine harvestable legs
($4,439 credit, +$3,324 open) are the source of that room.

---

## 1. Vol regime — the §2 preference is nearly unavailable

Across **626** sellable names with an IV history: **441 have IV falling** over the last five
observations, 168 rising, and only **15 are rich *and* deflating** (rank ≥ 50 with `chg5` < 0).
So the §2 preference — *high IV that has started to come off*, which puts short vega on the same
side as theta — is satisfiable by 2.4% of the universe today. Two of the 15 appear below (SLV,
IBIT) plus EIX in tier 2. Read an absence of deflating badges as *the preference is unavailable*,
not as an oversight.

**Caveat that limits every rank on this page:** `iv_history` holds **63 distinct days**, so "rank
58" means *in its last three months*, not its year (`system-gaps` §12).

---

## 2. Tier 1 — no failing gate

Ranked by preference fit. Fit is a **preference, never a permission**: these clear the rules, they
do not override §0. Strike / Δ / credit are **Black-Scholes constructions** from each underlying's
ATM IV at the 2026-08-27T22:14Z ingest — indicative, to be checked against the live chain.

| # | Name | Theme | Proposed | DTE | Δ | Credit | σ cushion | Fit | Components | Unknown gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **SLV** | Precious metals | 2026-10-02 C77.5 | 35d | 0.08 | ~$30 | **1.7σ** | **47** | downtrend 11 · **IV deflating 15** · cushion 9 · credit 1 · record 10 | `SC-S6` no earnings date |
| 2 | **IBIT** | Crypto-linked | 2026-10-02 C55 | 35d | 0.07 | ~$18 | 1.7σ | 41 | downtrend 0 · **IV deflating 21** · cushion 9 · credit 1 · record 10 | `SC-S6` |
| 3 | **MSTR** | Crypto-linked | 2026-10-02 C155 | 35d | 0.12 | ~$146 | 1.6σ | 40 | **downtrend 17** · cushion 7 · credit 5 · record 10 | — clears every gate |
| 4 | **IONQ** | Off-Index | 2026-10-02 C60 | 35d | 0.10 | ~$41 | 1.7σ | 40 | downtrend 12 · cushion 10 · record 10 | — clears every gate |
| 5 | AKAM | Information Technology | 2026-10-02 C140 | 35d | 0.09 | ~$70 | 1.6σ | 32 | downtrend 11 · cushion 8 | — |
| 6 | FISV | Financials | 2026-10-02 C65 | 35d | 0.06 | ~$18 | **1.8σ** | 32 | downtrend 11 · cushion 11 · **theme unrepresented** | own record −$122 / 1 trade |
| 7 | GLW | Information Technology | 2026-10-02 C197.5 | 35d | 0.11 | ~$134 | 1.6σ | 31 | downtrend 8 · credit 5 | `SC-S5` no verdict |
| 8 | SPCX | Off-Index | 2026-10-02 C175 | 35d | 0.10 | ~$103 | 1.5σ | 28 | downtrend 7 · cushion 7 | — |
| 9 | TQQQ | Broad index | 2026-10-02 C92.5 | 35d | 0.09 | ~$45 | 1.6σ | 26 | rising 12% · record 10 | `SC-S6` |
| 10 | HOOD | Crypto-linked | 2026-10-02 C142.5 | 35d | 0.10 | ~$95 | 1.6σ | 21 | rising 23% · credit 4 | `SC-S5` no verdict |
| 11 | PAAS | Precious metals | 2026-10-02 C57.5 | 35d | 0.10 | ~$33 | 1.5σ | 21 | downtrend 3 · record 10 | — |
| 12 | MCHP | Information Technology | 2026-10-02 C92.5 | 35d | 0.10 | ~$50 | 1.5σ | 20 | downtrend 7 · credit 2 | — |

Every row sits at **35 DTE with a weekly ladder** and **1.5–1.8σ of cushion at Δ0.06–0.12** —
i.e. inside `SC-E2`'s window and, unusually, **above** `SC-E3`'s 1.5σ floor. That is the
combination the record's best cohort occupies (1.5–2σ: 89% win, 73% credit kept, n=18).

**"No gate fails · 1 unknown" is not the same as a pass.** Five of these twelve have a gate that
could not be evaluated. An **absent earnings date is a data gap, not an event-free name** — which
matters more this run than usual, because the worst trade in the record passed `SC-S6` on a real
date and was killed by an unscheduled event ([`strategy.md`](strategy.md) F-1).

---

## 3. Tier 2 — one gate short, named

Permitted only by a deliberate override, and the override has to be argued against §0.

| # | Name | Theme | Proposed | Δ | Credit | σ | Fit | **Gate failed** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **HONA** | Industrials | 2026-10-02 C195 | 0.09 | ~$89 | 1.6σ | **51** | `SC-S2` — **1 vs 4 weeklies** (thin ladder) |
| 2 | EIX | Utilities | 2026-10-02 C90 | 0.07 | ~$26 | 1.8σ | 40 | `SC-S2` — 1 vs 4 weeklies · *IV deflating 25* |
| 3 | ON | Semiconductors | 2026-10-02 C95 | 0.09 | ~$52 | 1.6σ | 35 | `SC-B1` — Semis already 42% |
| 4 | SOXL | Semiconductors | 2026-10-02 C190 | 0.15 | ~$285 | 1.5σ | 33 | `SC-B1` — Semis already 42% |
| 5 | QCOM | Semiconductors | 2026-10-02 C197.5 | 0.10 | ~$94 | 1.5σ | 26 | `SC-B1` — Semis already 42% |
| 6 | GDX | Precious metals | 2026-10-02 C127.5 | 0.09 | ~$59 | 1.6σ | 26 | `SC-S1` — **trend up** |
| 7 | COIN | Crypto-linked | 2026-10-02 C250 | 0.12 | ~$202 | 1.5σ | 25 | `SC-S4` — $191 outside the $20–180 band |
| 8 | **MRNA** | Biotech | 2026-10-02 C192.5 | 0.12 | ~$176 | 1.5σ | 24 | `SC-S1` — **trend up (rising 95%)** |

HONA tops the fit table on a **−37% average regression slope** and fails on liquidity. That
ordering is correct and worth stating: fit is a preference, liquidity is a gate, and the gate wins
— a thin ladder means no roll and no exit at a sane spread, which is the condition under which a
manageable loss becomes an unmanageable one.

---

## 4. Cross-checks this run's findings force on the list

The gate stack is per-name and per-rule. Three things it does not currently say, all of which are
visible once the list is read against [`strategy.md`](strategy.md):

**4.1 · Four candidates would breach the contracts-per-name cap, and no row says so** (F-4).
`SC-E4` caps a name at **1–2 contracts**. The book already holds:

| Candidate | Already open | After selling 1 | vs cap |
| --- | --- | --- | --- |
| SLV (tier 1 #1) | call 70 ×**3** | 4 contracts | **2× over** |
| IONQ (tier 1 #4) | call 60 ×**3** *(same strike, same 35d)* | 4 on one strike | **2× over** |
| TQQQ (tier 1 #9) | call 85 ×2 + 2 puts | 3 calls | over |
| SOXL (tier 2 #4) | 4 legs (puts) | — | theme + name pressure |

The engine *does* know a call is already open — it prints "no call already open on this name" for
IBIT, MSTR, AKAM, FISV, PAAS, MCHP, HOOD and omits it for SLV, IONQ, GLW, SPCX, TQQQ, MRNA. It
just does not turn that into the contract-count margin. IONQ is the sharp case: the proposal is
**the contract already held three times over**.

**4.2 · MSTR is the book's tightest leg and clears every gate as a call.**
MSTR **P100 is at 0.38σ**, the tightest cushion in the book and the lead example in `SC-B3`'s
breach. A short call on the same name at 1.6σ is a *different* side and passes cleanly, and the
combination is a short strangle on a 79-IV name at a moment when the book is already 36% inside
1σ. Not a gate breach; worth a deliberate decision rather than a default.

**4.3 · MRNA is on the list, one gate short, and it is the name that produced the deficit.**
`SC-S5` reads *too few trades* (2 closed, −$10,086) so the per-target verdict does **not** veto it
(F-6); only `SC-S1` (trend up) stops it. There is also a live MRNA C200 on the book, itself one of
the four calls on rising names. Under proposal **P-2** this name would be excluded by class, not
by trend — and the trend gate is exactly the one an override could be argued past.

---

## 5. What this list cannot tell you

* **Strikes, deltas and credits are inferred** — Black-Scholes from the last ingest's ATM IV, with
  no skew, r = 4% and no dividends. A far-OTM call's Δ inherits the wrong part of the smile
  (`system-gaps` §1). Check the chain before selling; the credit is the number most likely to be
  wrong.
* **IV rank rests on 63 days** (`system-gaps` §12), and the deflation signal (`chg5`, `offPeak20`)
  reads off the same short series.
* **Δ×DTE cell economics are one-observation dominated.** The plan intends this page to show the
  historical $/trade of the cell a candidate lands in; on this record the 0.20–0.30 and 35–45 cells
  are dominated by a single leg (F-2), so that figure should not be read as an expectation.
* **No candidate has been checked for an unscheduled catalyst.** `SC-S6` covers scheduled earnings
  only, and five tier-1 rows do not even have that.
* **Fit is not expected value.** It is a transparent preference ranking with its components
  printed; nothing here estimates a distribution.
