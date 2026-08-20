# Short-call strategy (naked calls, all-cash) — formal spec

**Version 1.1 · 2026-08-19 · status: active.** This is the authoritative, evolvable
specification of the **short-call program**: what to sell, when, how big, how to manage
it, and how success is judged. The Chinese原文 of the wider doctrine (including the
panic-put pivot) is **[strategy.md](strategy.md)**; § 五 there is the same rule set in
summary form. Where the two disagree, **this file wins for short calls**.

Live instrumentation:

| Question | Page | Engine |
| --- | --- | --- |
| What am I exposed to right now? | **`/risk`** | `src/lib/bookrisk.ts` |
| Did it work, per target, and why? | **`/short-call`** | `src/lib/shortcall.ts` |
| What happened to each position, including its rolls? | **`/short-call/lifecycle`** | `src/lib/sc-lifecycle.ts` |
| What did the losses cost, and which were avoidable? | **`/short-call/losses`** | `src/lib/sc-loss.ts` |
| What do I do with what I hold? | **`/short-call/actions`** | `src/lib/sc-actions.ts` |
| What should I sell next? | **`/short-call/candidates`** | `src/lib/sc-candidates.ts` |
| How has it behaved week by week? | **`/short-call/weekly`** | `src/lib/sc-timeline.ts` |
| Which categories pay? | **`/short-call/cohorts`** | `src/lib/shortcall.ts` |
| What are the rules, and what did each revision change? | **`/short-call/strategy`** | `src/lib/sc-rules.ts` |
| Where do candidates come from? | `/` (Naked Call), `/watchlists` (NC, NCcan, HIV*, LEV) | `src/lib/securities.ts`, `watchlists.ts` |
| Model-picked Δ0.30 targets (separate research track) | — | `docs/cc-target-strategy.md` |

**The rules in this document are mirrored in code** as a versioned registry
(`src/lib/sc-rules.ts`): every rule has an id (`SC-E3`, `SC-M1`, …) that the pages cite, and
every version here has a matching entry there. `npm run check` fails if the two disagree.
Each trade is stamped with the version in force on its **open date**, so history is judged by
the rules that existed at the time — see `/short-call/strategy`.

---

## 1. Purpose and edge

Sell **naked call options** on names that are not going up, and collect the premium.
The account stays **100% cash / cash-equivalent**: no underlying is ever held, so there
is no beta exposure to defend and cash is always free to redeploy.

Three sources of edge, in the order they matter:

1. **Direction filter** — a call sold on a name that does not rise cannot be assigned.
   The trend screen is the primary defence; the strike is only the second.
2. **Variance risk premium** — implied vol is usually sold above realised vol; that gap
   is the structural income.
3. **Time decay (Θ)** — accelerates in the last ~6 weeks, which is what sets the entry
   window.

Explicitly **not** an edge: being right about individual names. The program is a
portfolio of many small, independent bets and is judged as one book (§ 6).

## 2. Universe and target selection

A candidate must satisfy **all** of:

| # | Rule | Where it is enforced |
| --- | --- | --- |
| 2.1 | **Not rising** — 1M/3M/6M trend must not be "up" (grinding down / sideways-weak preferred) | NC screen (`isNcTarget`), `/risk` "short calls on rising names" flag |
| 2.2 | **Liquid weekly option ladder** — ≥4 near-term weekly expiries (`NC_MIN_WEEKLY_BUCKETS`) | NC screen |
| 2.3 | **Rich IV** — front-month ATM IV > `NC_IV_MIN` (40%); the HIV lists use > 50% | NC / HIV lists |
| 2.4 | **Tradable price band** — roughly $20–180 so a 1-contract position is a sane size | NC screen |
| 2.5 | **Own record is not negative** — a name the record says to avoid (§ 6.3) is out until it is re-earned | `/short-call` per-target verdict |
| 2.6 | **No earnings inside the option's life** for single stocks, unless deliberately sized down | `/risk` earnings flag |

Preferred, not required: **IV that has started to deflate** (IV rank high but falling) —
short vega then works with theta instead of against it. Leveraged long ETFs (`LEV`
list) carry the richest premium and the fastest decay of the underlying, and are
acceptable targets; **inverse/short ETFs are not** (selling calls on a −3x fund is a
bullish index bet).

## 3. Entry

| Parameter | Rule | Rationale |
| --- | --- | --- |
| DTE | **35–45 days** default; **21–90 allowed at \|Δ\| ≤ 0.20**; **21–34 only for Δ0.20–0.30**; never > 90 | the Θ curve's sweet spot, tightened by the expiry × delta grid (§ 6.5) |
| Delta | **\|Δ\| ≈ 0.15**, hard cap **0.25** (and only short-dated above 0.20) | the record shows the edge lives at ≤0.20, and at 0.20–0.30 only inside 34 days (§ 6.4–6.5) |
| Cushion | **strike ≥ 1.5 expected moves away**: `(K−S)/S ÷ (IV·√(DTE/365)) ≥ 1.5` | %OTM is not comparable across names — 30% OTM on a 130-IV ETF is thinner than 12% OTM on a 43-IV miner |
| Size | **1–2 contracts per name**, and no single name > ~5% of open credit | no trade may matter |
| Diversification | **≥20 effective names** and **≥6 effective themes** (1/HHI on credit) | themes, not sectors: SOXX/SOXL/TSM are one bet |
| Direction balance | short calls are the program; short puts are a **separate** book (panic pivot) and must not silently dominate the credit | `/risk` "by side" |
| Buying power | keep **≥50% of NLV unused** — the panic-put pivot needs dry powder | `/risk` margin KPI |

## 4. Management

The old rule (strategy.md § 二) was a mechanical stop at 2–2.5× the credit with **no
rolling**. Live practice replaced it with delta-based management; both the stop and the
roll are legitimate, but the choice must be made by rule, not by mood:

1. **Harvest at 70%** of the credit (`HARVEST_CAPTURED`). At ≤14 DTE, 50% is enough. The
   last 20% of a premium pays a few dollars a day and carries the whole gamma.
2. **Let it expire** only when the buy-back costs ≤10% of the credit and ≤14 DTE remain.
3. **Roll out-and-away for credit** when the position drifts: **\|Δ\| > 0.30**, or spot
   within 5% of the strike, or **< 0.75σ of cushion with ≤30 DTE**. Conditions:
   * the new expiry must land **inside 365 days** and leave ≥30 days of room;
   * the roll must be **credit-positive**;
   * roll **up** as well as out — same strike further out is not a defence.
4. **Give up at \|Δ\| > 0.45 or ITM**: close. Rolling a broken position just re-books the
   same bad trade at a worse price.
5. **Never** roll a position that fails § 2.1 today (the name is now rising) — close it
   and re-deploy into a name that still passes the filter.

## 5. What gets recorded (the audit trail)

For every trade the record reconstructs, from IB fills plus our daily bars:

* **at the sale** — premium, underlying spot, %OTM, **implied vol and Δ implied by the
  fill price** (Black-Scholes inverted, `lib/blackscholes.ts`), DTE, cushion in σ;
* **while it is on** — the highest high the underlying printed (did it ever reach the
  strike, and by how much);
* **at the close** — buy-back price, spot, %OTM, IV and Δ, IV change vs entry, hold days;
* **outcome** — realized cash net of commission, credit kept %, and one **reason**:

| Reason | Definition | Reading |
| --- | --- | --- |
| Thesis worked | won, strike never reached, underlying flat/down | the program working as designed |
| Cushion held | won, underlying rallied but never reached the strike | Δ/OTM discipline paid |
| Escaped a breach | won although price traded through the strike | got lucky (IV crush / reversal) — count it as a near-miss, not skill |
| Trend was wrong | lost, price traded through the strike | § 2.1 failed at selection |
| Vol expansion | lost while still OTM, IV higher at exit | short vega bit; entry IV was too low |
| Management cost | lost while still OTM, IV flat/lower | paid to exit or roll early — a discipline cost, not a market loss |

IB does not expose greeks for a historical execution, so Δ/IV at the fill are **model
values**. A print that disagrees with that day's bar (stale bar, split, off-hours fill)
is left blank rather than guessed.

## 6. Success criteria

### 6.1 The program, not the trade
The target is **credit kept ≥ 30%** of premium sold, with a win rate ≥ 70%. Individual
losses up to ~2× the credit of a single position are expected and acceptable.

### 6.2 Hard limits (breach = stop opening, fix the book first)
* Any theme > 25% of open credit, or effective themes < 6.
* Maintenance margin > 60% of NLV (see `/risk`; the raw figure is a floor until a Deep
  sync prices every leg).
* More than 15% of open legs inside 1σ of their strike.
* Short-put credit exceeding short-call credit (the program has inverted into a long book).

### 6.3 Per-target verdicts (`/short-call`)
Applied once a name has ≥3 closed trades:
* **Keep selling** — net positive, breach rate < 34%, worst loss below the average credit.
* **Size down** — net positive but breach rate ≥ 34% *or* one loss bigger than the
  average credit: one contract only.
* **Stop selling** — net negative. Removed from the candidate list until the reason is
  understood (usually § 2.1: the name was never actually weak).

### 6.4 Evidence as of 2026-08-19 (189 closed short calls, $42,884 credit)

> **Stale, and kept deliberately.** These are the numbers that *caused* the v1.0/v1.1 rule
> changes, frozen at the date they were read. The live figures have since moved sharply — as
> of 2026-08-20 the record is 193 closed contracts / 147 closed chains and net realized is
> **−$10,113**, because a single MRNA chain (credit $678, opened 2026-07-22, closed
> 2026-08-19) lost **$10,086 — 14.9× its credit**, far outside the ~2× §6.1 calls acceptable.
> One position therefore flips the program's headline from positive to negative, and the
> exit-cohort split below understates the leak: chain-wise, bought-back positions are
> −$21,112 at a 42% win rate against +$10,789 and ~93% for those left to expire.
> **For current numbers read `/short-call` and its section pages, not this table.**

The record is what re-wrote the entry rules; these are the live numbers behind § 3:

| Δ at sale | Trades | Realized | Win rate | Credit kept | Strike reached |
| --- | --- | --- | --- | --- | --- |
| < 0.10 | 6 | +$189 | 83% | 58% | 0% |
| **0.10–0.20** | **52** | **+$3,350** | **79%** | **44%** | **6%** |
| 0.20–0.30 | 100 | −$407 | 58% | −2% | 23% |
| > 0.30 | 30 | −$1,618 | 47% | −17% | 50% |

| Cushion at sale | Trades | Realized | Win rate | Credit kept |
| --- | --- | --- | --- | --- |
| < 1σ | 110 | −$2,127 | 55% | −7% |
| 1–1.5σ | 60 | +$2,393 | 70% | 20% |
| ≥ 1.5σ | 17 | +$877 | 88% | 73% |

| Exit | Trades | Realized | Win rate | Credit kept |
| --- | --- | --- | --- | --- |
| Expired worthless | 69 | +$11,480 | 99% | 97% |
| Bought back | 120 | −$9,850 | 43% | −32% |

Conclusions carried into the rules above: **the whole edge sits at Δ ≤ 0.20 with ≥1σ of
cushion**; trades held to expiry pay while buy-backs (stop-outs and rolls) are where the
money leaks; and holds under 7 days are the worst cohort of all (−$5,378 over 21 trades)
— i.e. panic exits, not the market, did the damage.

### 6.5 The profitable zone — expiry × delta (as of 2026-08-19)

Both axes are chosen at entry, so the 2-D grid (`/short-call` → *Profitable zone*) is the
map that matters. Realized **per trade**, trade count in brackets; a zone must hold ≥12
trades and may not contain a cell with fewer than 3:

| DTE at sale ↓ / Δ → | < 0.10 | 0.10–0.20 | 0.20–0.30 | > 0.30 |
| --- | --- | --- | --- | --- |
| < 21d | −$6 (4) | +$18 (1) | −$101 (2) | +$79 (5) |
| **21–34d** | — | **+$98 (7)** | **+$120 (24)** | −$100 (7) |
| 35–45d | — | +$19 (24) | +$2 (61) | −$30 (12) |
| 46–90d | +$107 (2) | **+$109 (20)** | −$146 (10) | +$204 (3) |
| > 90d | — | — | −$582 (3) | −$523 (3) |

* **Best envelope: 21–34 DTE at Δ0.20–0.30** — 24 trades, +$2,886 (+$120/trade), 71% win,
  60% of credit kept, 17% reached the strike.
* **Worst envelope: 46–365 DTE at Δ0.20–0.30** — 13 trades, −$3,202 (−$246/trade), 31%
  win, −79% of credit.

The same delta band is the best and the worst cell in the grid depending on **expiry**:
at Δ0.20–0.30 the trade works when it expires inside ~5 weeks and is ruinous when the
underlying is given 46+ days to find the strike. Δ ≤ 0.20 pays at every expiry tested.
Hence the refined entry envelope (§ 3):

| Δ at sale | Allowed DTE | Note |
| --- | --- | --- |
| ≤ 0.20 | 21–90 | the core of the program; 35–45 remains the default for theta efficiency |
| 0.20–0.30 | **21–34 only** | acceptable when premium is rich, but it must be a short-dated sale |
| > 0.30 | none | −$1,618 over 30 trades, 50% breach |
| any | **> 90 days: never** | 6 trades, −$3,317, 0% win — the far-dated rolls |

## 7. Open questions / next experiments

1. **Is the 35–45 DTE window right?** Partly answered by § 6.5: 35–45 is *safe* but flat
   (+$2/trade at Δ0.20–0.30, +$19 at Δ≤0.20), while 21–34 is the strongest row and 46–90
   pays only at Δ ≤ 0.20. Both are confounded by exit behaviour — re-test after the
   harvest rule (§ 4.1) has been applied consistently for a quarter, and check whether
   21–34 keeps its edge once buy-backs are disciplined.
2. **Rolls: do they ever beat closing?** Tag rolled chains explicitly (`buildRolls`
   exists in `lib/pnl.ts`) and compare roll chains against "close and re-sell fresh".
3. **Entry IV percentile.** We use absolute IV; test IV **rank** (`ivStats`) as the gate
   instead, and whether "IV rank high **and** falling" beats "IV high".
4. **Live greeks at fill time.** Δ/IV at entry are reconstructed. Persisting the daily
   per-contract greek snapshot the extension already fetches would give measured entry
   deltas going forward.
5. **Stop rule.** The 2–2.5× credit stop was dropped in practice. Backtest it against
   the delta-based roll on this record before deciding which one is doctrine.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-08-19 | First formal spec. Codifies live practice (35–45 DTE, Δ0.15, roll-inside-1-year, harvest at 70%) and adds the cushion-in-σ rule, the per-target verdict loop, and the § 6.4 evidence that the edge lives at Δ ≤ 0.20. Supersedes the Δ0.30 + hard-stop rules in strategy.md § 二 for short calls. |
| 1.1 | 2026-08-19 | Added the **expiry × delta zone map** (§ 6.5) and tightened § 3: Δ ≤ 0.20 may be sold 21–90 DTE, Δ0.20–0.30 only 21–34 DTE, nothing beyond 90 days. Same delta band is the best and worst cell in the grid depending on expiry. |
