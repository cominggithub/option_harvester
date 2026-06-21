#!/usr/bin/env python3
"""Score EVERY instrument with the Δ0.30 CC model, store it, and FREEZE today's
batch for forward validation.

For each name with IV + price + enough history for RV it prices the delta-0.30
call (strike & premium from IV), models P_assign and P_stop (dynamics from RV),
and scores expected capture E = yield*(1 - 2.5*P_stop). Results are:
  • upserted into option_harvest_cc_scores  -> the web reads `e_score` per row
  • frozen to predictions/cc-<entry_date>.jsonl -> validate-cc.py scores it later

`is_target` marks names that also pass the doctrine filter (downtrend ∩ liquid
∩ $20-150) — the ones actually worth selling. The score itself is computed for
all names so the dashboard has a number for each instrument.

Run:  python3 scripts/predict-cc.py   (or:  npm run predict)
"""
import datetime
import json
import os

import cc_model as m

PRICE_MIN, PRICE_MAX = 20, 150      # doctrine sweet spot (for is_target)
MIN_WEEKLY_BUCKETS   = 4            # liquid / manageable (for is_target)
T = m.DTE_CAL / 365.0

# Empirical calibration haircuts from scripts/calibrate-cc.py (realized/model over
# 22k historical entries): the lognormal terminal under-predicts assignment ~1.20x
# (fat up-tails), GBM first-passage under-predicts stop touch ~1.06x. Applied so the
# frozen probabilities are honest; forward validation re-checks the factors.
CAL_ASSIGN = 1.20
CAL_STOP   = 1.06

px = m.load_prices()
entry_date = max(rows[-1][0] for rows in px.values())   # latest bar in our data

q = m.psql("""SELECT s.ticker, left(s.name,22), s.type, q.iv_pct, q.weekly_buckets, q.price,
                     t.windows->'y1'->>'label', t.windows->'m6'->>'label', t.windows->'m3'->>'label',
                     to_char(q.next_earnings,'YYYY-MM-DD')
              FROM option_harvest_securities s JOIN option_harvest_quotes q ON q.ticker=s.ticker
              LEFT JOIN option_harvest_trends t ON t.ticker=s.ticker
              WHERE s.is_active AND q.iv_pct IS NOT NULL AND q.price IS NOT NULL""")

entry_d = datetime.date.fromisoformat(entry_date)
window_end = entry_d + datetime.timedelta(days=m.DTE_CAL)

preds = []
for line in q.strip().split("\n"):
    p = line.split("\t")
    if len(p) < 9:
        continue
    tk, name, typ = p[0], p[1], p[2]
    iv, wk, price = float(p[3]) / 100, int(p[4] or 0), float(p[5])
    y1, m6, m3 = p[6], p[7], p[8]
    earn = p[9].strip() if len(p) > 9 else ""
    if tk not in px or px[tk][-1][0] != entry_date:
        continue                          # only score names current as of entry_date

    event_flag = False                    # earnings report inside the DTE window?
    if earn:
        try:
            event_flag = entry_d <= datetime.date.fromisoformat(earn) <= window_end
        except ValueError:
            pass
    rv = m.realized_vol([r[1] for r in px[tk]])
    if rv is None or iv <= 0:
        continue

    S = price
    K = m.delta30_strike(S, T, iv)              # strike from IV
    prem = m.bs_call(S, K, T, iv)               # premium from IV
    yld = prem / S
    Sstar = m.stop_barrier(S, K, T, iv, prem)   # price where call = 2.5x premium
    pa = min(1.0, m.p_assign(S, K, T, rv) * CAL_ASSIGN)   # dynamics from RV, mu=0
    ps = min(1.0, m.p_touch_up(S, Sstar, T, rv) * CAL_STOP)
    E = m.expectancy(yld, ps)

    downtrend = (y1 == "down") or (m3 == "down" and m6 == "down")
    # Earnings inside the window = single-stock gap risk -> never a target.
    is_target = (downtrend and wk >= MIN_WEEKLY_BUCKETS
                 and PRICE_MIN <= price <= PRICE_MAX and not event_flag)

    preds.append(dict(ticker=tk, name=name.strip(), type=typ, entry_date=entry_date,
                      S=round(S, 2), iv=round(iv * 100, 1), rv=round(rv * 100, 1),
                      iv_rv=round(iv / rv, 2), wk=wk, K=round(K, 2),
                      otm=round((K / S - 1) * 100, 1), Sstar=round(Sstar, 2),
                      prem_yield=round(yld * 100, 2), p_assign=round(pa * 100, 1),
                      p_stop=round(ps * 100, 1), E=round(E * 100, 3),
                      is_target=is_target, event_flag=event_flag, earn=earn,
                      y1=y1, m3=m3, dte=m.DTE_CAL))

preds.sort(key=lambda r: -r["E"])

# ---- persist to DB (truncate + insert: a clean daily full recompute) ----------
def sqlnum(x):
    return "NULL" if x is None else f"{x}"

rows_sql = ",".join(
    f"('{r['ticker']}','{r['entry_date']}',{sqlnum(r['iv'])},{sqlnum(r['rv'])},"
    f"{sqlnum(r['iv_rv'])},{sqlnum(r['K'])},{sqlnum(r['otm'])},{sqlnum(r['prem_yield'])},"
    f"{sqlnum(r['p_assign'])},{sqlnum(r['p_stop'])},{sqlnum(r['E'])},"
    f"{'true' if r['is_target'] else 'false'},{'true' if r['event_flag'] else 'false'},now())"
    for r in preds
)
m.psql("BEGIN; TRUNCATE option_harvest_cc_scores; "
       "INSERT INTO option_harvest_cc_scores "
       "(ticker,entry_date,iv,rv,iv_rv,strike,otm,prem_yield,p_assign,p_stop,e_score,is_target,event_flag,computed_at) "
       f"VALUES {rows_sql}; COMMIT;")

# ---- freeze the batch for forward validation ----------------------------------
os.makedirs("predictions", exist_ok=True)
out = f"predictions/cc-{entry_date}.jsonl"
with open(out, "w") as f:
    for r in preds:
        f.write(json.dumps(r) + "\n")

# ---- report the tradeable targets ---------------------------------------------
targets = [r for r in preds if r["is_target"]]
print(f"entry_date={entry_date}   DTE={m.DTE_CAL}   delta=0.30   stop={m.STOP_MULT}x")
print(f"scored {len(preds)} instruments -> option_harvest_cc_scores; "
      f"{len(targets)} pass the doctrine filter (is_target)\n")
hdr = f"{'tk':<6}{'IV%':>5}{'RV%':>5}{'IV/RV':>6}{'strike':>8}{'OTM%':>6}{'prem%':>6}" \
      f"{'Passign':>8}{'Pstop':>7}{'E·100':>7}  trend"
print(hdr); print("-" * len(hdr))
for r in targets[:18]:
    print(f"{r['ticker']:<6}{r['iv']:5.0f}{r['rv']:5.0f}{r['iv_rv']:6.2f}{r['K']:8.2f}"
          f"{r['otm']:6.1f}{r['prem_yield']:6.2f}{r['p_assign']:8.1f}{r['p_stop']:7.1f}"
          f"{r['E']:7.3f}  {r['y1']}/{r['m3']}")
print(f"\nfrozen {len(preds)} predictions -> {out}")
print(f"validate after ~35 calendar days:  python3 scripts/validate-cc.py {out}")
