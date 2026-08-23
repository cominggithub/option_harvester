# Strategy session — 2026-08-23 · three-books split and the exit-finding correction

**Saved:** 2026-08-23T11:50+08:00 · **HEAD:** `2561db0` · **Rules version:** `1.2`
· **Record at save:** 201 closed legs / 155 closed chains, realized **−$7,069** (legs) /
−$7,392 (chains), 46 open chains holding $154,288 of credit — `npm run reconcile:sc`,
2026-08-23.

> Every number here is a **snapshot**. Re-measure before quoting: `npm run reconcile:sc`, or
> the `/md/*.md` mirrors of `/risk`, `/short-call`, `/short-call/losses`. The record moved
> +$3,044 in the two days before this save, so assume it has moved again.

## 1. What this session was about

Whether the program's headline diagnosis was even right ("the money is lost at the exit"), and
then giving the account's three different intents three different rule sets so the analysis
stops judging one book by another's criteria.

## 2. Measured this session

| Finding | Number | n | Source | Date |
| --- | --- | --- | --- | --- |
| Buy-backs that a rule **required** (Δ>0.30 at close or ITM) | −$31,359 | 71 of 124 buy-backs | `exitAudit`, `/risk` brief | 2026-08-21 |
| Buy-backs that were **discretionary** (inside the roll line, <70% captured) | **+$446** | 10 | same | 2026-08-21 |
| Harvests at ≥70% of credit | +$9,320 | 43 | same | 2026-08-21 |
| Entry state of the forced exits | avg **0.83σ** cushion, avg Δ **0.26**, 71/71 under the 1.5σ floor | 71 | same | 2026-08-21 |
| Worst single chain (MRNA) | −$10,086 = **14.9× credit**, 98% of the then-deficit | 1 | `reconcile:sc` | 2026-08-21 |
| Account margin / cushion | maintenance **78% of NLV**, excess liquidity $17,247 = **13%** | — | IB balances | 2026-08-21 |
| Acquisition book delivery promise | **$109,400** vs $117,581 settled cash (93%); GDX 57% of cash alone | 10 contracts | `buildAcquisitionBook` | 2026-08-23 |
| Vol regime across sellable names | 219 IV falling / 395 rising; **4** rich *and* deflating | 625 | `ivStats.chg5` | 2026-08-21 |

## 3. Open threads

| # | Hypothesis | Test | n needed | Blocked by |
| --- | --- | --- | --- | --- |
| 1 | A hard per-chain loss cap (2–2.5× credit) beats the delta roll on this record | Path-revalue every closed chain's option mark daily, simulate the stop, compare | all 155 chains | `system-gaps.md` §4 — we store underlying bars, not option marks, so the path must be modelled and inherits §1's reconstruction error |
| 2 | The cushion floor is the gate that separates forced exits from harvests | Recompute the forced/harvest split on trades opened **under v1.1+** | 12 closed under v1.1 | Nothing closed under v1.1 yet — the record is entirely v0.1 |
| 3 | IV **rank** gates better than absolute IV | Cohort by entry IV rank vs entry IV, once rank has a year of history | 12 per bucket | `system-gaps.md` §12 — only 63 days of IV history |
| 4 | Rolls beat closing when credit-positive and out-and-up | Compare the 38 rolled chains against a close-and-resell counterfactual | 12 good rolls | Roll linkage is a heuristic; 4 of 38 chains rest on a `guess` link |
| 5 | Acquisition puts achieve a better basis than buying at the market | For each assignment, price 1/3/6 months later vs basis paid | first assignments | Nothing assigned yet — `acquisition-puts.md` §7.1 |

## 4. Rejected — do not re-propose without new data

| Idea | Why it was killed | Evidence |
| --- | --- | --- |
| "Stop buying back — the exit is the leak" | Cohort selection effect, not causation: you buy back *because* the position moved against you. Re-cut at the moment of closing, 71 of 124 buy-backs were mandated and the 10 discretionary ones **made** money | `exitAudit`, 2026-08-21; pinned by `riskbrief-check` |
| "The put-heavy book means the program has inverted" (as applied to GDX/SOXX) | Those puts are a declared acquisition book: being long is the plan. `SC-B4` now counts premium puts only | `acquisition-puts.md` v1.0; spec v1.2 |
| Held-to-expiry counterfactual as a verdict on exits | It prices neither the assignment it avoided nor the buying power holding would have consumed — at 78% of NLV committed that is not academic. Kept as a **bound** | `system-gaps.md` §3 |

## 5. Doctrine changes proposed or landed

* **`short-call-strategy.md` v1.2** (landed, `2561db0`+): scope is short-calls-only; §1's
  "no underlying is ever held" amended — the account will hold stock by design, so cash is not
  all free and a call on an assigned name is covered, not naked. `SC-B4` excludes declared
  acquisition puts. Registry `SC_VERSIONS` bumped to match (`sc-rules-check` enforces it).
* **`acquisition-puts.md` v1.0** (landed): the third book. GDX and SOXX declared. Judged on
  effective basis and funding, not delta/cushion; AP-4 caps delivery at 40% of cash per name
  and 80% for the book; rolling to avoid assignment is forbidden.
* **`system-gaps.md`** (living): 13 entries. §1 reconstructed greeks, §3 counterfactual limits
  and §4 the missing loss-cap backtest are the ones blocking thread 1.

## 6. Next actions, in order

1. **Free margin before anything else.** Maintenance is 78% of NLV against a 60% limit with a
   13% cushion, and all five §6.2 gates fail — the candidate list is explicitly for *after*
   that. Harvest the ≥70% winners, close the legs inside 1σ.
2. **Decide the GDX delivery cap.** $67,400 is 57% of settled cash against a 40% name cap:
   either reduce contracts or raise the cap deliberately in `acqputs.ts` and say why.
3. **Ring-fence the acquisition cash** (`acquisition-puts.md` §7.3). Nothing stops the premium
   book using it as margin; the honest fix is a reserved-cash figure the margin KPI subtracts.
4. Then thread 2 — it needs no new machinery, only trades closed under v1.1+.

## 7. What I could not verify, and why

Standing limits are in [../system-gaps.md](../system-gaps.md); cite the section rather than
repeating it. Newly unverifiable this session:

* **The 71/10 split rests on reconstructed exit deltas** (§1). One buy-back had no recoverable
  exit delta and is in neither bucket; the accuracy of the other 123 is unmeasured.
* **Nothing has closed under v1.1**, so no revision in this program has yet been validated on
  its own trades — every compliance statement is a counterfactual (§5).
* **The acquisition book has no outcome yet.** Its basis numbers are promises, not results.
