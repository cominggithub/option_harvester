# Proposed amendment: the geared-ETF sleeve (short calls v1.3 candidate)

**Status: proposal, not doctrine.** Written by the `option-adviser` role on 2026-09-08 after the
operator asked whether the short-call program should focus on leveraged ETFs — high IV, spread
across sectors, no earnings gaps. `docs/short-call-strategy.md` is read-only to this role, so
this file is the amendment; landing it is a deliberate act by the operator, and it should not be
landed as written until § 5's tests report.

**What this proposes:** not a change of universe, but a **declared sleeve with a ceiling**, plus
one new selection rule and one new book rule, both stated as falsifiable hypotheses with the `n`
required to confirm or kill them. Two of the operator's three premises are measured true. The
third — *focus* — is arithmetically impossible under the spec's own diversification floor, and
that is the reason this is a sleeve and not a pivot.

---

## 1. What the record actually says

Cut from the 230 closed short-call legs on `/md/short-call.md` (2026-09-08), re-derived from the
"Every closed short call" table; leg-wise throughout, chains never mixed in. Shelf membership
from `lib/leveraged.ts` (47 curated funds).

### 1.1 High IV at fill is the strongest entry cut in the book — measured on IV, not on leverage

| cohort | n | credit | realized | kept | win |
| --- | --- | --- | --- | --- | --- |
| IV ≥ 60% | 90 | $22,719 | −$2,060 | −9.1% | 78.9% |
| IV ≥ 60%, ex-MRNA | 88 | $22,041 | **+$8,026** | **+36.4%** | 79.5% |
| IV < 60% | 139 | $31,553 | −$354 | −1.1% | 59.7% |

By bucket, monotonic: IV <40% kept −45.4% / 51.6% win (n=31); 40–60% +6.9% / 62.0% (n=108);
60–80% ex-MRNA +19.1% / 75.6% (n=45); **80%+ kept +63.9% / 84.1% win (n=44)**, avg cushion 1.13σ,
yield 2.65%.

Both headline cells clear the ≥12 bar by a wide margin. **But MRNA alone — one leg, IV 76% at
fill — flips IV ≥ 60% from +$8,026 to −$2,060.** High IV is fat tails. Any amendment that steers
the book toward richer vol therefore *raises* the cost of the program's largest known gap: no cap
on single-chain loss size, dropped in practice per §7.5. **This proposal must not land ahead of a
loss-size cap.** That ordering is the single most important sentence in this file.

### 1.2 Geared names did pay more for the same distance — but n=11

11 closed legs on shelf names: credit $3,837, realized −$634, kept −16.5%, win 63.6%.
Ex-LABU: n=10, +$916, kept +27.8%, win 70.0%.

| | leveraged (n=11) | everything else (n=219) |
| --- | --- | --- |
| avg IV at fill | **76.4%** | 61.8% |
| avg Δ at sale | 0.24 | 0.23 |
| avg cushion | 1.02σ | 0.99σ |
| credit ÷ assignment notional | **2.53%** | 1.99% |
| avg DTE | 40.7 | 45.2 |

Same delta, same cushion, **27% more premium per dollar of assignment exposure**. That is the
mechanism the operator is pointing at, and it points the right way.

**It cannot carry a conclusion.** n=11 is below the spec's ≥12 threshold; only TQQQ has ≥3 closed
trades (n=6, kept 3.8%), so no geared name has a per-name verdict. Reporting +27.8% by removing
LABU is the same move that makes the whole program look flat by removing MRNA, and it is refused
here for the same reason.

The one geared loss is an **exit**, not the instrument: LABU −$1,550, the page's own reason being
*"closed while still 8% OTM with IV lower — paid $1,550 to exit rather than let it run."*

### 1.3 "Focus" fails on arithmetic

`SC-B1` carries `minNames: 20` (`sc-rules.ts:387`, `MIN_NAMES = 20` at `:56`), alongside
`MAX_NAME_CREDIT_SHARE = 0.05` and `MAX_CONTRACTS_PER_NAME = 2`. The live writable universe
(`/md/watchlists.md`, 2026-09-08 06:08) is **LEVMIX 7 · LEVHIV 12 · LEV 18**.

* 7 names at a 5% credit cap each ⇒ **35% of the book is the ceiling** at compliant sizing.
* Even the full 18-name shelf cannot satisfy `minNames: 20`.
* So a geared-only program breaches the diversification floor **on day one, by construction** —
  no market move required.

Current state for reference: Leveraged / Inverse was already **20.2% of open credit, 11 of 42
legs** on the 2026-09-07 08:34Z snapshot. The tilt is over half-built.

### 1.4 The earnings premise is valid and already encoded

`SC-S6` (§2.6) is a hard gate for single stocks; ETFs pass it by construction, and the candidates
engine already prints *"ETF, so no earnings gap"*. Live cost of not having the sleeve: **5 legs,
$5,416 credit, $59,100 of assignment exposure held over a print.** A gap is not drawn from the
distribution IV describes, so the σ cushion never prices it — this is the one risk class a geared
sleeve removes outright rather than reducing.

---

## 2. What is already right in the code, and must not be touched

* **Inverse funds excluded** (`SC-S7`, and `isLongLeveragedEtf` in `lib/leveraged.ts`): writing a
  call on a −3x fund is a *bullish* index bet, the opposite of this book.
* **UVXY is a declared `hazard`** — on the shelf to be watched, barred from LEVHIV/LEVMIX no
  matter how rich its IV, because *"a naked call on a VIX-futures fund is the one position here
  whose loss the strategy cannot size, and it spikes precisely when every other name on the shelf
  is falling."* That is the correct boundary and this amendment does not move it.
* **LEVMIX's overlap graph** already solves the "same bet under two tickers" problem, which is the
  hardest part of the operator's "spread sector" requirement.

---

## 3. Proposed rules

Two new ids, neither colliding with the 21 in the registry (`SC-S1`–`S7`, `E1`–`E4`, `M1`–`M5`,
`B1`–`B5`).

### SC-S8 · A geared fund is writable only from the thinned shelf

*Selection.* A short call on a fund with leverage factor ≥ 2 may only be opened if the ticker is
in **LEVMIX** on the day of the sale — not merely LEV or LEVHIV. Rationale: LEV is the universe,
LEVHIV is the liquid end, and only LEVMIX has been de-duplicated against the exposure-family
overlap graph. Selling two names from one family is the failure this rule prevents, and it is
invisible to `SC-B1` when the two funds carry different sector labels.

`evaluate()` returns pass/fail with margin = the name's rank within LEVMIX, so a marginal
inclusion is visible as marginal. Fails `unknown` when the list has not been built for the day
rather than defaulting to pass — a stale list must not silently authorise a sale.

### SC-B6 · The geared sleeve has a declared ceiling

*Book.* Credit from funds with factor ≥ 2 may not exceed **35% of open credit**, and the sleeve
must contribute at least **5 distinct exposure families**. The 35% is not a preference: it is
`MAX_NAME_CREDIT_SHARE × |LEVMIX|` at today's list size, i.e. the largest sleeve that can exist
without breaching the per-name cap. It therefore **moves with the list** and must be computed,
not hard-coded — if LEVMIX shrinks to 5 names the ceiling is 25%.

Margin reported as percentage points from the ceiling, in the same shape as `SC-B1`.

### Not proposed, deliberately

* **No change to `MIN_NAMES`, `MAX_THEME_CREDIT_SHARE` or `MIN_EFFECTIVE_THEMES`.** The temptation
  is to relax the diversification floor so a geared book can satisfy it. That would be relaxing a
  rule to fit a universe rather than choosing a universe that fits the rule — the same error §4 of
  `acquisition-puts.md` refused on 2026-08-23 when it kept the GDX cap and reduced contracts
  instead.
* **No IV floor as a new rule.** § 1.1's cut is strong but rests on *reconstructed* Δ/IV
  (`system-gaps.md` §1) and inherits MRNA. Propose it only after § 5.1 reports on measured IV.
* **No change to the σ floor.** Geared funds do not need a different cushion rule; 1.5σ already
  scales with the fund's own IV, which is the whole point of measuring distance in σ.

---

## 4. The version entry, if it lands

```
{
  version: "1.3",
  date: "<land date>",
  effectiveFrom: "<land date>",
  summary:
    "The geared-ETF sleeve: high IV without earnings gaps, sourced only from the de-duplicated
     LEVMIX shelf and capped at the largest share the per-name cap can support. A sleeve, not a
     pivot: the writable geared universe is too small to satisfy MIN_NAMES on its own.",
  source: "docs/proposals/leveraged-etf-sleeve.md",
  changes: [
    { ruleId: "SC-S8", change: "geared funds writable only from LEVMIX on the day of sale",
      why: "LEV/LEVHIV permit two funds from one exposure family under different sector labels,
            which SC-B1 cannot see.",
      test: "closed geared legs, sleeve vs non-sleeve, kept % and win rate", minTrades: 12 },
    { ruleId: "SC-B6", change: "geared credit ≤ MAX_NAME_CREDIT_SHARE × |LEVMIX| of open credit,
            and ≥5 exposure families",
      why: "A geared-only book breaches MIN_NAMES=20 by construction; the ceiling is the largest
            sleeve the per-name cap can support.",
      test: "sleeve share against the computed ceiling on every snapshot", minTrades: 1 },
  ],
}
```

`/short-call/strategy` then reports it as *pending data* until § 5's thresholds are met, which is
the mechanism that stops this becoming doctrine by assertion.

---

## 5. Tests — what confirms this, and what kills it

### 5.1 Does the geared sleeve beat the rest at matched cushion? (the core test)

*Cohort:* closed short-call legs, shelf membership at open, σ at fill ∈ [1.0, 2.0] so the
comparison is not contaminated by the cushion effect that already dominates the record.
*Required:* **n ≥ 12 geared legs**, no cell under 3. Today n=11, so this is pending by one trade.
*Confirms:* geared kept % exceeds non-geared by more than the yield gap (2.53% vs 1.99%) predicts.
*Kills it:* geared kept % at or below non-geared at matched σ — meaning the extra premium was fair
compensation and there is no edge, only more variance.

### 5.2 Is the premium actually rich, or just large? (the IV/RV test)

The yield gap in § 1.2 measures premium **level**, not premium **richness**. Edge requires
IV > RV, and the backtest in `cc-target-strategy.md` cannot answer it — it sets strike and premium
from RV, so **IV/RV ≡ 1 by construction** and it is blind to exactly this question.
*Method:* `scripts/iv-rv-screen.py` across the shelf versus the non-geared universe, over the
matured window, plus `option_harvest_iv_history` for IV rank.
*Kills it:* geared funds show IV/RV at or below 1 relative to the rest — then the sleeve is buying
variance at fair value with 3x path risk attached, and § 1.2's yield gap is an illusion.

### 5.3 Does the sleeve concentrate market beta while reporting diversification?

`MIN_EFFECTIVE_THEMES` counts labels. Every 3x long is 3× a common factor, so a sleeve can read
6 effective themes and still be one bet in a broad rally. `/risk`'s Parallel shock is at-expiry
intrinsic and cannot see the path.
*Method:* beta- or factor-weighted theme HHI for the sleeve, and `shockBook` run on the geared
legs separately from the rest.
*Kills SC-B6's family floor:* if beta-weighted HHI on 5 families is no better than on 2, the
family count is decoration and the ceiling should be the only control.

### 5.4 Can the sleeve be afforded? (the blocking unknown)

Margin is the binding constraint — 69.7% of NLV against a 60% limit — and per-leg what-if coverage
is **24% of legs**, newest pass 2026-08-11. So margin per dollar of credit **by instrument class
is not measurable today**. The Leveraged / Inverse bucket looks cheap ($4,260 of margin on $3,781
credit) against Semiconductors ($15,879 on $8,279), but those sums cover different fractions of
their buckets and are not comparable.
*Method:* Deep sync to ~100% coverage, then margin ÷ credit by class.
*Kills the sleeve outright:* if IB haircuts geared short calls materially harder, the sleeve buys
27% more premium with more than 27% more margin, and at a 22% cushion the program cannot fund it.
**This test gates the other three**, because an unaffordable edge is not an edge.

### 5.5 Does leverage stress the exit rather than the entry?

*Hypothesis* from § 1.2: a 3x fund converts a modest index move into a violent mark swing, so
geared legs are bought back earlier and more often than their cushion warrants. LABU is the only
geared loss and it is exactly this.
*Cohort:* geared vs non-geared, hold duration and captured-% at close, re-cut by the state at the
moment of closing (mandated vs discretionary), because the raw bought-back/expired split cannot
support a causal claim.
*Required:* n ≥ 12 geared closes. *Kills it:* geared holds are no shorter and no less captured at
close than the rest.

---

## 6. Order of operations

1. **Loss-size cap first** (§7.5 / `system-gaps.md`). § 1.1 shows one leg erasing a +$8,026
   cohort; steering toward richer vol without a cap raises that exposure knowingly.
2. **Deep margin sync** — § 5.4 gates everything.
3. **§ 5.2 IV/RV screen** — cheap, needs no new trades, and can kill the thesis before any rule
   ships.
4. Then `SC-B6` (the ceiling, measurable at n=1) — it is a *constraint*, so it is safe to land
   early and prevents the sleeve growing past what the per-name cap supports while § 5.1 waits.
5. `SC-S8` last, when § 5.1 has its twelfth geared leg.

---

## 7. What could not be verified

Margin per credit by instrument class (24% coverage, 27-day-old pass); whether IB haircuts geared
ETF short calls more heavily than plain ETFs, which no data in this repo answers; IV at fill
throughout is a Black-Scholes reconstruction, not a measured greek; the geared cohort is n=11 with
one name at n=6 and five names at n=1; and the whole record is one regime (~14 months, risk-on,
churny) with heavily overlapping windows, so far fewer independent samples than rows.
