#!/usr/bin/env python3
"""Score a frozen prediction file once new bars have arrived (forward validation).

This is the half that finally tests the IV edge: the predictions were priced
from real IV, so if they verify, the edge is real out-of-sample. For each name
we pull the actual path from option_harvest_daily_prices over (entry, entry+DTE],
and check realized assignment / stop-touch against the predicted probabilities.

Usage:  python3 scripts/validate-cc.py predictions/cc-2026-06-18.jsonl
"""
import datetime
import json
import sys

import numpy as np

import cc_model as m

def ordl(s):
    y, mo, d = map(int, s.split("-")); return datetime.date(y, mo, d).toordinal()

path = sys.argv[1] if len(sys.argv) > 1 else None
if not path:
    sys.exit("usage: validate-cc.py <predictions/cc-YYYY-MM-DD.jsonl>")
preds = [json.loads(l) for l in open(path) if l.strip()]
if not preds:
    sys.exit("no predictions in file")

px = m.load_prices()
last_data = max(rows[-1][0] for rows in px.values())
entry = preds[0]["entry_date"]
need_through = (datetime.date(*map(int, entry.split("-"))) +
                datetime.timedelta(days=m.DTE_CAL)).isoformat()

scored, pending = [], 0
for r in preds:
    rows = px.get(r["ticker"])
    if not rows:
        pending += 1; continue
    e = ordl(r["entry_date"]); end = e + r["dte"]
    fwd = [b for b in rows if e < ordl(b[0]) <= end]
    if not fwd or ordl(rows[-1][0]) < end:
        pending += 1; continue                 # window not complete yet
    close_T = fwd[-1][1]
    path_hi = max(b[2] for b in fwd)
    assigned = close_T > r["K"]
    stopped  = path_hi >= r["Sstar"]
    # realized doctrine P&L in % of spot: win keep prem; stop -> -(2.5-1)*prem
    pnl = -(m.STOP_MULT - 1) * r["prem_yield"] if stopped else r["prem_yield"]
    scored.append((r, assigned, stopped, pnl))

print(f"file={path}  entry={entry}  need data through {need_through}  "
      f"latest data={last_data}")
if pending:
    print(f"\n{pending}/{len(preds)} predictions PENDING (window not complete). "
          f"Re-run after {need_through}.")
if not scored:
    print("Nothing scorable yet."); sys.exit(0)

a = np.array([[s[0]["p_assign"] / 100, s[1], s[0]["p_stop"] / 100, s[2], s[3]]
              for s in scored], dtype=float)
n = len(a)
print(f"\nscored {n} predictions:\n")
hdr = f"{'tk':<6}{'Passign':>8}{'assigned':>9}{'Pstop':>7}{'stopped':>8}{'pnl%':>7}"
print(hdr); print("-" * len(hdr))
for r, asg, stp, pnl in sorted(scored, key=lambda s: -s[0]["E"]):
    print(f"{r['ticker']:<6}{r['p_assign']:8.1f}{str(asg):>9}{r['p_stop']:7.1f}"
          f"{str(stp):>8}{pnl:7.2f}")

print(f"\nP_assign:  predicted={a[:,0].mean()*100:5.1f}%  realized={a[:,1].mean()*100:5.1f}%"
      f"  Brier={np.mean((a[:,0]-a[:,1])**2):.3f}")
print(f"P_stop:    predicted={a[:,2].mean()*100:5.1f}%  realized={a[:,3].mean()*100:5.1f}%"
      f"  Brier={np.mean((a[:,2]-a[:,3])**2):.3f}")
print(f"basket P&L: {a[:,4].mean():+.3f}% of spot per trade  "
      f"(positive => the IV/RV edge paid out of sample)")
