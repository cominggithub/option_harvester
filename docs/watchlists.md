# option_harvester — Watchlists spec

How watchlists work: the two sources (OH + IB), the `/watchlists` page, and the
three sync flows between the web app and Interactive Brokers via the Chrome
extension. Companion to **docs/spec.md** (product) and **CLAUDE.md** (ops).

Terminology: **OH** = Option Harvester's own, *computed* lists. **IB** = the
user's Interactive Brokers lists, *synced* in by the extension.

---

## 1. Sources

### OH — computed, never stored
Derived live at read time from the dashboard data (`getDashboardData`) — they
always reflect the latest ingest + synced positions. Defined in
**`src/lib/watchlists.ts`** (`computeOhWatchlists`), shared by the page and the
OH→IB push so membership has one source of truth. There are **15 OH lists** in a
fixed order (NC, NCcan, Cpos, Ppos, RED, HIV, HIVS, HIVSC, OTC, ROIC, LEV, LEVHIV, LEVMIX, ETFHIV, ETFMIX) — that order sets
the OH→IB suggested ids **990001–990015** (`OH_ID_BASE` in `ohpush.ts`), so **only
append new lists at the end** to keep existing ids stable.

**Shared thresholds** — one source of truth, all exported constants; never inline a
magic number:

| Constant | Value | Where | Used by |
| --- | --- | --- | --- |
| `NC_MIN_VOLUME` | 3,000,000 sh/day | `securities.ts` | NC, NCcan |
| `NC_PRICE_MIN` / `NC_PRICE_MAX` | $20 / $180 | `securities.ts` | NC, NCcan |
| `NC_IV_MIN` | 40 % | `securities.ts` | NC, NCcan |
| `NC_MIN_WEEKLY_BUCKETS` | 4 (7/14/21/28-DTE ladder — weeks 1-4) | `securities.ts` | NC, NCcan, HIV, HIVS, HIVSC |
| `HIV_IV_MIN` | 50 % | `watchlists.ts` | HIV, HIVS, HIVSC |
| `HIVS_PRICE_MIN` / `HIVS_PRICE_MAX` | $20 / $200 | `watchlists.ts` | HIVS, HIVSC |
| `HIGH_ROIC_MIN` | 15 % | `roic.ts` | ROIC |
| `LEV_MIN_FACTOR` | 2 (2x and up) | `leveraged.ts` | LEV |
| `LEV_IV_MIN` | 50 % (= `HIV_IV_MIN`) — **geared** funds | `watchlists.ts` | LEVHIV, LEVMIX |
| `LEV_IV_MIN_1X` | 40 % (= `NC_IV_MIN`) — **1x** funds | `watchlists.ts` | LEVHIV, LEVMIX |
| `ETF_IV_MIN` | 30 % — unleveraged only | `watchlists.ts` | ETFHIV, ETFMIX |
| `SHELF_MIN_DOLLAR_VOL` | $10,000,000 traded/day | `watchlists.ts` | LEVHIV, LEVMIX, ETFHIV, ETFMIX |
| `SHELF_MIN_LADDER` | 2 expiries inside 42 d | `watchlists.ts` | LEVHIV, LEVMIX, ETFHIV, ETFMIX |
| assignment-risk delta | \|Δ\| > 0.30 (inline) | `watchlists.ts` | RED |

**The lists**, grouped by family. "Requires" is the data a list needs to be
correct — a list silently under-populates if its inputs are stale/unsynced.

| Key | Name | Family | Membership rule | Requires |
| --- | --- | --- | --- | --- |
| `nc`   | NC     | screen   | `s.nc` — the Analyzer "Naked Call" screen (`isNcTarget`): 1M **and** 3M **and** 6M trend all *not-up*, volume > `NC_MIN_VOLUME`, `NC_PRICE_MIN` < price < `NC_PRICE_MAX`, weekly buckets ≥ `NC_MIN_WEEKLY_BUCKETS`, IV > `NC_IV_MIN`%. Stocks **and** ETFs. | ingest (trend/vol/price/IV/ladder) |
| `nccan`| NCcan  | screen   | `s.nc && !s.held` — short-call candidates: in NC but no position held yet. | ingest + position sync |
| `cpos` | Cpos   | position | `s.position.call !== 0` — underlyings you hold a **call** option on. | position sync |
| `ppos` | Ppos   | position | `s.position.put !== 0` — underlyings you hold a **put** option on. | position sync |
| `red`  | RED    | position | `s.position && maxOptAbsDelta > 0.30` — high assignment risk: held names whose largest **short** option leg (call or put) has \|Δ\| > 0.30. Long legs don't count (they can't be assigned against you). The Δ is the **effective** one (`lib/greekage.ts`): IB's measurement while it's under 18h old and agrees with the leg's mark, else the mark-implied value — so a stale greek can't keep a name off the list, and a leg IB has never priced still gets a delta. | position sync (marks) + greeks sync |
| `hiv`  | HIV    | IV       | `s.ivPct > HIV_IV_MIN && weeklyBuckets ≥ NC_MIN_WEEKLY_BUCKETS` — high implied vol **with a tradable 1/2/3/4-week option ladder**: any tracked name (stock or ETF) with front-month ATM IV above 50 % and ≥4 near-term weekly expiries. | ingest (IV + ladder) |
| `hivs` | HIVS   | IV       | `hiv && HIVS_PRICE_MIN < s.price < HIVS_PRICE_MAX` — HIV restricted to the mid price band ($20–$200). `hivs ⊆ hiv`. | ingest (IV + price) |
| `hivsc`| HIVSC  | IV       | `hivs && s.position.call === 0 && s.position.put === 0` — HIVS **candidates**: HIVS names you hold **no call and no put** on yet. `hivsc ⊆ hivs`. | ingest + position sync |
| `otc`  | OTC    | target   | `(s.target \|\| s.position.call !== 0 \|\| s.position.put !== 0) && s.position.call === 0` — "Option Targets, no Call": names in the Analyzer's Option Targets (flagged bullseye **or** any held option leg) that you don't yet hold a **call** on. Your call-writing candidates; excludes anything already in Cpos. | marks (target) + position sync |
| `roic` | ROIC   | value    | `s.highRoic` — value-quality names with Return on Invested Capital ≥ `HIGH_ROIC_MIN` (15 %). Same membership as the `/roic` screen; stocks only (ETFs have no ROIC). The cash-backed put-write quality universe. | ingest (fundamentals → ROIC) |
| `lev`  | LEV    | leverage | `isLongLeveragedEtf(s)` — **leveraged long ETFs**: `type === "etf"` and a name-derived leverage factor ≥ `LEV_MIN_FACTOR` (2x/3x — "Ultra" = 2x, "UltraPro" = 3x, "Bull 2X/3X", "(2x)", "2x Long"). **Inverse/short funds are excluded** ("Bear", "Short", "UltraShort", "Inverse", any `-2x`/`-3x`). | ingest (name + type) |
| `levhiv`| LEVHIV | leverage | `isLevWritable(s)` — every ETF with **premium worth selling**: `type === "etf"`, **not** inverse at any gearing (`isInverseFund` — a call on a fund that shorts an index is a bullish bet on it), **not** a VIX-futures fund (`isVolFuturesFund` — VXX/VIXY/UVXY, barred by name so an un-curated one cannot slip in), no `hazard` on the shelf, and then IV ≥ `LEV_IV_MIN` if geared **or** IV ≥ `LEV_IV_MIN_1X` if 1x, plus price × volume ≥ `LEV_MIN_DOLLAR_VOL` and weeklyBuckets ≥ `LEV_MIN_LADDER`. **Two IV floors on purpose:** a 3x fund at 50 % implies ~17 % on its index, a 1x fund at 45 % *is* 45 %, so the same number means different things and each is measured against what the fund is. Liquidity is in **dollars**, not shares — RETL turns over more shares than DPST and a fifth of the money. A fund off the curated shelf still qualifies on its name, so a new launch needs no code change. | ingest (IV + price + volume + ladder) |
| `levmix`| LEVMIX | leverage | `pickLevMix(levhiv)` — LEVHIV thinned to **one name per bet**, richest IV first: a name is taken only if its exposure **family** is unused, its correlated **theme** is unused, and no family already taken is **adjacent** to it in the overlap graph (`leveraged.ts`). For a fund the geared shelf does not curate, the **theme becomes the family**, which is what makes the graph reach cash funds (EWZ's "Emerging markets" is adjacent to China, so a Brazil fund does not join a Korea fund); ticker only when there is no theme either, so two unknowns are never merged. Set-valued: whether a fund is in depends on which others outrank it that day. | same as LEVHIV |
| `etfhiv`| ETFHIV | margin | `isPlainWritable(s)` — the same shelf **unleveraged only** (2x/3x excluded outright, inverse and VIX funds as everywhere) with IV ≥ `ETF_IV_MIN` (30 %) plus the shared liquidity and ladder floors. The floor is **lower** than either LEVHIV arm on purpose: this list is about what the account can afford to hold, not where premium is richest. Measured on this book (`option_harvest_position_margin`, IB what-if, 2026-09-09), maintenance as a share of assignment notional was **SOXL 47.3 %** against **SOXX 16.4 %** for the same semiconductor bet — 2.9×, and buying power is what `R-MARGIN` reports as the binding constraint. n=1 on the geared side (1 of the book's 11 geared legs has a what-if row), so that is consistent with the premise rather than proof of it; the mechanism (IB's house multiple on geared funds) is not in doubt. | ingest (IV + price + volume + ladder) |
| `etfmix`| ETFMIX | margin | `pickLevMix(etfhiv)` — ETFHIV thinned the same way, so the list is sector-spread by construction: the silver miners collapse to one name, oil and oil services to one, SOXX/SMH/ARKK/IGV/EWT to one. This is the list to write across when maintenance margin, not premium, is the scarce resource. | same as ETFHIV |

Family notes / invariants:
- **screen** — the doctrine's naked-call funnel. `NCcan = NC − held`; see docs/spec.md §3 and docs/strategy.md.
- **position** — mirror the IB book. Cpos/Ppos are per-side; RED is the risk overlay: it needs greeks *or* a fresh mark (since 2026-08, a leg with no usable IB measurement is priced off its mark instead of dropping out of the list — see docs/spec.md § 4.9).
- **IV** — volatility funnel: `HIVSC ⊆ HIVS ⊆ HIV`. HIV is the high-IV universe that also has a tradable 1/2/3/4-week option ladder (so there's near-term premium to sell), HIVS narrows to a tradable price band, HIVSC removes anything you already have an option position on (so it's the actionable "write here next" IV list — the IV analogue of NCcan).
- **target** — OTC is the flag/hold-driven call-writing queue; a name leaves OTC the moment a call is written on it (it becomes Cpos).
- **value** — ROIC is the standalone value-quality universe (the `/roic` screen), independent of positions/IV; it's the pool you'd sell cash-backed puts into on a panic. ETFs are excluded (no ROIC).
- **margin** — ETFHIV/ETFMIX are the geared pair's answer to the cost the geared pair ignores. Premium is not the only price of a short call: a 3x fund consumes multiples of the maintenance margin of the same exposure held cash, and since `R-MARGIN` reports buying power (not the market) as this book's binding constraint, a fund that pays half the premium at a fifth of the margin can be the better trade. Hence a **lower** IV floor (30 %) than the geared list, and no 2x/3x at all. The two pairs deliberately overlap on 1x funds: LEVHIV admits them at 40 % because it asks "where is premium richest", ETFHIV at 30 % because it asks "what fits".
  - **Judgement calls in the theme map, visible so they can be revisited.** `EWT` is filed under Semiconductors (55 % TSMC — a Taiwan fund is a chip bet, not a diversifier from one) and `ARKK` under US technology (TSLA/COIN/PLTR is neither software nor semis, but no macro turn re-rates chips without re-rating it). `EWY` stays with China despite ~35 % Samsung + Hynix, because the regional cycle is the larger part of it — that is the first line to revisit if the mix ever looks like it double-counts Asia.
- **leverage** — LEV is the 2x/3x **long** ETF shelf (`lib/leveraged.ts`, self-check `scripts/leveraged-check.ts`): the structurally richest call premium in the universe, where daily-rebalancing decay works *for* the writer. Inverse funds are deliberately absent — writing a call on a `-3x` fund is a *bullish* index bet, the opposite of the NC book. Membership is a static property of the instrument's name, so `/wl-log` only shows a LEV change when the universe itself gains/drops a fund. Classification is name-based (Yahoo exposes no leverage field); the sponsors' naming is rigidly conventional, and the check pins every fund currently tracked. LEVHIV/LEVMIX sit on top of it and are **not** geared-only (see below): the family keeps the `LEV` prefix because the IB list ids and names are pushed by it, but the question they answer is "which ETFs pay enough to write, and which of those are different bets".
  - **`LEV_ETFS` — the curated shelf** (`lib/leveraged.ts`) is what the ingest universe, these three lists and the risk engine's theme map all read. Each of the 47 funds carries a **factor** (confirmed against its own name), an exposure **family**, its **driver** in plain terms, a correlated **theme**, and optionally a **hazard**. Two things the classifier cannot know live here: *what moves it* ("Homebuilders & Supplies Bull 3X" is a mortgage-rate bet, and the name never says so) and *what it duplicates*.
  - **Families and the overlap graph** — a family is the finest cut that is genuinely one bet (Gold, Gold miners and Silver are three families, one theme); the graph names families that move together without being identical, declared one-directionally and applied symmetrically. It is the executable form of the operator's own "與哪些容易重複" column, and it is the only thing LEVMIX selects against. Adjacency is deliberately asymmetric in meaning: housing/REITs/the long bond collapse to one bet, while Utilities stays separate — adjacent to the long bond and to REITs, but AI power demand is not housing.
  - **`hazard` = watched, never written.** UVXY is on the shelf (the operator asked to watch it) and barred from LEVHIV/LEVMIX no matter how rich its IV: a naked call on a VIX-futures fund is the one position here whose loss the strategy cannot size, and it spikes precisely when every other name on the shelf is falling. Note the accident that its name (`… Short-Term Futures …`) also trips the inverse guard, so it never enters LEV either — the check pins both facts separately, because relying on the accident would be relying on a regex. Since 2026-09-08 the whole *category* is barred by name (`isVolFuturesFund`: `\bVIX\b` or "volatility short/mid-term|index|futures"), so VXX and VIXY are out before anyone curates them — while "Volatility Shares 2x Ether ETF" (a sponsor name, not a vol fund) stays in.
  - **1x funds are admitted, inverse funds never** (2026-09-08, at operator request). The leverage was never the point — the premium was — so an unleveraged ETF clearing `LEV_IV_MIN_1X` (40 %, the NC screen's own floor) belongs on a premium list. This made `isInverseFund` load-bearing: `leverageFactor` returns null for an inverse fund *and* for an unleveraged one, which did not matter while only geared funds were screened. Now SH (−1x) and XLE are both "factor null" and only one of them is writable. The word test is deliberately broad (a "Short Term Treasury" fund is wrongly excluded and loses nothing — it has no premium anyway); a false negative would put a bullish index bet on a sell list.
  - **Themes, not the sector bucket.** Every geared fund's `theme` is merged into `lib/bookrisk`'s theme map. Without it these funds fall back to their sector, and their sector is the single bucket "Leveraged / Inverse" — the SC-B1 credit cap would then read a utilities 3x and a defense 3x as one bet, and a gold 2x and a China 3x as the same one. The shelf brought its unleveraged siblings with it (DPST clusters with XLF/KRE/KBE, NAIL with ITB/XHB, and so on), so a geared fund and its cash sibling can never look like two themes.

**Adding a new OH list** (requirement checklist): add it to `computeOhWatchlists`
(`watchlists.ts`) **and** to `LIST_META` + a `reasonFor` case in
`ohhistory.ts` (so `/wl-log` tracks its day-over-day add/remove with a reason),
append it **last** (id stability), then update this table, docs/spec.md, and
CLAUDE.md. The `/watchlists` page and the OH→IB push pick it up automatically
(both iterate `computeOhWatchlists`), so no extension change is needed. If membership
depends on the whole day's set rather than one row (LEVMIX), give the `LIST_META` entry a
`select(rows)` as well — `inList` alone cannot express "one name per family".

**A new list's members need conids** before the OH→IB push can carry them: a ticker with
no resolved conid is reported under `missing` and skipped (§3). After the universe gains
tickers, run the popup's **Resolve conids (backfill)** once.

### IB — synced, stored
The user's IB lists, pulled in by the extension and stored in
**`option_harvest_watchlist`** (`WatchlistItem`). One row per (list, instrument);
**replaced wholesale on every sync** (delete-all + recreate), so lists deleted in
IB drop out automatically on the next pull. Read back grouped + list-ordered by
`getIbWatchlists()`. Lists named `OH:*` are **excluded** on both ingest and read —
those are OH's own pushed lists (§4d), not the user's.

Columns: `watchlist_id`, `watchlist_name`, `position` (order in list), `conid`,
`ticker`, `name`, `sec_type`, `asset_class`, `raw`, `synced_at`.

---

## 2. The `/watchlists` page

`src/app/watchlists/page.tsx` → `WatchlistBrowser` (client). Mirrors the Analyzer:

- **Left-nav tabs** in two groups — **Option Harvester** (all 15 computed lists:
  NC, NCcan, Cpos, Ppos, RED, HIV, HIVS, HIVSC, OTC, ROIC, LEV, LEVHIV, LEVMIX, ETFHIV, ETFMIX — built dynamically from
  `computeOhWatchlists`, so a new OH list appears here automatically) and
  **Interactive Brokers** (the synced lists) — each with a member count.
- **Table view** = the Analyzer's wide table (`WideStockList`): a three-line left
  block per name (basic / sortable stats — Last/Chg%/IV/rank/Harvester/Vol/Cap/Record
  + highlighted **Pos** / option-meta + a per-instrument "last updated" freshness
  stamp), with the 1M/3M/6M/1Y trend charts in a single row of four on the right, plus
  row-expand (`PositionDetail` + `OptionDetail`) and live star/target/label marks
  (`POST /api/marks`). The list scrolls within the page; left-nav + header stay fixed.
- Selecting a tab filters the tracked universe to that list's tickers.
- Header shows the active list's source badge, name, and — for IB lists carrying
  names outside the tracked universe (crypto/non-US) — "**X of Y shown · N not in
  universe**". Untracked names have no screen data, so they don't render as rows.

---

## 3. Prerequisite — conid backfill

IB keys everything by **conid** (contract id), not ticker. `securities.conid`
(nullable) holds the underlying conid, backfilled once via the extension:

- `GET /api/securities/conids` → tickers still missing a conid.
- Extension resolves them in the logged-in IB page via `/trsrv/stocks?symbols=…`
  (batched 50). A symbol isn't unique in IB, so `parseIbStocks` disambiguates in two
  steps: pick the **company** entry whose IB name best matches our (Yahoo) name — not
  just the first US one, which fixes symbol reuse / stale rename listings — then pick
  its **US** exchange contract, falling back to the first listing for non-US-only names.
  Then `POST /api/securities/conids` (`{ ibStocks }` raw, or `{ conids }`).
- Coverage: dot class-shares (BRK.B / BF.B) are queried in IB's space form
  (`BRK B` / `BF B`) and mapped back to the dot ticker, so they resolve too.

Popup action: **Resolve conids (backfill)**. One-time; conids rarely change.

### Correct-conid pins (when /trsrv picks the wrong listing)

`/trsrv/stocks` resolves a *symbol* to a conid, and for ambiguous symbols it can pick
the wrong listing (e.g. `SMCI`, `DOW`, an old renamed listing). Last session's fix —
prefer the **held position's** conid — only helps names where the underlying stock is
held; a **naked** book holds options, not the stock, so it can't. Two corrections:

- **`option_harvest_security_conids`** (the pin registry) holds known-correct conids.
  A pin **beats** the `/trsrv` value, is **mirrored into `Security.conid`** (so every
  consumer uses it), and **survives the periodic full re-resolve** (which now *skips*
  pinned tickers). Two sources:
  - **`manual`** — user-pinned via `POST /api/security-conids { overrides:{TICKER:conid} }`
    (e.g. `SMCI=731466419`). Never auto-overwritten.
  - **`ib-option`** — derived from a **held option leg's underlying** (`undConid`, which
    IB reports authoritatively): the popup **Fix conids from held options** action (and
    manual Sync) asks IB for each held-option ticker's underlying and pins it — **but only
    after validating** that IB reports the underlying's own symbol == our ticker. The
    option `undConid` is occasionally a different instrument / a conid IB won't accept in
    a watchlist (e.g. LVS); an unvalidated one is **not** pinned, and a stale bad
    `ib-option` pin is **dropped** so the name-matched `/trsrv` re-resolve corrects it in
    the same sync (resolveUnderlyings runs before the re-resolve). This is the
    self-recognition path — identity from our (Yahoo) symbol, conid from IB's
    name-matched resolve; the option-underlying only overrides when it provably matches.
- `buildOhPushLists` conid priority is therefore: **pin → held-stock position → /trsrv**.

---

## 4. Sync flows (Chrome extension)

All run in the user's **logged-in IB portal tab** (session cookies) and target the
backend in the popup (default prod `http://114.33.62.221:19210`). The extension is
manifest v3; **bump `manifest.json` version on every edit**.

### 4a. IB → web  (popup: **Sync now** / **Quick sync**; auto-sync; sync-on-login)
`fetchAllInPage` also pulls watchlists: `GET /iserver/watchlists` (the
`data.user_lists`) → `GET /iserver/watchlist?id=<id>` per list → `POST /api/watchlist
{ ibWatchlists }`. The endpoint parses (`parseIbPortalWatchlists`) and
**deleteMany + createMany** — a full replace. It runs alongside positions/orders/
trades/balances, then pushes OH → IB (4b) and reads the result back (4f).

**Three tiers, since 0.9.10** (`extension/background.js`):

| Button | Runs | Cost | Logged as |
| --- | --- | --- | --- |
| **Sync now** (`runAll`) | **everything**, in dependency order: the pull → batched greeks → IB's 30-day IV for every underlying → exact margin (what-if) → underlying + conid re-resolve → OH push → read-back verify | 2–5 min, **needs the IB tab in front** | `full` |
| **Quick sync** (`runSync`) | the pull alone: positions/orders/trades/watchlists/balances + greeks + OH push/verify | seconds, background-safe | `quick` |
| **Deep sync** (`runDeep`) | the heavy passes only, no re-pull — for when positions are already current | 2–5 min, needs the tab in front | `deep` |

**Why "Sync now" is the everything button.** It used to be the fast pull, which meant the
dashboard could show a minutes-old delta beside a days-old margin with nothing on the page
to say so — the operator's reasonable reading of "Sync now" is "the data is now current".
Quick sync is the escape hatch that keeps the old behaviour when only positions and
balances matter.

Two ordering rules inside the full run, both load-bearing: the pull goes **first**
(every heavy pass asks the backend which conids to measure), and the OH push goes
**last** (conid/underlying re-resolution changes what the lists should contain, so
pushing before it would send IB conids that are about to be corrected). The light phase
therefore runs with `deferOh` and `skipLog`, and the whole run files **one** `/sync` row.

**Auto-sync and sync-on-login stay on the quick path** — deliberately. They fire
unattended (a 15-minute alarm; the not-ready→ready login edge), and the heavy passes are
paced by in-page `setTimeout`s that Chrome throttles to a crawl in a backgrounded tab, so
a 2–5 minute foreground-dependent run has no business on a timer. Both take greeks
**when the IB tab happens to be the one on screen** (`withGreeks: "foreground"`), which is
the most that can be promised without hijacking the screen.

**IB IV keeps itself current (0.9.13+).** The full 7283 sweep is a 2–5 minute
foreground-bound run and belongs to **Sync now**. But a value that only moves when someone
presses a button goes a week stale, so the **unattended** syncs (timer + login edge) also top
up a bounded slice while the IB tab happens to be in front: `GET
/api/underlying-iv?staleHours=48&limit=120`, oldest first with never-measured names ahead of
merely-old ones, one round, ~15s. 660 instruments against a 48-hour floor converge on their
own. The operator's own tolerance is the design input here — two or three days behind is
acceptable, a week is not.

**Version gate (0.9.11+).** Every request carries `X-OH-Ext-Version`, and
`src/middleware.ts` refuses **writes** from installs below `MIN_EXT_VERSION`
(`src/lib/extversion.ts`) with `409 { staleExtension: true, minVersion }`. The extension
treats that as an order to stand down: it clears both alarms, stores `staleBlocked`, and
every popup action answers with "this install is out of date" until the folder is updated
and reloaded (the block clears itself when the manifest version reaches the minimum).

Reads pass, and `/api/ext-log` is exempt — that route is how a stale install identifies
itself, and blocking it would remove the only evidence it exists. A request with **no**
version header is also allowed: the web app, the `npm run` scripts and curl send none, and
refusing what cannot be identified would break them while still not stopping the installs
this was written for. So pre-0.9.11 copies are *named* instead: `/sync` lists every install
whose **newest** report is stale (grouped by `extId`, dated by `clientAt` where present, so
an install's own history and a drained report queue don't masquerade as live copies). The
banner clearing is the confirmation the old folder is gone.

Why it matters: on 2026-09-10 a 0.9.6 copy was still running its login watcher every 15
minutes beside 0.9.10. Two installs against one IB tab compete for IB's finite market-data
lines (a greeks batch that should return 49 contracts returns some of 49) and both write the
same shapes, so `/sync`'s freshness stamps belong to whichever ran last with nothing on the
page to say which.

**Sync on IB login** (popup checkbox, **on by default**) runs that same light path
**once per login**, so the OH↔IB watchlists are in sync the moment a session exists
without touching the popup. It is an *edge* trigger, not a poll of the data: a
`loginwatch` alarm (1 min) plus every IB-tab navigation probes each open IB tab
in-page (`ibSessionInPage`), and the sync fires on the **not-ready → ready**
transition (`ibAuthed` in `chrome.storage.local`, reset on browser start / logout).

**"Logged in" ≠ "usable".** The portal stages a login — SSO cookie → brokerage
session → trading permissions — and renders long before the last stage lands, so
`/iserver/accounts` answering is not sufficient. The readiness gate is three-part:
`GET /iserver/auth/status` (rejects `authenticated: false`, `competing`, `connected:
false`; GET via the portal proxy, POST as fallback) → an account id → the two reads
the sync actually consumes (`/portfolio/{acct}/summary`, `/portfolio/{acct}/
positions/all`). Anything not ready yet reports *why* into the popup log
("positions not available yet", "competing IB session") and waits for the next tick.

**The login edge is only spent on a productive run** — IB returned an account **and**
the OH→IB push got every list in (`pushed === total`; a session that reads but can't
write yet fails exactly there). An unproductive run clears the cooldown and leaves
`ibAuthed` false, so the 1-minute watcher retries — up to `LOGIN_SYNC_MAX_TRIES` (8)
per login, then it gives up with `login sync gave up after 8 tries — use Sync now`
rather than hammering. A logout resets the budget. Other guards: it never stacks on a
live op (fresh `busyBeat`) and never re-fires within a **10-minute cooldown**. Runs
post `source: "login"` to `/api/sync-log` (green badge in the `/sync` run history).

### 4e. Deep sync  (popup: **Deep sync (greeks/margin/conids)**)
The heavy passes are separate: per-held-contract greeks, per-contract margin what-if,
validated held-option underlying resolution, and the full ~600-symbol conid re-resolve;
then OH lists are re-pushed and verified because conids may have changed. Run **Sync
now first** so the backend has fresh position targets, and keep the IB tab in the
foreground—Chrome throttles the in-page `setTimeout` pacing in background tabs.

The MV3 worker persists `busy`/progress state in `chrome.storage.local`, refreshes a
15-second heartbeat, and timestamps every status. Reopening the popup shows the live
step/item count (`greeks 12/97`, `margin 5/97`, etc.); a stale heartbeat clears an
orphaned busy flag. Deep runs post `source: "deep"` to `/api/sync-log`.

### 4b. web → IB  (popup: **Push OH → IB watchlists**, and part of Sync now)
Publishes the OH lists to IB as **`OH:NC`, `OH:NCcan`, `OH:Cpos`, `OH:Ppos`, `OH:RED`, `OH:HIV`, `OH:HIVS`, `OH:HIVSC`, `OH:OTC`, `OH:ROIC`**.

- `GET /api/oh-watchlists` → each list with a suggested id (990001–990010), `OH:`-prefixed
  name, and IB-ready `rows:[{C: conid}]` (conids from `securities.conid`; names
  without one are reported in `missing` and skipped).
- IB has **no in-place edit**, so push = **delete + recreate**. The extension deletes
  only lists that are **ours** — `OH:*`-named *or* an id it recorded creating last push
  (tracked in `chrome.storage.local.ohListIds`) — then `POST /iserver/watchlist
  { id, name, rows }` and records IB's assigned id for next time.
- **Safety invariant: the push never deletes or overwrites a list it didn't create.**
  Two guards:
  1. **Deletion** touches only `OH:*`-named lists (a user list is never `OH:*`-named)
     or ids we tracked creating.
  2. **Creation** — a `POST` with an existing `id` *overwrites* that list, so the create
     id is bumped off **every surviving list id from a COMPLETE enumeration** (both
     `/iserver/watchlists` and `?SC=USER_WATCHLIST`, merged) — never just one scoped
     call. This is the v0.8.8 fix: a user list `W` was clobbered because the old push
     enumerated with only `?SC=USER_WATCHLIST`, so an unseen user-list id collided with
     a fixed OH id (worsened when HIV added a 6th id, 990006). (Earlier v0.8.5 fix
     stopped a blind delete-by-fixed-id.) Re-pushing refreshes lists to the current
     screen/positions. **Create is verified + self-healing**: IB's create can return ok
     but store 0 rows, and it rejects a create *wholesale* if any one row is bad (e.g. a
     mis-resolved underlying conid). So after each create the extension reads the list
     back; if the count is short it retries (transient), and if a row is being rejected
     it **bisects to drop the offending conid(s)**, stores the rest, and reports the
     dropped conids (popup + `results[].dropped`). This kept `OH:Cpos` from being lost
     to one bad conid (v0.8.9 read-back-retry, v0.8.10 drop-and-report).

### 4f. Read-back verification  (part of Sync now; popup: **Verify OH lists**)
Closes the loop on the push (4b): after publishing the `OH:*` lists, the extension
**re-fetches** them from IB (`GET /iserver/watchlist?id=<ohid>` per `OH:*` list) and
POSTs the conids it got back to **`POST /api/oh-verify`**. The endpoint rebuilds the
*intended* payload (`buildOhPushLists` in `src/lib/ohpush.ts` — the exact same source
`oh-watchlists` GET feeds the push) and **diffs** it against what IB stored, per list:

- **missing** = a conid we intended but IB didn't store;
- **extra** = a conid IB stored that we didn't intend (the stale "wrong FXI" case —
  e.g. IB holding `13049078` where we pushed the held `31421120`).

A list is `ok` when both are empty. The latest result (matched / mismatched counts +
per-list diff) is stored in `option_harvest_oh_verify` and shown on **/sync** under
"OH → IB push verification" — so a bad push surfaces automatically, without eyeballing
the lists in the IB app. Runs whenever the push ran (**Sync now**, auto-sync, or
**Deep sync**), since the `OH:*` lists are deliberately excluded from the normal pull
(§4d) and this is the only programmatic read of what IB actually stored.

**Read-back timing (extension ≥ 0.9.3).** IB does not make a just-created list
readable atomically, so a read-back fired immediately after the push can return
*short* lists — a bogus `verify ⚠N` where every diff is `missing` and none is `extra`
(observed 2026-08-19: 156 missing at push+0 s, **0** on the re-verify 23 s later). The
extension therefore settles `OH_VERIFY_SETTLE_MS` (2.5 s) before reading, and if the
only diff is missing conids it re-reads once more before posting the verdict. A
mismatch containing **extra** conids is never retried — that's a real wrong-conid
finding. Both attempts are recorded in `option_harvest_oh_verify` (the panel shows the
latest), so the history keeps the evidence.

### 4c. Removal
No dedicated delete flow is needed: deleting a list in IB and running **Sync now**
(4a) removes it from the web (wholesale replace). Deleting an OH list in IB and
re-running **Push OH** (4b) recreates it.

### 4d. OH:* exclusion (no round-trip)
The `OH:*` lists we push to IB (4b) must **not** be pulled back in as IB lists.
They're filtered by the `OH:` name prefix at three layers:
1. **Extension** — `fetchAllInPage` skips `user_lists` whose name starts with `OH:`
   (never fetched/posted).
2. **Ingest parser** — `parseIbPortalWatchlists` drops `OH:*` lists server-side
   (guards against an older extension).
3. **Reader** — `getIbWatchlists` excludes `OH:*` from the page.

So `OH:*` exists in IB (from the push) but on `/watchlists` shows **only** as the
computed **OH** tabs — never in the IB section. The prefix is the marker, so don't
name a genuine IB list `OH:*`.

---

## 5. Endpoints

Backend (`src/app/api`):
- `watchlist` — `POST { ibWatchlists }` full-replace store; `DELETE` clears.
- `oh-watchlists` — `GET` → OH lists with conid rows for the push.
- `oh-verify` — `POST { verified:[{name,conids}] }` → diff IB's read-back against the
  intended payload (§4f), store in `option_harvest_oh_verify`; `GET` → latest result.
- `securities/conids` — `GET` missing tickers; `POST { ibStocks | conids }` store
  (skips pinned tickers so corrections aren't clobbered).
- `security-conids` — `POST { overrides }` manual correct-conid pins (sticky, mirrored
  into `securities.conid`); `GET` lists pins.
- `underlying-conids` — `GET` held-option representative conids per ticker; `POST
  { resolved:[{ticker,undConid}] }` pins the IB-derived underlying (source `ib-option`).
- `options` — `GET?tickers=` → ticker→conid; `POST { fetched }` → IB option snapshot
  into the `ib_*` quote columns (see docs/spec.md; drives the `/ib` compare page).
- `greeks` — `GET` → held option conids `[{conid,ticker,desc}]`; `POST { fetched }` →
  per-contract greeks into `option_harvest_option_greeks` (upsert by conid, non-null
  fields only). In-page: the extension snapshots held conids in **batches** — a
  comma-separated conid list to `/iserver/marketdata/snapshot?conids=…&fields=…,7308,7309,7310,7311`,
  polling the whole batch until each conid's delta appears (greeks compute
  server-side after subscribe; best coverage during US market hours). Batching all
  conids per subscribe burst is much faster than one contract at a time (chunked to
  stay under IB's market-data line limit). Run by **Deep sync** or the standalone
  **Get greeks (IB)** button. Drives the P&L Predict Δ/Θ/Γ columns.
- `margin` — `GET` → held option conids with the closing order params
  `[{conid,ticker,desc,side,quantity}]`; `POST { fetched }` → per-contract margin into
  `option_harvest_position_margin` (upsert by conid, non-null only). In-page: for each
  held conid the extension what-ifs a **closing** MKT order via
  `POST /iserver/account/{acct}/orders/whatif`; the position's requirement =
  `maintenance.current − maintenance.after`. Drives the Positions maintenance-margin
  column/tile.
- `balances` — `POST { summary, acct }` (the IB `/portfolio/{acct}/summary`) → daily
  snapshot in `option_harvest_account_balances` (cash / NLV / RegT / init+maint margin;
  stock-vs-option value computed from positions). Pulled on every sync (manual + auto).
  Drives the `/sync` balances panel.

IB Client Portal API (called in-page by the extension):
`/iserver/watchlists`, `/iserver/watchlist` (GET/POST/DELETE), `/trsrv/stocks`,
`/iserver/secdef/search|strikes|info`, `/iserver/marketdata/snapshot`,
`/iserver/account/{acct}/orders/whatif`, `/portfolio/{acct}/summary`.

Libs: `src/lib/watchlists.ts` (OH definitions + IB reader), `src/lib/ohpush.ts`
(`buildOhPushLists` — intended OH→IB push payload, shared by `oh-watchlists` +
`oh-verify`), `src/lib/ibparse.ts`
(`parseIbPortalWatchlists`, `parseIbStocks`, `parseIbOptionSnapshot`, `parseIbPositionGreeks`, `parseIbPositionMargin`).

---

## 6. Ownership & safety

- **Writes to the live IB account** (4b) happen only through the extension in the
  user's session, and only against `OH:*` lists.
- Per CLAUDE.md the extension posts to **prod** by default (the only port reachable
  outside the NAT); the `/api/watchlist` and `/api/securities/conids` writes are
  additive to our own tables.
- OH lists are computed, so they reflect data as of the last ingest/position sync —
  push after a fresh **Sync now** to publish current membership.
