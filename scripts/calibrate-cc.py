#!/usr/bin/env python3
"""Validate the model's PROBABILITY MACHINERY on our daily history.

We can't replay the IV edge (no historical IV), so here strike/premium/dynamics
all use realized vol (IV/RV == 1). That isolates one question: are the
lognormal P_assign and the GBM first-passage P_touch/P_stop *calibrated* —
i.e. does "model says 30%" actually happen 30% of the time?

Compares, in aggregate and via Brier score, model probability vs realized
outcome over every sampled historical entry, and reports the realized/model
ratio you should haircut forward P_stop by.

Run:  python3 scripts/calibrate-cc.py
"""
import datetime

import numpy as np

import cc_model as m

T = m.DTE_CAL / 365.0
STEP = 5

def ordl(s):
    y, mo, d = map(int, s.split("-")); return datetime.date(y, mo, d).toordinal()

px = m.load_prices()
rows_out = []   # (p_assign, assigned, p_touchK, touchedK, p_stop, stopped)
for tk, rows in px.items():
    if len(rows) < 90:
        continue
    ords   = np.array([ordl(r[0]) for r in rows])
    closes = [r[1] for r in rows]
    highs  = [r[2] for r in rows]
    i = 63
    while i < len(rows):
        rv = m.realized_vol(closes[:i + 1])
        if rv is None:
            i += STEP; continue
        S = closes[i]
        K = m.delta30_strike(S, T, rv)
        prem = m.bs_call(S, K, T, rv)
        Sstar = m.stop_barrier(S, K, T, rv, prem)
        # forward 35-cal-day window
        target = ords[i] + m.DTE_CAL
        j = i + 1
        while j < len(rows) and ords[j] < target:
            j += 1
        if j >= len(rows):
            break
        path_hi = max(highs[i + 1:j + 1])
        rows_out.append((
            m.p_assign(S, K, T, rv),  closes[j] > K,
            m.p_touch_up(S, K, T, rv), path_hi >= K,
            m.p_touch_up(S, Sstar, T, rv), path_hi >= Sstar,
        ))
        i += STEP

a = np.array(rows_out, dtype=float)
n = len(a)
def line(label, pcol, ocol):
    pm, om = a[:, pcol].mean(), a[:, ocol].mean()
    brier = np.mean((a[:, pcol] - a[:, ocol]) ** 2)
    ratio = om / pm if pm else float("nan")
    print(f"{label:<24} model={pm*100:5.1f}%  realized={om*100:5.1f}%  "
          f"realized/model={ratio:4.2f}  Brier={brier:.3f}")

print(f"historical entries: {n:,}\n")
line("P_assign (close>K)",      0, 1)
line("P_touch strike (hi>=K)",  2, 3)
line("P_stop (hi>=S* @2.5x)",   4, 5)
print("\nInterpretation:")
print("  realized/model ~1.0  => calibrated.  >1 => model UNDER-predicts (optimistic).")
print("  The P_stop realized/model ratio is the haircut to apply to forward P_stop.")
