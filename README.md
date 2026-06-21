# Option Harvester

A sector-by-sector stock dashboard for the **S&P 500** (+ large ETFs): ticker,
description, last price, change %, market cap, and volume — grouped by GICS
sector. Next.js + Prisma + PostgreSQL + Tailwind.

## Quick start

```bash
npm install
npm run db:push            # create option_harvest_* tables (prod DB)
npm run ingest             # fetch S&P 500 data into the DB (~2 min)
npm run dev                # http://localhost:19210
```

Production: `npm run build && npm start` (port 19210).
Test server: `npm run db:push:test && npm run ingest:test && npm run start:test` (port 19211).

## Refresh data

```bash
npm run ingest             # re-fetch prices/caps/volumes + constituents
```

See **CLAUDE.md** for architecture, database ownership rules, ports, and local
WSL dev gotchas.
