#!/usr/bin/env python3
"""Shared math for the CC predict/validate loop (see docs/cc-target-strategy.md §9).

The model, in one breath:
  • strike K = the delta-0.30 call strike, priced from IMPLIED vol (what you sell)
  • premium = Black-Scholes call at K, also from IV (the rent you collect)
  • dynamics = the stock actually moves at its REALIZED vol (RV), drift mu
  • P_assign = P(close_T > K)                      -- lognormal terminal
  • P_stop   = P(path touches S* before T)         -- GBM first-passage
               where S* is the price at which the call = STOP_MULT x premium
  • E        = premium_yield * (1 - STOP_MULT*... )  expected capture, see expectancy()

Pricing with IV but moving at RV is the whole point: when IV>RV the strike sits
further out and the premium is fatter than the stock's real motion justifies.
"""
import math
import subprocess
from collections import defaultdict

import numpy as np

DB = "postgresql://coming@localhost/option_harvester?host=/var/run/postgresql"
DTE_CAL   = 35
DELTA     = 0.30
R         = 0.04
RV_WINDOW = 20
STOP_MULT = 2.5
Z30       = -0.5244005127080407   # norm.ppf(0.30)


def psql(sql):
    return subprocess.run(["psql", DB, "-P", "pager=off", "-A", "-F\t", "-t", "-c", sql],
                          capture_output=True, text=True).stdout


def ncdf(x):
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def bs_call(S, K, T, sigma):
    if sigma <= 0 or T <= 0:
        return max(S - K, 0.0)
    sq = sigma * math.sqrt(T)
    d1 = (math.log(S / K) + (R + 0.5 * sigma * sigma) * T) / sq
    return S * ncdf(d1) - K * math.exp(-R * T) * ncdf(d1 - sq)


def delta30_strike(S, T, sigma):
    """Strike whose BS call delta == 0.30 (d1 == Z30)."""
    return S * math.exp((R + 0.5 * sigma * sigma) * T - Z30 * sigma * math.sqrt(T))


def stop_barrier(S, K, T, sigma_iv, prem, mult=STOP_MULT):
    """Price S* (>S) at which the call is worth mult x prem, at entry time.
    Ignoring theta -> a conservative (low) barrier => higher modelled stop rate."""
    target = mult * prem
    lo, hi = S, K * 3
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if bs_call(mid, K, T, sigma_iv) < target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def p_assign(S, K, T, rv, mu=0.0):
    """P(S_T > K) under lognormal dynamics with realized vol rv, drift mu."""
    if rv <= 0 or T <= 0:
        return float(S > K)
    nu = mu - 0.5 * rv * rv
    return ncdf((math.log(S / K) + nu * T) / (rv * math.sqrt(T)))


def p_touch_up(S, B, T, rv, mu=0.0):
    """GBM first-passage: P(max_t S_t >= B) for an up-barrier B>S."""
    if B <= S:
        return 1.0
    if rv <= 0 or T <= 0:
        return float(S >= B)
    nu = mu - 0.5 * rv * rv
    b = math.log(B / S)
    sq = rv * math.sqrt(T)
    t1 = ncdf((-b + nu * T) / sq)
    t2 = math.exp(2 * nu * b / (rv * rv)) * ncdf((-b - nu * T) / sq)
    return min(1.0, t1 + t2)


def expectancy(prem_yield, p_stop, mult=STOP_MULT):
    """Expected capture as a fraction of spot, under the doctrine's stop:
    win  -> +prem (keep rent);  stop -> -(mult-1)*prem (bought back at mult x).
    E = prem_yield * (1 - mult*p_stop)."""
    return prem_yield * (1.0 - mult * p_stop)


def realized_vol(closes, window=RV_WINDOW):
    if len(closes) < window + 1:
        return None
    lr = np.diff(np.log(np.array(closes[-(window + 1):])))
    v = float(np.std(lr, ddof=1) * math.sqrt(252))
    return v if v > 0.01 else None


def load_prices():
    """ticker -> list[(date_str, close, high)] sorted by date."""
    px = defaultdict(list)
    for line in psql("SELECT ticker, to_char(date,'YYYY-MM-DD'), close, high "
                     "FROM option_harvest_daily_prices WHERE close IS NOT NULL "
                     "ORDER BY ticker, date;").split("\n"):
        p = line.split("\t")
        if len(p) < 4:
            continue
        try:
            px[p[0]].append((p[1], float(p[2]), float(p[3])))
        except ValueError:
            pass
    return px
