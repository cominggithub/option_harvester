# Data sources — two channels, one book

Every IBKR number in this app arrives through one of **two independent channels**. They can
write the same tables, they fail differently, and one of them (`ib-agent`) can stop working
at any moment without warning. This file is the contract that keeps that from corrupting the
book or misleading a reader.

Companions: `docs/ib-agent-integration.md` (how the CLI channel works and what it will never
do), `docs/ib-gateway-requirements.md` (what data the Gateway channel must deliver to own a
dataset), `docs/watchlists.md` (the IB/OH list model), `CLAUDE.md` (ops).

---

## 1. The channels

| Source | What it is | Needs | Fails when |
|---|---|---|---|
| **`ext`** | Chrome extension, borrowing the logged-in Client Portal session | a browser, an IB login, the IB tab in the **foreground** for anything paced by a timer | the session drops, the tab is backgrounded, the install is out of date, or the machine is asleep |
| **`ib-agent`** | read-only `ib-agent` CLI over ib_agent's headless Gateway (TWS socket) or Flex | a Gateway session (2FA at login), the CLI installed | IBKR revokes/expires the session, the entitlement lapses, the Gateway hangs, or no snapshot has been stored |
| **`csv`** | an IB CSV export uploaded by hand (`/upload`) | a human | — |
| **`manual`** | pinned/entered by hand (e.g. conid pins) | a human | — |

Vocabulary, guard and health live in **`src/lib/datasource.ts`**; the CLI client is
**`src/lib/ibagent.ts`**; the writes both channels share are **`src/lib/syncwrite.ts`**.

Measured on this box, 2026-09-14 — the reason none of this is theoretical:
`ib-agent status` reported `ready: true` while `positions --stored` exited **4** (no snapshot
stored at all), and a live `sync` was still hanging on *"executions request timed out"* past
90 s. A channel can be simultaneously "up" and useless.

## 2. What is recorded

**Per row** — `source` on `option_harvest_{positions, orders, transactions, watchlist,
option_greeks, position_margin, account_balances}`. Answers *whose data am I looking at*,
independent of any channel's claim. `null` on rows written before 2026-09-14; the UI calls
those out rather than attributing them to a guess. The full-replace datasets (positions,
orders, watchlists) self-heal on the next sync; the keyed ones (greeks, margin, balances)
heal per conid / per day.

**Per attempt** — `option_harvest_sync_state`, keyed `(dataset, source)`: last attempt, last
success, rows, the source's own `as_of`, consecutive failures, last error, and the last
**refusal**. This is the only record of an attempt that wrote *nothing*, which is precisely
the attempt you need to see.

**Per run** — `option_harvest_sync_runs.channel` (`ext` | `ib-agent`) beside the existing
`source` tier (`full`/`quick`/`auto`/`login`/`deep` for the extension; `stored`/`live`/
`shadow` for the CLI). Kept separate so "when did the extension last run?" survives a second
channel posting into the same history.

All three are rendered on **`/sync` → Data sources · channels**: rows held and whose,
each channel's state per dataset, and the last refusal.

## 3. The replace guard

`checkReplace` (pure, asserted by `scripts/datasource-check.ts`) sits in front of every
full-replace write. Three refusals:

| Code | Fires when | Why it exists |
|---|---|---|
| `empty` | the payload is empty and the dataset says empty is not a state (positions, watchlists) | an empty read is the most common shape of a failed read, and it used to delete the book |
| `shrink` | the payload keeps less than half of what we hold (positions, watchlists) | the half-answered payload — 12 legs replacing 51 — is valid-looking and invisible to an empty check |
| `backwards` | an older snapshot would overwrite **the other channel's** newer data | the cross-channel rule: a stored ib_agent snapshot from this morning must not clobber an extension pull from five minutes ago |

Deliberate exceptions, all of them semantic rather than convenient:

- **orders may go to zero.** Every working order can fill or cancel; refusing zero would pin
  dead orders on the page. (And IB's own caveat: orders placed from IBKR Mobile are invisible
  to a client id without `OverrideTwsMasterClientID`, so an empty list from ib_agent is not
  proof that nothing is working.)
- **transactions are additive**, so there is no replace to guard — the risk there is a
  duplicate, handled by `selectNewTrades`.
- **balances** are one upserted row per day, and a row with no `NetLiquidation` is refused:
  the slot is unique per date, so overwriting a good snapshot with nulls loses that day
  forever.
- **`csv` and re-imports pass `force`** — a human chose the file.

A refusal is a **success of the system**: nothing is written, the previous data stands, the
reason is recorded and shown, and the route answers **409** (not 4xx-as-bad-request, not
200-as-if-it-worked).

Writes are also **atomic**: delete + insert run in one transaction, so a killed subprocess or
a crashed request cannot leave a table observably empty.

## 4. Who owns what

| Dataset | Channel today | Notes |
|---|---|---|
| positions | `ext` (ib-agent in shadow) | `npm run sync:ib` diffs the two; `--write` cuts over |
| balances | `ext` (ib-agent in shadow) | ib_agent maps IB's socket tags; `RegT*` may be absent and stays null rather than approximated |
| orders | `ext` | ib_agent path implemented, needs `OverrideTwsMasterClientID` to see mobile orders |
| transactions | `ext` (portal ≈7d window) + `csv` history | ib_agent's socket gives **today** only; longer history needs Flex |
| greeks | `ext` | cut over only when delta coverage matches — RED excludes names with no delta, so a gap hides assignment risk |
| **margin** | `ext` — permanently | a what-if travels as an order message; `ReadOnlyApi=yes` rejects it, and that gate stays shut |
| **watchlists (IB in)** | `ext` — permanently | the TWS socket API has no watchlist calls at all |
| **OH→IB push + verify** | `ext` — permanently | same reason |

## 5. Running the ib_agent channel

```bash
npm run sync:ib                     # shadow: fetch, parse, diff, write NOTHING
npm run sync:ib -- --only positions # one flow at a time
npm run sync:ib:test -- --write     # the sanctioned write path (test DB)
npm run sync:ib -- --live           # ask the Gateway instead of the stored snapshot
npm run sync:ib -- --strict         # non-zero exit when a channel is unusable (for cron)
```

Behaviour that matters:

- **Shadow is the default.** A cutover is reviewed as a diff first (§ 6 of
  `docs/ib-agent-integration.md`: one flow at a time, differences resolved in the parser, not
  by loosening the diff).
- **Every CLI call has a kill timeout.** A hang is bounded and recorded as `timeout`.
- **A dead channel changes nothing** — it records `channel`/dataset failures and exits 0
  (or 3 under `--strict`), leaving whatever the extension wrote in place.
- **Snapshot age is bounded** (`--max-age-min`, default 12 h): an old stored snapshot is
  refused rather than written as current.
- **Nothing in the request path calls the CLI.** Pages read the DB only, so a hung Gateway
  can never hang a render.

## 6. Adding a dataset or a channel

1. Add the row-level `source` column and the dataset to `SYNC_DATASETS` + `REPLACE_POLICY`
   (decide `allowEmpty` on semantics, not on convenience).
2. Write through `src/lib/syncwrite.ts` — never `deleteMany` + `createMany` in a route.
3. Attribute the write with `sourceFromRequest` (header first: the extension cannot forget
   `X-OH-Ext-Version`; `X-OH-Source` for anything else).
4. Record the attempt with `recordSyncAttempt`, including the ones that write nothing.
5. Assert the new branches in `scripts/datasource-check.ts` (`npm run check:sources`).
