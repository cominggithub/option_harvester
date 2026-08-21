# System insufficiencies — what this instrument cannot yet tell you

**Status: living document. Last reviewed 2026-08-21.** Every entry is a limitation of the
*system*, not of the market: something the pages assert, imply, or silently omit that the
data does not actually support. Ordered by how much a wrong decision it can cause.

Why this file exists: on 2026-08-21 the `/risk` brief asserted "the money is lost at the
exit, not the entry" from a cohort comparison — bought-back chains −$21,112 against expired
+$10,550. That is a **selection effect**: a position is bought back *because* it moved
against you and left to expire *because* it did not. Re-cut by the state at the moment of
closing, 71 of 124 buy-backs were **mandated** (|Δ| past 0.30 or already ITM) and carried
−$31,359, while only 10 were discretionary — and those made +$446. The exit was the
defence; the entry was the error (those 71 averaged 0.83σ of cushion against a 1.5σ floor,
and *all* of them were sold inside it). The finding was inverted, it survived review, and it
would have led to "stop buying back" — the one discipline that was working. That is the
class of defect this document is for.

---

## 1. Greeks are reconstructed, not measured — and that is load-bearing

**What is asserted.** Every Δ and IV *at the moment of a fill* — entry and exit — on
`/short-call`, its cohorts, the Δ×DTE zone grid, the per-target verdicts, and now the exit
audit in the `/risk` brief.

**What is true.** IB exposes no greeks for a historical execution, so `lib/blackscholes.ts`
inverts Black-Scholes on the **traded price** against that **day's closing bar**. The known
error sources, none of which are currently quantified:

- **Intraday mismatch.** The fill happened at some intraday spot; the model uses the close.
  On a high-range day this alone can move Δ by several points.
- **No skew.** A single ATM-ish IV is inverted per contract, so a far-OTM call's delta
  inherits the wrong part of the smile.
- **Fixed rate, no dividends.** r = 4% constant; dividends ignored. Small for short-dated
  calls, not zero for the 90–365 day tail.
- **Unusable prints are dropped, not flagged loudly.** A price below intrinsic or above the
  ceiling yields `null`. Live: entry Δ recoverable on 192 of 193 closed trades, exit Δ on
  123 of 124 buy-backs — good coverage, but the *accuracy* of the 123 is unmeasured.

**Why it matters.** The whole entry envelope (§3, §6.5) is keyed on entry Δ, and the exit
audit is keyed on exit Δ. A systematic bias in the inversion would move the boundaries of
the zone map without anyone seeing it.

**Fix.** Persist the daily per-contract greek snapshot the extension already fetches
(spec §7.4), then backfill *measured* Δ alongside the reconstructed one and report the
disagreement distribution. The live-book equivalent already exists — `lib/greekage.ts`
scores measurement age and cross-checks against a mark-implied delta — so the pattern is
proven; it is the historical side that is missing.

## 2. Cohort comparisons are reported without their selection effect

**What is asserted.** Anywhere two outcome-defined groups are compared: bought-back vs
expired, breached vs not, rolled vs not, win vs loss.

**What is true.** Selection into these groups is caused by the price path, which is also
what determines the P/L. Only a comparison across a variable **chosen at entry** (Δ, DTE,
cushion, theme, instrument class) supports a causal reading; the entry-keyed cohorts on
`/short-call/cohorts` are sound, the exit-keyed ones are not.

**Fix.** The brief now labels the split explicitly and re-cuts exits by *state at close*.
Still to do: mark exit-keyed cohorts on `/short-call/cohorts` and `/short-call` with the
same caveat, and add the entry-keyed control (same Δ/σ bucket, held to expiry vs closed) as
the only fair version of the question.

## 3. Counterfactuals price neither assignment nor margin

**What is asserted.** "Held to expiry this would have been −$3,537 instead of −$7,106."

**What is true.** The counterfactual re-prices the option at expiry from daily bars. It
ignores (a) that an ITM short call may be **assigned early**, which is a stock position and
a different margin regime; (b) that holding consumes **buying power** for the whole period —
material when the account is at 78% of NLV committed and a 13% cushion; and (c) path
sequencing: a position that would have recovered may have been force-liquidated first.

**Fix.** Report the counterfactual as a bound, not a verdict (done in the brief), and add a
margin-aware version: hold-to-expiry P/L **minus** the cost of the buying power it locked
up, at the observed utilisation.

## 4. No loss cap exists in the doctrine, and the record cannot yet test one

Live: MRNA lost 14.9× its credit — 98% of the program's net deficit — against a §6.1
tolerance of ~2×. The mechanical 2–2.5× stop was dropped in practice (§7.5) and nothing
replaced it: the give-up line is a *delta*, and a gap crosses a delta and keeps going.

**What is missing to fix it properly.** A path-revalued backtest: for each closed chain,
the option's mark on every day it was open, so a "stop at 2× credit" can be simulated
honestly. We only store the underlying's daily bars, so the option's path has to be modelled
(Black-Scholes on reconstructed IV) — which inherits §1's error, on a rule whose whole
purpose is tail control. **Consequence: the most consequential open question in the program
cannot currently be answered to the standard the rest of the record is held to.**

## 5. Compliance is unmeasurable: every closed chain is pre-spec

All 147 closed chains are stamped `v0.1`. The pages therefore report the current envelope as
a *counterfactual* ("today's rules would have refused to open 50 of the 50 losing chains"),
never as a compliance rate — correct, but it means **no revision has yet been validated on
its own trades**. The `n` needed is 12 closed trades per cohort under v1.1.

## 6. Margin is measured two ways and only one is the truth

`bookrisk` sums per-leg IB what-ifs, which cover 60% of legs, and extrapolates the rest —
that read 73% of NLV while IB's own account requirement was 78%. The gate and the KPI now
prefer the account figure, but **book attribution** (how much of the requirement this
program is responsible for, versus the long LEAPs and the put book) is still an estimate.

**Fix.** Run a Deep sync to price every leg, then reconcile Σ per-leg against the account
figure and report the residual as the un-attributed remainder instead of scaling.

## 7. The long book is invisible to the risk page

`/risk` analyses short legs inside 365 days. The account also holds 2 long LEAP calls whose
share-equivalent delta (+841 on SLV alone, ≈$52k of notional) is the **largest single
directional exposure in the account**, and it appears in no risk view — it is excluded as a
"long leg". Net-of-LEAP the book is roughly delta-flat; with it, decisively long.

**Fix.** Report excluded positions' delta and margin contribution in "Outside this analysis"
rather than only their count.

## 8. Time is not a diversification axis anywhere in the doctrine

§6.2 caps theme and name concentration; nothing caps *calendar* concentration. Live, 97% of
the book's daily decay expires within eight weeks, five consecutive weeks hold 34 of 52
legs, and one week (18 Dec) holds 27% of open credit. The brief now flags the cliff
(`R-CLIFF`), but there is no rule to breach.

**Fix.** Propose a limit — no week above ~20% of open credit, and a minimum number of
effective expiry weeks (1/HHI over credit by week) — then test it against the record.

## 9. Gamma tracks contract count, and nothing watches contract count

The 2 Oct week carries −141 of gamma, 44% of the book's total, from TTD ×12, YINN ×6 and
NVDL ×4 — multi-contract positions on low-priced, high-vol names. §3 says 1–2 contracts per
name; the page shows credit and delta per leg but never contracts per name against that
limit.

**Fix.** Surface contracts-per-name as a gate on `/risk` and in the candidate stack.

## 10. Data freshness is reported, but staleness does not gate the conclusions

The brief prints its inputs' ages (IB balances, ingest, margin coverage, stale-delta count)
and lists what it could not see. It still draws σ-cushion and Δ-band conclusions from legs
whose delta measurement is up to two days old, without widening or suppressing them.

**Fix.** Degrade findings that depend on a stale input — state the age inline, or omit the
finding when coverage drops below a floor.

## 11. Unauthenticated write routes on a public port

`/api/positions`, `sync-log`, `ext-log`, `balances`, `watchlist` and the rest accept writes
with no authentication, and production listens outside the NAT. Anything reachable can
inject positions or balances — which would silently corrupt every number in this document's
subject matter. Known, unfixed, and worth fixing for all routes at once.

## 12. Single regime, overlapping windows, survivorship

~14 months, one risk-on churny regime; heavily overlapping option lives, so far fewer
independent samples than rows; current S&P constituents only. Every cohort conclusion
inherits this and the pages say so, but no number here has been tested out of sample.

---

## How to use this list

- A page may not assert something on this list without the caveat attached. If the caveat
  makes the claim useless, the claim should not be made.
- `npm run check` is where a fix gets pinned: a defect that could recur silently needs an
  assertion, not a comment. The exit-audit inversion above is now pinned by
  `scripts/riskbrief-check.ts` ("the finding no longer claims the loss happens AT the exit",
  "no exit claim is made when no leg-level exit data was supplied").
- Ordering is by decision impact, and it is expected to change. Items 1, 3 and 4 are the
  ones currently blocking a real answer to "should the program keep buying back?".
