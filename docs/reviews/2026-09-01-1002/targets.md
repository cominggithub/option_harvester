# Potential target — 2026-09-01 10:02

**Run** `2026-09-01-1002` · **Previous** [`2026-08-28-1544`](../2026-08-28-1544/targets.md)
· Keys in [`data.json`](data.json)

---

## 0. STOP OPENING — unchanged, and now with a record of being ignored

All five §6.2 gates remain breached, in both runs:

| Gate | Run 1 | This run | Limit |
| --- | --- | --- | --- |
| `SC-B1` theme / effective themes | 42% · 4.2 | **42% · 4.1** | 25% · ≥6 |
| `SC-B2` maintenance ÷ NLV | 66% | **65%** | 60% |
| `SC-B3` legs inside 1σ | 36% | **46%** | 15% |
| `SC-B4` premium puts vs calls | 2.10× | **2.89×** | ≤1× |
| `SC-B5` dry powder | 22% cushion | 24% | ≥50% unused |

`openingBlocked` has been true across both runs. Three legs were nonetheless opened in between, all
three inside the `SC-E3` floor ([`strategy.md`](strategy.md) F-7) — **and none of them came from this
list.** That is the finding this page has to carry: the gate stack screens the candidates it generates,
not the trades that get placed.

**The room to make is on the ladder, not on this page.** Ten legs sit at ≥70% captured ($4,383 credit,
+$3,379 open). Three of them — SOXL P90, AG P13, COPX P66 — are inside 1σ and reduce margin, delta and
`SC-B3` at once.

---

## 1. Vol regime — the preference got thinner

| | Run 1 | This run |
| --- | --- | --- |
| Names with IV history | 626 | 627 |
| IV **falling** (5 obs) | 441 | **351** |
| IV **rising** | 168 | **266** |
| Rich **and** deflating (rank ≥50, `chg5` < 0) | 15 | **12** |

IV is rising across substantially more of the universe than four days ago. §2's preference — sell into
a *falling* vol so short vega works with theta — is available on **12 of 627 names (1.9%)**, down from
2.4%. Read an absence of deflating badges below as the preference being unavailable, not as an
oversight. Same caveat as always: rank is computed over a short `iv_history` (`system-gaps` §12).

---

## 2. Tier 1 — no failing gate (9, down from 12)

Strike / Δ / credit are **Black-Scholes constructions** from each underlying's ATM IV at the
2026-08-31T22:04Z ingest — indicative, check the chain.

| # | Name | Fit | Components | Note |
| --- | --- | --- | --- | --- |
| 1 | **NRG** | **51** | downtrend **29** · IV deflating 6 · cushion 9 · credit 2 · record 4 | new top of list; falling hard |
| 2 | **MSTR** | 41 | downtrend 11 · IV deflating 6 · cushion 7 · credit **7** · record 10 | see §3.2 |
| 3 | SLV | 37 | downtrend 10 · IV deflating 6 · cushion 9 · credit 1 · record 10 | *1 unknown gate* · see §3.1 |
| 4 | GLW | 34 | downtrend 11 · IV deflating 6 · cushion 7 · credit 6 · record 4 | a GLW call is already open, at 88% captured |
| 5 | BSX | 34 | downtrend **21** · IV deflating 0 · cushion 8 · credit 1 · record 4 | new |
| 6 | SPCX | 30 | downtrend 8 · IV deflating 6 · cushion 7 · credit 4 · record 4 | call already open, 78% captured |
| 7 | MCHP | — | — | held from run 1 |
| 8 | TQQQ | — | *1 unknown* | 4 TQQQ legs already open |
| 9 | RDDT | — | *1 unknown* | new |
| — | PAAS · UAL · HOOD · XLI | — | — | remainder of the no-gate-fails set |

Run 1's IONQ, IBIT, AKAM and FISV have dropped out of tier 1.

## 3. Tier 2 — one gate short (8)

PODD · TZA · APTV · HONA · ON · SOXL · EIX, plus the remainder. Unchanged pattern: **ON, SOXL, QCOM**
fail on `SC-B1` (Semiconductors already 42%), **HONA and EIX** on `SC-S2` (1 vs 4 weeklies).

---

## 3. Cross-checks this run forces

### 3.1 · SLV is on the list as a call, and you just sold an SLV put inside 1σ

SLV ranks 3rd in tier 1 for a **77.5 call**, while `SLV P52 ×2` was opened since run 1 at **0.9σ**, and
the previous `SLV C70 ×3` was closed. Selling the call now would create a short strangle on a name where
the put side is already inside the cushion floor and Precious metals is already 17% of credit. Not a
gate breach — worth being a decision rather than a default.

### 3.2 · MSTR is second on the list and holds the joint-tightest leg in the book

Same finding as run 1 §4.2, unchanged: `MSTR P100` sits at **1.0σ** (0.4σ in run 1's reading, now 1.0σ
as spot moved) and MSTR IV is 71%. A call at 1.6σ passes cleanly; the pair is a strangle on the book's
most volatile name.

### 3.3 · Four tier-1 names already carry an open position

GLW, SPCX, TQQQ and SLV all have live legs; TQQQ has **four**. The engine knows — it prints *"no call
already open on this name"* only for names where that is true — but it still does not convert that into
the **contracts-per-name** margin against the 1–2 cap (`SC-E4`). IONQ, which left tier 1 this run,
meanwhile went from 4 to **6 contracts**.

### 3.4 · MRNA is still one gate short, not excluded

Unchanged from run 1 §4.3. Two closed trades, −$10,086, verdict *too few trades*, so `SC-S5` does not
veto it; only `SC-S1` (trend up) stands in the way, and a trend gate is the kind an override argues
past. Under proposal P-2 it would be excluded by class.

---

## 4. What this list cannot tell you

Unchanged from run 1 §5, all still true: strikes/Δ/credits are **inferred** Black-Scholes values with no
skew; IV rank rests on a short history; the Δ×DTE cell economics remain **one-observation dominated**
([`strategy.md`](strategy.md) F-2), so the historical $/trade of a cell is not an expectation; no
candidate is screened for an **unscheduled** catalyst, which is the gap that produced the deficit; and
fit is a transparent preference ranking, not an expected value.

**One thing added this run.** This page has now been demonstrated *not* to be the channel through which
trades arrive. Until a pre-trade check exists ([`strategy.md`](strategy.md) P-6), a candidate list is
the wrong place to enforce an entry rule — it can only offer compliant options, not refuse
non-compliant ones.
