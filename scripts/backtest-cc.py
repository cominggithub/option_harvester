#!/usr/bin/env python3
"""
Backtest the Delta-0.30 short-call ("CC harvest") edge against our own daily
history (option_harvest_daily_prices), pulled live from the prod DB.

For every entry date we:
  1. estimate sigma from trailing 20-day realized vol (we have NO historical IV),
  2. solve the strike K whose Black-Scholes call delta == 0.30,
  3. price the premium we'd collect,
  4. look forward DTE calendar days and record:
       finish-ITM  = close at expiry  > K   (assignment / hold-to-expiry loss)
       touched     = intraday high in window >= K  (proxy for the 2-2.5x stop)
We bucket every sample by a *causal* trend state known at entry (trailing 3M/6M
return) and by type (etf vs stock), and compare the realized finish-ITM rate to
the ~30% the delta implies.

Run:  python3 scripts/backtest-cc.py
"""
import math
import subprocess
from collections import defaultdict

import numpy as np

DB = "postgresql://coming@localhost/option_harvester?host=/var/run/postgresql"

def psql(sql):
    out = subprocess.run(["psql", DB, "-P", "pager=off", "-A", "-F\t", "-t", "-c", sql],
                         capture_output=True, text=True)
    return out.stdout

# ---- parameters -----------------------------------------------------------
DTE_CAL    = 35        # calendar days to expiry
DELTA      = 0.30      # target short-call delta
R          = 0.04      # risk-free
RV_WINDOW  = 20        # trailing trading days for realized-vol estimate
STEP       = 5         # sample one entry every 5 trading days (reduce overlap)
STOP_MULT  = 2.5       # buy-to-close stop, in premium multiples (doctrine)
Z30        = -0.5244005127080407   # norm.ppf(0.30)

# ---- normal cdf via erf ---------------------------------------------------
def ncdf(x):
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))

def bs_call(S, K, T, sigma):
    if sigma <= 0 or T <= 0:
        return max(S - K, 0.0)
    d1 = (math.log(S / K) + (R + 0.5 * sigma * sigma) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    return S * ncdf(d1) - K * math.exp(-R * T) * ncdf(d2)

# ---- load -----------------------------------------------------------------
prices = defaultdict(list)   # ticker -> list[(date_ordinal, close, high)]
import datetime
def ordl(s):
    y, m, d = map(int, s.split("-"))
    return datetime.date(y, m, d).toordinal()

for line in psql("SELECT ticker, to_char(date,'YYYY-MM-DD'), close, high "
                 "FROM option_harvest_daily_prices WHERE close IS NOT NULL "
                 "ORDER BY ticker, date;").split("\n"):
    p = line.split("\t")
    if len(p) < 4:
        continue
    try:
        prices[p[0]].append((ordl(p[1]), float(p[2]), float(p[3])))
    except ValueError:
        pass

meta = {}   # ticker -> type
for line in psql("SELECT ticker, type FROM option_harvest_securities WHERE is_active;").split("\n"):
    p = line.split("\t")
    if len(p) >= 2:
        meta[p[0]] = p[1]

# ---- backtest -------------------------------------------------------------
# cohort key -> list of dicts
samples = []
for t, rows in prices.items():
    rows.sort()
    if len(rows) < 90:
        continue
    ords   = np.array([r[0] for r in rows])
    closes = np.array([r[1] for r in rows])
    highs  = np.array([r[2] for r in rows])
    logret = np.diff(np.log(closes))
    typ = meta.get(t, "stock")

    i = 63  # need 63 trailing bars for the 3M trend signal
    while i < len(rows):
        # causal trend signals known at entry
        r3 = closes[i] / closes[i - 63] - 1.0
        r6 = (closes[i] / closes[i - 126] - 1.0) if i >= 126 else None

        # trailing realized vol
        if i < RV_WINDOW:
            i += STEP; continue
        rv = logret[i - RV_WINDOW:i]
        sigma = float(np.std(rv, ddof=1) * math.sqrt(252))
        if not (sigma > 0.01):
            i += STEP; continue

        S = closes[i]
        T = DTE_CAL / 365.0
        # strike with call delta = 0.30  ->  d1 = Z30
        K = S * math.exp((R + 0.5 * sigma * sigma) * T - Z30 * sigma * math.sqrt(T))
        prem = bs_call(S, K, T, sigma)

        # find expiry index: first bar on/after entry_date + DTE
        target = ords[i] + DTE_CAL
        j = i + 1
        while j < len(rows) and ords[j] < target:
            j += 1
        if j >= len(rows):
            break  # window runs off the end of our data
        S_end = closes[j]
        path_high = float(np.max(highs[i + 1:j + 1])) if j > i else S

        # trend cohort
        if r3 is not None and r3 < -0.05 and (r6 is None or r6 < 0):
            coh = "downtrend"
        elif r3 > 0.10:
            coh = "uptrend"
        else:
            coh = "sideways"
        sustained = (r3 < -0.05 and r6 is not None and r6 < -0.05)

        samples.append(dict(
            typ=typ, coh=coh, sustained=sustained,
            assigned=S_end > K,
            touched=path_high >= K,
            yld=prem / S,
            otm=K / S - 1.0,
            sigma=sigma,
        ))
        i += STEP

samples = [s for s in samples if math.isfinite(s["yld"])]
print(f"total samples: {len(samples):,}  tickers: {len(prices):,}\n")

def summarize(rows, label):
    n = len(rows)
    if n == 0:
        print(f"{label:<26} n=0"); return
    asg = 100 * np.mean([r["assigned"] for r in rows])
    tch = 100 * np.mean([r["touched"]  for r in rows])
    yld = 100 * np.mean([r["yld"]      for r in rows])
    otm = 100 * np.mean([r["otm"]      for r in rows])
    iv  = 100 * np.mean([r["sigma"]    for r in rows])
    # doctrine expectancy in premium-multiples: keep premium unless stop touched,
    # where you lose (STOP_MULT-1)x premium. Uses 'touched' as the stop proxy.
    p_stop = np.mean([r["touched"] for r in rows])
    exp_mult = (1 - p_stop) * 1.0 - p_stop * (STOP_MULT - 1.0)
    print(f"{label:<26} n={n:>6}  finishITM={asg:5.1f}%  touched={tch:5.1f}%  "
          f"avgRV={iv:4.0f}%  OTM={otm:4.1f}%  prem={yld:4.1f}%  E[stop-mgd]={exp_mult:+.2f}x")

print("=== by trend cohort (causal, known at entry) ===")
for c in ["uptrend", "sideways", "downtrend"]:
    summarize([s for s in samples if s["coh"] == c], c)
summarize([s for s in samples if s["sustained"]], "  └ sustained-down (3M&6M)")
print()
print("=== downtrend cohort, etf vs stock ===")
dn = [s for s in samples if s["coh"] == "downtrend"]
summarize([s for s in dn if s["typ"] == "etf"],   "downtrend ETF")
summarize([s for s in dn if s["typ"] == "stock"], "downtrend stock")
print()
print("=== all samples (sanity: should sit near the ~25-30% delta implies) ===")
summarize(samples, "ALL")
