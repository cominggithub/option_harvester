# option_harvester — next-session recap (as of 2026-07-21)

**Status:** everything listed below is implemented, validated, built, and deployed to
production (`114.33.62.221:19210`). This handoff is committed and pushed to
`origin/master`. The working tree should be clean except for daily generated
`predictions/cc-*.jsonl` files, which are intentionally untracked.

Ops reminder: production is the systemd unit `option_harvester`. Deploy only with
`npm run build` immediately followed by `sudo systemctl restart option_harvester`;
prod and test share `.next`, so a build without the restart breaks the live chunks.
Read **CLAUDE.md** before operating the app or databases.

## Shipped this session

1. **Extension v0.8.16 — fast Sync vs Deep sync.**
   - **Sync now** is the short, background-safe path: positions, orders, trades,
     watchlists, balances, OH push, and OH read-back verification. Auto-sync uses the
     same light path.
   - **Deep sync** is a separate button for per-contract greeks, margin what-ifs,
     held-option underlying resolution, full conid re-resolution, then OH re-push and
     verify. Keep the IB tab in front; Chrome throttles the in-page timers in a
     background tab. Run Sync now first so backend position targets are fresh.
   - The MV3 worker now persists busy/progress state, emits a 15-second heartbeat,
     timestamps status, detects orphaned runs, and reports live steps/items in the
     popup. Deep runs are stored with `source=deep` (`/api/sync-log`).
   - Extension source is v0.8.16. Reload it in `chrome://extensions` to use these UI
     and progress changes; HIVS itself does not require a new extension because OH
     lists are fetched dynamically.

2. **Test database isolation fixed.** Every `:test` script in `package.json` uses
   `dotenv -e .env.test -o`, so `.env.test` overrides a prod `DATABASE_URL` inherited
   from the shell/systemd environment. Verified both before and after importing Prisma.

3. **OTC OH watchlist + history.** `OTC` means “Option Targets, no Call”:
   `(target || held call || held put) && no held call`. It identifies flagged/held-option
   names where a call has not yet been written. The daily OH snapshot schema includes
   `target`; `/wl-log` tracks OTC entries/exits with reasons. The additive column exists
   in both owned databases.

4. **HIVS OH watchlist.** `HIVS` is exactly HIV (front-month ATM IV > 50%) restricted
   to strict spot bounds **price > $20 and price < $200**. It appears on `/watchlists`,
   in `/wl-log`, and in the OH→IB payload as `OH:HIVS` (suggested id 990007; OTC is
   990008). Production validation on July 21: HIV 151, HIVS 82, 0 missing conids;
   exact live predicate and HIVS⊆HIV passed. User Sync reported `OH→IB 8/8 · verify ✓`,
   so all eight lists were published and read back successfully.

5. **Shareable live Markdown for every UI page.** Each approved UI route has a
   read-only, on-demand Markdown mirror:
   - `/md/index.md`, `/md/watchlists.md`, `/md/pnl-predict.md`
   - dynamic example: `/md/stock/NVDA.md`
   - query parameters are preserved by the global TopNav **MD / Copy** control.

   `src/app/md/[[...path]]/route.ts` loopback-fetches only whitelisted UI routes,
   extracts `#page-content`, converts headings/tables/lists/links with Cheerio, strips
   scripts/styles/SVG, and returns `text/markdown`. It uses `no-store` (regenerated on
   every fetch), `noindex`, public source links, and blocks API/arbitrary-host proxying.
   `scripts/page-markdown-check.ts` covers URL mapping, content isolation, tables,
   links, and script removal. All 12 mirrors returned 200 in production; unsupported
   `/md/api/...` returned 404.

   **Security/behavior note:** these URLs expose the same current data as their web
   pages; `noindex` is not authentication. Client-only tab/filter changes that do not
   alter the URL are not represented—the mirror captures the server-rendered/default
   page state.

6. **P&L Predict Spot column.** Each expiry-detail table now shows current underlying
   **Spot immediately before Strike**. `buildOptionPnlByExpiry` carries
   `PositionGroup.price` into every `OptionPnlLeg`. Production validation: 86/86 option
   legs populated; HTML and `/md/pnl-predict.md` both render
   `Symbol | Type | Spot | Strike` (sample AG: spot 15.85, strike 22.00).

7. **Docs and validation.** Updated `CLAUDE.md`, `docs/spec.md`,
   `docs/watchlists.md`, and `docs/test-plan.md`. Final gates: TypeScript, diff check,
   Prisma schema validation, extension JavaScript syntax, P/L/position/news/Markdown
   self-checks, production build, systemd restart, route/API smoke tests.

## Current operating notes

- Prod: `http://114.33.62.221:19210`; test: port 19211 and
  database `option_harvester_test`.
- Data mutations belong on test only. Additive schema DDL is pushed to both owned
  databases. Never touch another project's database.
- Extension changes are not installed by a web deploy. Reload unpacked extension
  v0.8.16 manually when its Deep-sync/progress behavior is wanted.
- Markdown is dynamic, not a stored file: opening the same URL later regenerates it
  from current DB/page data.

## Optional follow-ups

- FISV → FI rename in the S&P seed (`scripts/ingest-sp500.ts`) plus conid re-resolve.
- If exact client-selected Analyzer/watchlist/transaction tabs must be shareable,
  encode those selections in URL query parameters and initialize the client views
  from them; Markdown already preserves query strings.
- Consider authentication or signed Markdown URLs before sharing account-bearing pages
  beyond trusted AI chats; `noindex` only discourages crawlers.

## How to restart next session

1. Read `CLAUDE.md`, then this file.
2. Confirm `git status`; only generated `predictions/cc-*.jsonl` should be untracked.
3. Reload extension v0.8.16 if Deep sync/progress UI is not present.
4. Open any page and use **MD** to inspect or **Copy MD URL** to share current content.
