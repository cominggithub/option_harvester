# CC Target-Selection Strategy & Backtest

> **Scope.** How `option_harvester` should *find the names to sell calls against* for
> the premium-harvest game in [`strategy.md`](./strategy.md). This page defines the
> selection funnel, the data behind each gate, a worked answer to "delta 0.30 = 30%
> chance — how do we find names *far below* that?", and a backtest against our own
> daily history that says how much of this we can actually prove today.
>
> Companion artifacts: [`scripts/backtest-cc.py`](../scripts/backtest-cc.py)
> (historical test) and [`scripts/iv-rv-screen.py`](../scripts/iv-rv-screen.py)
> (live IV/RV target screen). Both read `option_harvest_daily_prices`.

---

## 1. The core bet, stated precisely

The doctrine (`strategy.md` §二) sells a **Delta-0.30 call, ~30–45 DTE**, on a
weak/陰跌 name, then mechanically **buys to close at a 2.0–2.5× premium stop** — no
rolling. So each trade has exactly two outcomes:

- **Win (~keep premium):** the call decays; the stop is never hit. Theta + vol-crush bank the rent.
- **Loss (−1× premium):** a momentum pop hits the stop; we close for ~1× premium and blacklist the name.

**What "Delta 0.30" means.** Delta ≈ the option's *probability of finishing
in-the-money* (being assigned). It is a **risk-neutral, hold-to-expiry** number,
and it slightly *over*states the true ITM probability — the exact figure is
`N(d2)`, which runs a few points below the delta `N(d1)`. So a delta-0.30 call
finishes ITM ≈ **25–30%** of the time *if the stock is a driftless coin flip
priced at its own volatility*. Our edge is making the **realized** rate land
well below that.

Two distinct risk events follow from the doctrine, and the selection strategy
must respect both:

| Event | Definition | Driven by |
|-------|-----------|-----------|
| **Assignment** | close > strike at expiry | hold-to-expiry tail |
| **Stop hit** | option mark reaches 2.5× entry premium *intra-life* | any sharp pop, even if it later fades |

The stop is the one that actually bleeds us in churny markets — it triggers on the
*path*, not the endpoint. A name can finish OTM (no assignment) yet still have
spiked through the stop on the way. **The backtest below shows the stop, not
assignment, is the binding constraint.**

---

## 2. Data we have, and the one gap that matters

| Field | Source | Used for |
|-------|--------|----------|
| Daily OHLCV, ~14 mo / ticker | `option_harvest_daily_prices` (our own pull) | trend, realized vol, backtest paths |
| Multi-window trend (1M/3M/6M/1Y, OLS label) | `option_harvest_trends.windows` | the 陰跌 / downtrend gate |
| Front-month ATM **IV%** (snapshot) | `option_harvest_quotes.iv_pct` (BS-inverted, `scripts/iv.ts`) | premium richness, IV/RV |
| Weekly expiry coverage `weekly_buckets` (0–6) | `quotes.weekly_buckets` | option liquidity / manageability |
| Price, market cap, $-volume | `quotes` | liquidity factor, $20–150 sweet spot |

**The gap: we have no *historical* IV — only today's snapshot.** That single fact
shapes everything below. It means a backtest cannot see the strategy's *primary*
profit engine (selling IV that is richer than realized vol). It also means the fix
is mechanical: **we already snapshot `iv_pct` daily, so every ingest from now on
accumulates an IV time series** — in a few months a true premium-aware backtest
becomes possible. Until then we test the *price-action* half and reason about the
rest.

Things we can additionally obtain cheaply when we want them: option **delta/strike
grids** (extend `scripts/iv.ts` to solve the delta-0.30 strike per name), **earnings
dates** (yahoo-finance2 `quoteSummary` → gap-risk filter), and **sector ETF betas**
(for the diversification gate).

---

## 3. The selection funnel

Each gate removes a *specific* way the trade loses. Order matters — cheapest/most
decisive filters first.

```
universe ──▶ trend gate ──▶ IV/RV gate ──▶ liquidity gate ──▶ event gate ──▶ diversify
(ETF first; (陰跌 / no     (overpriced   (weekly_buckets,  (no earnings   (20–30 low-
 stocks as   upward         vol: IV ≫     $-vol, price      inside DTE;     correlation
 extension)  momentum)      RV)           $20–150)          ETF≫stock)      names)
```

1. **Universe.** Doctrine is **ETF-only** — "拒絕個股跳空風險" (reject single-stock
   gap risk). Single stocks carry earnings/headline gaps that blow through the
   2.5× stop *before* you can act. Your request to include **stocks** is a
   deliberate extension; §6 quantifies the gap cost. Treat stocks as a *separate,
   gap-screened* bucket, not mixed into the ETF basket.
2. **Trend gate — negative drift.** A short call wins when the name does *not*
   rally. We want 陰跌 (grinding down / no upward momentum): `y1 = down`, **or**
   `3M & 6M both down`. This is the existing `isDowntrend` / `isWeak` logic in
   [`securities.ts`](../src/lib/securities.ts). Pushes real-world drift `μ < 0`.
3. **IV/RV gate — overpriced volatility (the big lever, see §4).** Sell when
   implied vol is rich versus the stock's *own* realized vol. High IV/RV places
   the delta-0.30 strike **further OTM than the stock actually moves**.
4. **Liquidity gate.** `weekly_buckets ≥ 4`, healthy $-volume, and the doctrine's
   $20–150 price band — so you can enter, set the stop, and exit on spread.
5. **Event gate.** No earnings/known catalyst inside the DTE window (gap risk).
   ETFs largely pass this for free; stocks need an explicit earnings-date check.
6. **Diversify.** 20–30 low-correlation weak names so the per-trade expectancy
   (§6) compounds by the law of large numbers instead of being held hostage to one
   pop.

---

## 4. "Delta 0.30 ⇒ ~30% — how do we get *far below* it?"

You read it right: **delta 0.30 ≈ a 30% chance of assignment.** That 30% assumes
the stock drifts at the risk-free rate and is priced *at its own volatility*. Two
selection levers bend the realized number down:

**Lever A — negative drift (the trend gate).** Risk-neutral pricing assumes
drift = r. A downtrending name has real drift `μ < 0`, so it is less likely to
reach an up-strike. *Empirically modest* (§6): ~31% → ~27%.

**Lever B — IV/RV > 1 (the volatility-mispricing lever).** This is the strong one.
The strike is set from **implied** vol, but the stock *moves* at its **realized**
vol. When `IV/RV > 1`, the delta-0.30 strike sits further away than the stock's
real movement justifies. The real-world finish-ITM probability is approximately:

```
P_ITM ≈ N( Z30·(IV/RV)  −  (R+½·IV²)·T/(RV·√T)  +  (μ−½·RV²)·T/(RV·√T) )
        └ dominant term ┘   └─ pricing drag ─┘     └── real drift ──┘
  where Z30 = Φ⁻¹(0.30) = −0.524,  T = DTE/365
```

The dominant term is **`Z30 · (IV/RV)`** — the assignment odds fall as IV/RV rises:

| IV/RV | dominant term `N(Z30·IV/RV)` | with pricing+driftless drag (35 DTE) |
|------:|:---------------------------:|:-----------------------------------:|
| 1.0 | 30% (baseline) | ~26% |
| 1.3 | 25% | ~19% |
| **1.5** | **22%** | **~15%** |
| 1.8 | 17% | ~11% |

**Worked example — NKE, from today's screen** (IV 54.8%, RV 35.5% → IV/RV 1.54,
`down` on 1Y/6M/3M): the delta-0.30 call strikes **≈ +11% OTM**, but NKE's realized
vol only spreads it **±11% over 35 days**, and its drift is negative. Plugging in:
**realized P_ITM ≈ 15%** — *half* the 30% the delta nominally implies. Stack a
genuinely negative drift on top and it dips toward ~12%.

**So "find names far below 30%" = `high IV/RV` ∩ `negative drift`.** That is exactly
what [`scripts/iv-rv-screen.py`](../scripts/iv-rv-screen.py) ranks. Live output
(downtrend names, top by IV/RV; median IV/RV across 161 downtrend names = **1.12**):

```
tk    name                 typ      IV%   RV%  IV/RV  wk  y1       m3
NWS   News Corp (Class B)  stock   93.8  28.0   3.36   1  down     up        (earnings-spike, wk=1 → skip)
WBD   Warner Bros Discovry stock   43.5  16.9   2.58   4  up       down
NFLX  Netflix              stock   44.4  22.4   1.98   4  down     down
PSKY  Paramount Skydance   stock   60.0  34.3   1.75   4  down     sideways
VST   Vistra Corp.         stock   83.5  50.2   1.66   4  down     sideways
NKE   Nike                 stock   54.8  35.5   1.54   4  down     down      ← worked example
DXCM  Dexcom               stock   51.9  34.6   1.50   4  down     up
BKNG  Booking Holdings     stock   47.1  31.5   1.50   4  down     sideways
CAG   Conagra Brands       stock   40.9  27.5   1.49   4  down     down
```

Read it as: **IV/RV is the dial that drives realized assignment below 30%; the
trend gate makes sure drift doesn't fight you.** Best picks combine both **and**
clear liquidity (`wk ≥ 4`) — e.g. **NKE, CAG, BKNG, PSKY** — while single-name
IV spikes on a `wk=1`/earnings name (NWS) are traps, not edge.

---

## 5. How we verify on past data (backtest design)

[`scripts/backtest-cc.py`](../scripts/backtest-cc.py) replays the entry rule over
every ticker's daily history (542 tickers, ~290 trading days, 22,155 sampled
entries, one entry per 5 trading days to limit overlap). For each entry it:

1. estimates `σ` from trailing-20-day realized vol **(we have no historical IV — see §2)**;
2. solves the strike `K` where BS call delta = 0.30;
3. prices the premium collected;
4. looks forward 35 calendar days and records **finish-ITM** (`close > K`) and
   **touched** (`intraday high ≥ K`, a *conservative proxy for the 2.5× stop*);
5. buckets by a **causal** trend label known at entry (trailing 3M/6M return) and
   by type (ETF vs stock).

---

## 6. Backtest results & honest reading

```
=== by trend cohort (causal) ===
uptrend                    n=  6882  finishITM= 31.8%  touched= 56.0%  prem= 1.9%  E[stop-mgd]=-0.40x
sideways                   n= 10083  finishITM= 30.9%  touched= 55.3%  prem= 1.5%  E[stop-mgd]=-0.38x
downtrend                  n=  5190  finishITM= 27.2%  touched= 52.4%  prem= 1.8%  E[stop-mgd]=-0.31x
  └ sustained-down (3M&6M) n=  3253  finishITM= 29.7%  touched= 54.8%  prem= 1.9%  E[stop-mgd]=-0.37x
=== downtrend, by type ===
downtrend ETF              n=    97  finishITM= 47.4%  touched= 69.1%   (tiny n, risk-on period — not meaningful)
downtrend stock            n=  5093  finishITM= 26.8%  touched= 52.1%
=== ALL (sanity) ===
ALL                        n= 22155  finishITM= 30.3%  touched= 54.8%  prem= 1.7%
```

**What it confirms (mechanics are sound):**
- **Delta ≈ P(assignment).** All-sample finish-ITM = **30.3%** — the delta-0.30
  strike does finish ITM ~30% of the time. The model and strike math are correct.
- **The trend gate has the right sign.** Downtrend assignment (27.2%) sits below
  uptrend (31.8%). Lever A is real — but, on price action alone, **small (~4 pts)**.

**What it warns (binding risks):**
- **The stop, not assignment, is the constraint.** "Touched" runs **~55%** in every
  cohort — in this 14-month, churny, risk-on sample the stock pokes the strike more
  than half the time within 35 days. Under a literal touched-strike stop the
  expectancy is **negative** (`E ≈ −0.3 to −0.4×` premium). The doctrine's real
  2.5× stop trips *earlier* than the strike, so true stop frequency is **≥** this —
  i.e. **stop discipline + entry timing are where this strategy lives or dies**, not
  strike selection.
- **"Sustained down" did *not* beat plain downtrend** (29.7%). Over this single
  regime, deeper trend conviction added nothing — momentum bounced.

**What it CANNOT show (the central caveat):**
- **It is blind to the strategy's main edge.** The backtest sets the strike from RV
  *and* prices premium from RV, so **IV/RV = 1 by construction** — exactly why ITM
  lands at ~30%. The §4 lever (selling IV richer than RV) is invisible here because
  **we lack historical IV**. The backtest therefore *understates* the real edge:
  with true IV > RV the strike sits further out (lower touch/assignment) and the
  premium is fatter. **This backtest is a conservative floor, not a verdict.**

**Other limits:** ~290 trading days = one regime, heavily overlapping 35-day
windows (few independent samples); current-constituent universe = survivorship bias;
"touched" is a proxy, not a revalued 2.5×-premium stop.

---

## 7. Why the strategy is robust (and where it isn't)

Robustness comes from **stacking weakly-correlated edges and capping the tail**, not
from any single gate:

1. **Two independent profit sources.** *Variance risk premium* (IV>RV, structural
   and well-documented across equities — Lever B) **and** *negative drift selection*
   (Lever A). They fail in different conditions, so both failing at once is rarer
   than either alone. The backtest could only measure A (small but correctly
   signed); B is supported by the live IV/RV ≥ 1.5 names and the broad literature.
2. **Bounded left tail by construction.** The mechanical 2.5× stop, never rolling,
   locks each loss at ~1× premium (`strategy.md` §二.2). The payoff is
   "win 1× rent ~70–80% / lose 1× rent ~20–30%" — *positive only if the stop/pop
   rate stays below ~40%.* §6 says that is **not automatic** in churn — hence the
   trend + IV/RV + event gates exist precisely to push the pop rate down.
3. **Diversification.** 20–30 uncorrelated weak names turns a noisy per-trade
   expectancy into a stable monthly aggregate (law of large numbers). One name
   gapping cannot sink the book.
4. **ETF preference is a robustness choice, not a preference.** ETFs have no
   earnings gaps and mean-reverting idiosyncratic noise — the single biggest cause
   of a stop-blow-through is removed. Extending to single stocks **re-introduces**
   that tail; mitigate with the earnings-date gate and smaller per-name size.
5. **Regime awareness.** The whole thing assumes 平盤/陰跌 70–90% of the time and a
   pivot to CSP on panic (`strategy.md` §三). In a sustained melt-up the gates
   correctly produce *few* candidates and the stops bleed slowly — by design, not by
   surprise.

**Honest bottom line.** The mechanics are verified (delta≈ITM; trend lowers it). The
*profitability* is **not yet proven on our data** because the dominant edge needs
historical IV we don't have, and the stop-frequency in churn is high enough to
matter. The strategy is robust *if and only if* entry is disciplined to high IV/RV
+ genuine downtrend + event-clean names, and the stop is honored.

---

## 8. The predict → validate loop (the recommended system)

Because the IV edge can't be backtested (no historical IV), the system is built as
a forward, falsifiable loop. Shared math lives in
[`scripts/cc_model.py`](../scripts/cc_model.py); it prices the strike & premium from
**IV** but simulates dynamics from **RV** — that asymmetry *is* the edge.

**The model (inference).** For each candidate:
- `K` = delta-0.30 strike from IV;  `premium` = BS call at `K` from IV;  `yield = premium/S`.
- `S*` = the price at which the call is worth 2.5× premium (the stop barrier).
- `P_assign = P(close_T > K)` — lognormal terminal, vol = **RV**, drift 0.
- `P_stop = P(path touches S* before T)` — GBM first-passage, vol = **RV**.
- **Score** = expected capture `E = yield · (1 − 2.5·P_stop)` — rent earned minus the
  cost of getting stopped; positive only when `P_stop < 40%`.

**Calibration (validate on history).** [`scripts/calibrate-cc.py`](../scripts/calibrate-cc.py)
replays 22,155 historical entries (IV/RV≡1, since no historical IV) and checks the
probability machinery against what actually happened:

| Quantity | model | realized | realized/model |
|----------|------:|---------:|---------------:|
| P_assign (close > K) | 25.2% | 30.3% | **1.20** |
| P_touch strike | 51.8% | 54.8% | 1.06 |
| P_stop (hit S*) | 51.3% | 54.4% | 1.06 |

The lognormal terminal under-predicts assignment ~1.20× (real equities have fat
up-tails); first-passage is well-calibrated (~1.06×). Those ratios are baked into
the forward predictions as honesty haircuts (`CAL_ASSIGN`, `CAL_STOP` in
`predict-cc.py`); the forward loop re-checks them.

**Result (predict today).** [`scripts/predict-cc.py`](../scripts/predict-cc.py)
ranks the downtrend ∩ liquid ∩ $20–150 universe by `E` and **freezes** the
predictions to `predictions/cc-<date>.jsonl`. Positive-`E` set on 2026-06-18 (the
names worth selling), all calibration-adjusted:

| Ticker | IV/RV | strike | OTM% | prem% | P_assign | P_stop | E·100 | trend |
|--------|------:|-------:|-----:|------:|---------:|-------:|------:|-------|
| WBD  | 2.58 | 28.48 | 8.7 | 2.39 | 6.3% | 11.6% | **1.70** | event-driven ⚠ |
| NFLX | 1.98 | 84.28 | 8.9 | 2.44 | 12.4% | 22.9% | **1.04** | down/down |
| NKE  | 1.54 | 50.32 | 11.3 | 2.96 | 18.2% | 35.7% | 0.32 | down/down |
| AIG  | 1.55 | 78.73 | 6.4 | 1.82 | 19.6% | 34.0% | 0.27 | down/sideways |
| DXCM | 1.50 | 80.17 | 10.6 | 2.82 | 19.1% | 36.8% | 0.22 | down/up |
| DIS  | 1.50 | 109.80 | 5.7 | 1.64 | 20.5% | 35.4% | 0.19 | down/sideways |

Everything with `IV/RV ≲ 1.35` (TSCO, ABT, ICE, KHC, …) goes **`E < 0`** — rich
absolute IV is not enough; it must be rich *relative to RV*.

**Then the earnings gate (§9) fires** and it bites hard: **NFLX and NKE — the
apparent top picks — both report earnings inside the 35-DTE window** (NFLX ~mid-July,
NKE ~late-June), so their fat IV/RV is event premium, not edge. They're removed.
Across the book, **21 positive-`E`, high-IV/RV names turned out to be earnings-IV
traps** and are now gated out. WBD survives the *earnings* gate (its catalyst is a
merger/split, not scheduled earnings) — a real limitation: the gate catches earnings,
not M&A/spin-off events, so WBD still warrants manual event judgment. After gating,
the model-endorsed set (`is_target ∩ E>0`) is just **WBD, AIG, DXCM, DIS** — the
honest lesson being that on this date there are very few clean, event-free Δ0.30 CC
targets, which is itself the most useful output.

**Forward validation (validate the prediction once new data arrives).**
[`scripts/validate-cc.py`](../scripts/validate-cc.py) reads a frozen file, pulls the
realized path from `daily_prices` over `(entry, entry+35d]`, and scores predicted vs
realized assignment / stop-touch (Brier) plus the basket's realized doctrine P&L.
It refuses to score until the window completes:

```
$ python3 scripts/validate-cc.py predictions/cc-2026-06-18.jsonl
need data through 2026-07-23  latest data=2026-06-18
44/44 predictions PENDING (window not complete). Re-run after 2026-07-23.
```

After the daily ingest fills 2026-07-23, re-running scores the batch — and because
those strikes were set from **real IV**, a positive basket P&L is the first true
out-of-sample evidence of the IV/RV edge.

## 9. Shipped: per-instrument score + daily collection

The model is now wired end-to-end into the product:

- **Storage** — `predict-cc.py` scores *every* instrument (not just targets) and
  upserts `option_harvest_cc_scores` (`@@map`; Prisma model `CcScore`). It's
  **stored, not derived at read time** (unlike Harvester) precisely so the number
  shown equals the frozen prediction used for validation.
- **Web** — `getDashboardData` joins `ccScore`; the table has an **Edge** column
  (diverging red→green chip, `src/lib/ccscore.ts`) showing `E` with a tooltip of
  strike/OTM%/P(assign)/P(stop)/IV-RV, sortable like Harvester. A new **CC Model**
  screen lists the `is_target` set, default-sorted by Edge.
- **Daily collection** — `scripts/daily.sh` now runs `npm run predict` after the
  history/trend step, so the existing `option_harvest-ingest.timer` (06:00 local)
  both refreshes the Edge scores and **grows the prediction archive** one frozen
  `predictions/cc-<date>.jsonl` per day. That archive is what `validate-cc.py`
  scores once each window matures — the rolling out-of-sample test of the IV edge.
- **Earnings gate** — ingest now pulls each name's next earnings date
  (`quoteSummary calendarEvents` → `option_harvest_quotes.next_earnings`;
  `scripts/backfill-earnings.ts` populates it on demand). `predict-cc.py` flags
  names with earnings inside the DTE window (`event_flag`) and excludes them from
  `is_target`. The table shows a ⚡ badge; the **CC Model** screen filters to
  `is_target ∩ Edge > 0` (event-free, model-endorsed). On 2026-06-18 the gate
  removed 21 would-be traps (NFLX, MMM, GEV, …).

### Still open

1. **Accumulate IV history** — `option_harvest_iv_history(ticker, date, iv_pct)` so a
   *premium-aware* backtest (not just the forward loop) becomes possible.
2. **Path-revalued stop** — `calibrate-cc.py` uses an entry-time barrier `S*`; revalue
   the option daily with decay for a tighter stop model (current ~1.06× haircut covers most of the gap).
3. **Event gate beyond earnings** — catch M&A/spin-off catalysts (e.g. WBD) that
   inflate IV/RV without a scheduled earnings date; the current gate only sees earnings.
