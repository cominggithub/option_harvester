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
OH→IB push so membership has one source of truth.

| Key    | Name    | Membership rule |
| ------ | ------- | --------------- |
| `nc`   | NC      | `s.nc` — the Analyzer "Naked Call" screen (`isNcTarget`): 1M/3M/6M all not-up, volume > 3M, price $20–180, weekly buckets ≥ 5, IV > 40%, stocks **and** ETFs. |
| `nccan`| NCcan   | `s.nc && !s.held` — short-call candidates: in NC but no position held yet. |
| `cpos` | Cpos    | `s.position.call !== 0` — underlyings you hold a **call** option on. |
| `ppos` | Ppos    | `s.position.put !== 0` — underlyings you hold a **put** option on. |
| `red`  | RED     | `s.position && maxOptAbsDelta > 0.30` — high assignment risk: held names whose largest option leg (call or put) has \|Δ\| > 0.30. Needs synced greeks. |

(NC = the doctrine's naked-call screen; see docs/spec.md §3 and docs/strategy.md.)

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

- **Left-nav tabs** in two groups — **Option Harvester** (NC, NCcan, Cpos, Ppos)
  and **Interactive Brokers** (the synced lists) — each with a member count.
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
    manual Sync) asks IB for each held-option ticker's underlying and pins it. This is
    the naked-strategy analogue of the held-stock-conid fix (fixes B/COIN/GDX/…).
- `buildOhPushLists` conid priority is therefore: **pin → held-stock position → /trsrv**.

---

## 4. Sync flows (Chrome extension)

All run in the user's **logged-in IB portal tab** (session cookies) and target the
backend in the popup (default prod `http://114.33.62.221:19210`). The extension is
manifest v3; **bump `manifest.json` version on every edit**.

### 4a. IB → web  (popup: **Sync now**)
`fetchAllInPage` also pulls watchlists: `GET /iserver/watchlists` (the
`data.user_lists`) → `GET /iserver/watchlist?id=<id>` per list → `POST /api/watchlist
{ ibWatchlists }`. The endpoint parses (`parseIbPortalWatchlists`) and
**deleteMany + createMany** — a full replace. Runs alongside positions/orders/trades.
**Sync now also fetches per-position greeks (4e) then pushes OH → IB (4b) at the end**
— positions are posted first, so both reflect the fresh snapshot. The OH push applies
to auto-sync too; **greeks do NOT** run on auto-sync (heavy: one snapshot per held
contract) — only on manual **Sync now** (or the standalone **Get greeks (IB)** button).

### 4b. web → IB  (popup: **Push OH → IB watchlists**, and part of Sync now)
Publishes the OH lists to IB as **`OH:NC`, `OH:NCcan`, `OH:Cpos`, `OH:Ppos`, `OH:RED`**.

- `GET /api/oh-watchlists` → each list with a suggested id (990001–990005), `OH:`-prefixed
  name, and IB-ready `rows:[{C: conid}]` (conids from `securities.conid`; names
  without one are reported in `missing` and skipped).
- IB has **no in-place edit**, so push = **delete + recreate**, but deletion is
  **by name only**: the extension deletes just the lists whose name starts with
  `OH:`, then `POST /iserver/watchlist { id, name, rows }`. The create id is bumped
  off any **user** list's id so a create can't overwrite one.
- **Safety invariant: the push only ever deletes `OH:*`-named lists — never a
  user's.** (IB assigns user-list ids in the same numeric range as our suggested OH
  ids, so deleting/creating by a bare id could clobber a user list — fixed in v0.8.5
  after an OH id collided with a user list `W` at id 990005.) Re-pushing refreshes
  them to the current screen/positions.

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
the lists in the IB app. Runs whenever the push ran (manual **Sync now** and auto),
since the `OH:*` lists are deliberately excluded from the normal pull (§4d) and this
is the only programmatic read of what IB actually stored.

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
  fields only). In-page: for each held conid the extension polls
  `/iserver/marketdata/snapshot?fields=…,7308,7309,7310,7311` until delta appears
  (greeks compute server-side after subscribe; best coverage during US market hours).
  Drives the P&L Predict Δ/Θ/Γ columns.
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
