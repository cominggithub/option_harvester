#!/usr/bin/env python3
"""Live CC-target screen: IV/RV ratio for downtrend names.

IV (front-month ATM, from option_harvest_quotes) vs trailing-20d realized vol
(from option_harvest_daily_prices). High IV/RV + negative drift means the
delta-0.30 strike sits FAR OTM relative to how the stock actually moves, so the
realized finish-ITM rate runs well below the 30% the delta nominally implies
(see docs/cc-target-strategy.md §4).

Run:  python3 scripts/iv-rv-screen.py
"""
import math
import subprocess
from collections import defaultdict

import numpy as np

DB = "postgresql://coming@localhost/option_harvester?host=/var/run/postgresql"

def psql(sql):
    return subprocess.run(["psql", DB, "-P", "pager=off", "-A", "-F\t", "-t", "-c", sql],
                          capture_output=True, text=True).stdout

# trailing 20-day realized vol per ticker
closes = defaultdict(list)
for line in psql("SELECT ticker, close FROM option_harvest_daily_prices "
                 "WHERE close IS NOT NULL ORDER BY ticker, date;").split("\n"):
    p = line.split("\t")
    if len(p) < 2:
        continue
    try:
        closes[p[0]].append(float(p[1]))
    except ValueError:
        pass

rv = {}
for t, cs in closes.items():
    if len(cs) < 21:
        continue
    lr = np.diff(np.log(np.array(cs[-21:])))
    rv[t] = float(np.std(lr, ddof=1) * math.sqrt(252) * 100)

# downtrend names with an IV snapshot
q = psql("""SELECT s.ticker, left(s.name,20), s.type, q.iv_pct, q.weekly_buckets,
                   t.windows->'y1'->>'label', t.windows->'m3'->>'label'
            FROM option_harvest_securities s JOIN option_harvest_quotes q ON q.ticker=s.ticker
            LEFT JOIN option_harvest_trends t ON t.ticker=s.ticker
            WHERE s.is_active AND q.iv_pct IS NOT NULL
              AND (t.windows->'y1'->>'label'='down'
                   OR (t.windows->'m3'->>'label'='down' AND t.windows->'m6'->>'label'='down'))""")

rows = []
for line in q.strip().split("\n"):
    p = line.split("\t")
    if len(p) < 7:
        continue
    tk, name, typ, iv, wk, y1, m3 = p[0], p[1], p[2], float(p[3]), p[4], p[5], p[6]
    if tk not in rv or rv[tk] == 0:
        continue
    rows.append((tk, name, typ, iv, rv[tk], iv / rv[tk], wk, y1, m3))

rows.sort(key=lambda r: -r[5])
print(f"{'tk':<6}{'name':<21}{'typ':<6}{'IV%':>6}{'RV%':>6}{'IV/RV':>7}{'wk':>4}  {'y1':<9}{'m3':<9}")
print("-" * 72)
for tk, name, typ, iv, r, ratio, wk, y1, m3 in rows[:25]:
    print(f"{tk:<6}{name:<21}{typ:<6}{iv:6.1f}{r:6.1f}{ratio:7.2f}{wk:>4}  {y1:<9}{m3:<9}")
if rows:
    print(f"\nmedian IV/RV (downtrend names): {np.median([r[5] for r in rows]):.2f}   n={len(rows)}")
