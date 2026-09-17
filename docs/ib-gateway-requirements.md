# IB Gateway channel — data requirements

What the **IB Gateway** channel (headless Gateway, read-only, reached through `ib-agent`)
must be able to deliver so that it can serve as a **full alternative** to the Chrome
extension for the datasets it is allowed to own.

**This file is requirements only** — what data, with which fields, at what freshness, and
how we know it is right. No mechanism, no code, no migration steps. Those live in
`docs/ib-agent-integration.md` (how the channel is called), `docs/data-sources.md` (the
two-channel model, provenance, replace guard) and `docs/spec.md` (what each number means
once stored).

Status: requirement statement, 2026-09-14. Nothing here asserts that the Gateway already
satisfies it; § 11 is the checklist that decides that.

---

## 1. Why a second source, and what "alternative" means

Today every IBKR number arrives through the extension, which needs a browser, a live
Client-Portal login, and for the timed passes an IB tab in the **foreground**. That is a
single point of failure with a human in it.

The Gateway is the second source. The requirement is **not** to replace the extension:

* **R1 — Two channels, permanently.** Both channels remain supported. Each dataset may be
  served by either channel; neither channel may be *required* for the other to work.
* **R2 — Either alone is sufficient.** For every dataset in § 4 marked *dual*, the app must
  be fully usable with **only** the extension running, and fully usable with **only** the
  Gateway running. No screen, gate or watchlist may need both at once.
* **R3 — Substitution is never silent.** Which channel produced a number we hold, and when
  that channel last succeeded or failed, must be visible without reading a log. A channel
  that answers with nothing must be distinguishable from a genuinely empty book.
* **R4 — No downgrade by switching.** Cutting a dataset from `ext` to the Gateway must not
  lose a field the screens already use, and must not widen the staleness of anything the
  strategy gates on (delta above all). A field the Gateway cannot supply is a **blocker**
  for that dataset, not an acceptable regression.
* **R5 — Read-only, always.** The Gateway channel is a reader. Anything that would place,
  modify, cancel or simulate an order is out of scope for it by design (§ 5).

## 2. Vocabulary used below

| Term | Meaning |
|---|---|
| **required** | absence blocks the dataset from being served by this channel |
| **wanted** | improves a screen; absence is acceptable and must be stored as null, never approximated |
| **as-of** | the moment IB priced/knew the value, not the moment we received it |
| **dual** | may be owned by either channel |
| **ext-only** | the Gateway is not required to supply it, ever (§ 5) |

Two conventions apply to every dataset and are as load-bearing as the fields themselves:

* **D-AS-OF** — every payload states the as-of of its content and whether it is live or a
  stored snapshot. Freshness we cannot state, we cannot trust.
* **D-EMPTY** — an empty answer states *why* it is empty (nothing held / not entitled / no
  session / not synced yet). "Zero rows" alone is not an acceptable answer, because the most
  common shape of a broken read is an empty one.

---

## 3. Identity and units — the cross-channel contract

Both channels write the same tables, and the same instrument must land as the same row.
These are requirements on the *shape* of the data, not on the parser.

* **I1 — Contract id.** Every instrument carries IB's **conid**. For an option leg, the
  **underlying conid** comes with it — the option's own answer to "what underlying is this",
  not a name match.
* **I2 — Symbol.** Underlying ticker, upper-cased, as the app's universe spells it. The
  option's full/local symbol is carried separately for display; it never substitutes for the
  underlying symbol.
* **I3 — Option identity.** Right (`C`/`P`), strike, expiry as `YYYY-MM-DD`, and the
  **multiplier**. A leg is only identifiable to us as (underlying, right, strike, expiry) +
  conid.
* **I4 — Signed size.** Quantity is signed with **short negative**. This book is short
  premium; a sign error is a direction error.
* **I5 — Cost basis.** Whether an average cost is per share/contract or per position must be
  unambiguous, and consistent with what the other channel writes. Same for whether a premium
  is quoted per share or per contract.
* **I6 — Currency.** Every money field names its currency; account-level figures name the
  account base currency.
* **I7 — Time.** Dates that IB reports as a trade date stay calendar dates; timestamps are
  unambiguous instants. A trade date must not shift by a timezone.
* **I8 — Account.** Every payload names the IB account it describes.

---

## 4. Datasets the Gateway channel must deliver

### 4.1 Positions — the book (*dual*, highest priority)

The full open book, every leg, options **and** stock.

| Field | Level |
|---|---|
| account, conid, underlying conid (options), underlying symbol, security type | required |
| right, strike, expiry, multiplier (options) | required |
| signed quantity, average cost, market price, market value | required |
| instrument description / local symbol | required |
| currency | required |
| unrealized P/L, realized P/L for the day | wanted |
| as-of + live-or-stored | required |

Requirements:

* **P1 — Completeness over correctness of any one leg.** A partial book is worse than none:
  the payload must be all-or-nothing per account. Every screen, the risk brief, and the
  action boards read the book as *the* book.
* **P2 — Options are first class.** A naked book holds options and often no stock at all;
  option legs may not be summarised, netted across expiries, or reported without strike and
  expiry.
* **P3 — Empty is a claim, not a default.** "No positions" must be distinguishable from "no
  snapshot yet" and from "not entitled".
* **P4 — Freshness.** On demand: live. Unattended: a snapshot no older than the bound the
  operator sets for the run (today's practice: half a day), stated in the payload.

### 4.2 Account balances and account-level margin (*dual*)

One snapshot per calendar day is enough for history; on demand it must be current.

| Field | Level |
|---|---|
| net liquidation, total cash, settled cash | required |
| available funds, excess liquidity, buying power | required |
| current initial margin, current maintenance margin | required |
| full initial / full maintenance margin requirement | required |
| gross position value, equity with loan | wanted |
| cushion (excess liquidity ÷ NLV) | wanted (derivable) |
| RegT equity / RegT margin | wanted — **null when absent, never approximated** |
| account base currency, account id, as-of | required |

* **B1 — Net liquidation is mandatory.** A balance row without NLV is not a balance row; the
  daily slot is unique per date, so a null-filled row destroys that day.
* **B2 — Account-level margin only.** Per-position margin is § 5.

### 4.3 Working orders (*dual*)

| Field | Level |
|---|---|
| order id (and a stable id for dedup), account | required |
| conid, underlying symbol, security type, right/strike/expiry for options | required |
| action (buy/sell), total quantity, remaining quantity | required |
| order type, limit price, stop/trigger price, time-in-force, status | required |
| parent / OCA / bracket linkage | wanted (hedge matching reads it) |
| currency, as-of | required |

* **O1 — Every working order, whatever placed it.** Orders entered from the mobile app or
  another session must appear. The protective buy-stops that cover short calls are exactly
  the orders most likely to have been placed elsewhere, and an order list that silently
  omits them reads as "unhedged".
* **O2 — Zero is a legal answer** (everything can fill or cancel) — but only when O1 holds.
  Without O1, an empty list proves nothing.

### 4.4 Executions / transactions — the realized record (*dual*)

The P/L engine, the closed-trade record and every attribution downstream are built from
fills.

| Field | Level |
|---|---|
| execution id (stable, for dedup) | required |
| trade date (and time), account | required |
| conid, underlying symbol, asset class, right/strike/expiry | required |
| side, signed quantity, price, proceeds | required |
| commission / fees | required |
| realized P/L as IB books it | wanted (we compute our own) |
| open/close indicator | wanted |
| linked order id | wanted |
| **the window the payload covers**, and its as-of | required |

* **T1 — The window must be declared.** "Today only" and "last 7 days" are both acceptable;
  *unstated* is not. A missing trade must be attributable to the window rather than to a
  gap.
* **T2 — Additive, deduplicable.** History is never replaced wholesale, so every fill needs
  an id that is stable across re-reads.
* **T3 — Assignments and expiries are events too.** Assignment, exercise and expiration must
  be identifiable, and the option leg they belong to must be recoverable. Today assignment is
  only inferable from the share-side row; the requirement is to make it explicit if IB does.
* **T4 — Long history stays possible.** Whatever window the channel offers, the ability to
  bring in a longer history by hand (CSV/Flex) must remain — the record predates any channel.

### 4.5 Per-contract greeks and per-strike IV (*dual*, acceptance-gated)

For every **held** option leg, keyed by conid:

| Field | Level |
|---|---|
| delta, gamma, theta, vega | required |
| implied vol **of that strike** | required |
| underlying spot at the same moment | required |
| the moment the value was **measured** (per field, delta separately) | required |
| model-vs-market provenance of the greek set | wanted |

* **G1 — Delta coverage is the acceptance test.** Coverage must reach **every** held option
  leg. Names without a delta are dropped from the roll/give-up screens, so a coverage gap
  does not look like missing data — it looks like no risk.
* **G2 — Measurement time, not receipt time.** A value received outside market hours belongs
  to the last session that priced it. Receipt is not measurement, and a stale delta rendered
  as live has already cost us once (`docs/defects/2026-08-21-stale-delta.md`).
* **G3 — Per-strike IV, not the underlying's.** The strike's own IV is required; the
  underlying's 30-day figure is a different measurement (§ 4.7) and may not stand in for it.
* **G4 — Empty rather than old.** If a greek is unavailable, it must be absent. Re-serving
  the previous value as current is the single worst failure in this dataset.

### 4.6 Contract resolution — conids (*dual*)

* **C1 — Ticker → conid** for the whole tracked universe (S&P 500 + the ETF shelf, ~600
  names): conid, security type, primary exchange, currency, and the name IB knows it by.
* **C2 — Held option → underlying conid**, from the contract itself.
* **C3 — Renames and reorganisations self-correct.** A conid that changed must come back
  changed, not stay pinned to a dead listing.
* **C4 — The four known corrections are the regression test.** B, COIN, GDX and DOW are the
  cases name-matching got wrong; a resolver that reproduces them without a manual pin is
  correct. Manual pins remain possible for genuine overrides.

### 4.7 Underlying market data (*dual*, secondary)

* **Q1 — Spot** last price per tracked underlying.
* **Q2 — 30-day constant-maturity implied vol per underlying** — the same measurement the
  operator's IB watchlist column shows. It must be stored *beside* our own single-expiry IV,
  never merged into it: they are different measurements, and keeping both is the only way the
  gap can be measured (`docs/defects/2026-09-10-missing-ib-iv.md`).
* **Q3 — Option chain around the money** for a chosen expiry: strikes with bid/ask, mid, IV
  and delta, plus the near-term expiry ladder with days-to-expiry.
* **Q4 — Market-hours honesty.** Anything quoted outside US hours must be marked as such.
  Bid/ask captured when the market is shut is a last print, and the app already treats those
  two differently.

### 4.8 Channel state (*Gateway-specific, required*)

Not trading data — the data that makes the channel auditable:

* **S1 — Session and entitlement state**: is there a usable session, for which account.
* **S2 — Readiness must not be a proxy for usefulness.** "Ready" while every dataset answers
  with nothing is a state we have already observed; the channel must be able to say *ready
  but empty*, and it must be recorded as such.
* **S3 — Every attempt is recorded**, including the ones that write nothing, with what was
  asked, what came back, and the reason it did not.

### 4.9 Priority order

1. Positions and balances (§ 4.1, § 4.2) — everything else is derived from the book.
2. Conid resolution (§ 4.6) — removes the guessing layer.
3. Greeks (§ 4.5) — gated on G1.
4. Orders and executions (§ 4.3, § 4.4).
5. Underlying market data (§ 4.7).

One dataset at a time. Two datasets cut over together share a failure and hide each other's.

---

## 5. Not required from the Gateway — the extension keeps these

These are **ext-only** by nature, not by schedule. The requirement is that the app stays
correct while they remain single-channel, and that no Gateway work is spent trying to
substitute them.

* **M1 — Per-position maintenance/initial margin** (the exact requirement one leg ties up).
  It is obtained by simulating a closing order; a read-only session must refuse that, and
  that gate stays shut. Account-level margin (§ 4.2) is the Gateway's part.
* **M2 — Pulling the user's own IB watchlists.**
* **M3 — Pushing the `OH:*` lists to IB and reading them back to verify.** The read-back is
  the only programmatic proof of what IB actually stored.

Consequence to hold onto: **the browser cannot be retired.** The Gateway removes the
browser from the *book*, not from the workflow.

---

## 6. Freshness requirements

| Dataset | On demand | Unattended | Refuse when |
|---|---|---|---|
| positions | live | ≤ 12 h stored snapshot | older than the stated bound |
| balances | live | one row per calendar day | NLV missing |
| orders | live | ≤ 1 h | — (zero is legal) |
| executions | live | window declared | window unstated |
| greeks | live, US hours | measured within the last session | measurement time unknown |
| conids | on demand | weekly is enough | — |
| quotes / IV | live, US hours | daily | market-closed value presented as live |

* **F1 — Age is a first-class value.** Where a number's age changes the decision (delta, the
  book itself), the age travels with it to the screen.
* **F2 — Nothing on the request path may wait on IB.** Pages serve what is stored; a hung
  Gateway is allowed to be stale, never to be slow.

## 7. Comparability requirements

* **X1 — Diffable.** For any dataset served by both channels, the two answers must be
  comparable leg by leg, so a cutover can be reviewed as a diff rather than trusted.
* **X2 — Differences are resolved in interpretation, not by widening tolerance.** A symbol
  format or multiplier mismatch is a mapping defect until proven otherwise.
* **X3 — Declared tolerances.** Prices and greeks measured at different moments will differ;
  the acceptable difference is stated per dataset before a cutover, not argued afterwards.
* **X4 — Cross-channel ordering.** Older data must never overwrite newer data written by the
  other channel.

## 8. Failure requirements

* **E1 — A dead channel changes nothing.** No writes, no deletions, previous data stands.
* **E2 — Empty, truncated and out-of-order payloads are refused**, and the refusal is
  recorded and visible. A refusal is the system working.
* **E3 — Every failure is attributable** to a channel and a dataset, with a cause specific
  enough to act on (no session / unreachable / nothing stored / timed out / not entitled).
* **E4 — Bounded.** No call may hang indefinitely; a hang is a recorded outcome.
* **E5 — Human-in-the-loop steps stay human.** Anything requiring a 2FA approval is never
  triggered by automation.

## 9. Security requirements

* **SEC1 — Read-only end to end**: account rights, session configuration and the invoked
  interface each independently prevent order entry.
* **SEC2 — Attributable use.** Every invocation is logged with which project made it.
* **SEC3 — Known, unfixed exposure.** The app's own write endpoints are unauthenticated and
  reachable off-LAN; this channel changes *who calls them*, not *who can*. It is a real risk
  and it is tracked separately (`docs/ib-agent-integration.md` § 7). Nothing in this document
  closes it.

## 10. Out of scope

Order placement, modification, cancellation and what-if simulation; anything that mutates
IB-side state (other than the ext-only OH list push, § 5); IB watchlists; fundamentals,
prices and earnings dates that already come from the market-data ingest; and any use of a
private storage format inside the Gateway project as an interface.

## 11. Definition of done, per dataset

A dataset may be served by the Gateway channel when all of the following hold:

1. Every **required** field in its § 4 subsection is present and correctly typed.
2. The identity and unit rules in § 3 hold — same instrument, same row, same sign, same
   currency as the extension writes.
3. A side-by-side comparison against the extension's answer for the same moment shows only
   differences allowed by § 7.
4. Its freshness bound (§ 6) is enforced and its age is visible where it matters.
5. Empty, partial and unavailable answers behave as § 8 requires, demonstrated at least once
   deliberately.
6. Provenance is recorded per row and per attempt, and readable on the sync status screen.
7. The extension path for that dataset still works, and disabling either channel leaves the
   app correct (R2).

Greeks additionally require **G1** (delta on every held leg) before any cutover; conids
additionally require **C4** (the four corrections reproduced).
