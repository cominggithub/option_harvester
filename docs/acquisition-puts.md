# Acquisition puts — buying low on purpose

**Version 1.1 · 2026-08-23 · status: active.** The authority for short puts written on
names the operator **wants to own**. Assignment is the intended outcome, not the failure
state, which makes almost every judgement in the other two books wrong for these positions.

The three books in this account, and why they cannot share rules:

| Book | Intent | Assignment is | Judged by | Spec |
| --- | --- | --- | --- | --- |
| Naked calls | harvest premium on names that are not rising | the failure state | credit kept, per §6 | [short-call-strategy.md](short-call-strategy.md) |
| Panic puts | harvest a volatility spike, close before delivery | the failure state | credit kept | [strategy.md](strategy.md) § 三 |
| **Acquisition puts** | **buy a wanted name below spot** | **the goal** | **basis achieved, and whether the cash was there** | this file |

## 1. Why this exists

Before v1.0 the model had two intents and the account held three. `/risk` therefore read
the put-heavy book as *"the program has inverted into a long book"* (`SC-B4`) and counted
$268,400 of put assignment notional as pure risk. For a declared acquisition position both
readings are false: **being long is the plan and delivery is the plan.** Meanwhile the thing
that genuinely is at risk went unchecked — whether the account can *fund* the assignment it
has promised. On 2026-08-23 the declared book promises **$109,400** of stock against
**$117,581** of settled cash: 93% of it.

A short put is a limit order that pays you to wait. That is a real advantage over buying at
the market, and it is only an advantage if the cash is genuinely reserved.

## 2. Declaring the intent

* The intent is **per name**, declared in `src/lib/acqputs.ts:ACQUISITION_PUTS` with a
  reason and a date, and it lands through version control — not a UI toggle.
* An **undeclared** short put is a premium trade and is judged as one. Without this rule
  "I meant to own it" becomes an excuse available after the fact to any put that moved
  against you, which would make the whole record unfalsifiable.
* Declaring a name changes only how its **puts** are read. Calls on the same name stay in
  the naked-call program.

**Currently declared:** `GDX` (gold-miner accumulation), `SOXX` (semiconductor index
accumulation), both since 2026-08-23.

**Cap decisions taken** (the alternative to reducing is always to raise the cap and say why —
recording which was chosen is what stops the cap from drifting):

| Date | Name | Decision | Reason |
| --- | --- | --- | --- |
| 2026-08-23 | GDX | **Reduce contracts. The 40% cap stands.** | GDX promised $67,400 = 57% of settled cash. Raising the cap would have been raising it for the weakest legs in the book: at Δ0.03–0.09 those strikes carry ~6% of the name's delivery in fill-weighted terms, so the cap would have been relaxed to keep positions that were reserving cash without accumulating anything. AP-7 gives up 3 contracts (2× 78P Sep, 1 of 5× 78P Oct) for ≈$115, releasing $23,400 → GDX 37%, book 73%. |

## 3. Entry rules

| # | Rule | Id |
| --- | --- | --- |
| 3.1 | The name must be one you would buy **at the market today** if it were 10% lower. If you would not, this is a premium trade wearing a story. | AP-1 |
| 3.2 | **Effective basis** = strike − premium per share. That number, not the strike, is the price you are agreeing to pay; it must be a price you consider good value. | AP-2 |
| 3.3 | Cash for delivery must be **unencumbered** — reserved, and treated as already spent for margin purposes. | AP-3 |
| 3.4 | No single name may promise more than **40% of settled cash** in delivery, and the book as a whole no more than **80%**. | AP-4 |
| 3.5 | Strike **at or below** the price you want to pay; DTE is free (unlike the call program, a longer expiry is not a defect here — it collects more premium while you wait, and being assigned early is acceptable). | AP-5 |
| 3.6 | Size in **whole round lots** you actually want. A 5-lot on a $78 strike is a $39,000 purchase decision, not a $612 premium decision. | AP-6 |

The delta and cushion rules of the call program **do not apply**: a higher delta means a
higher chance of getting the shares, which is the objective. What replaces them is AP-4 —
the constraint is the balance sheet, not the probability.

## 4. Management

1. **Do not roll to avoid assignment.** Rolling a put down and out to dodge delivery
   converts an acquisition into a premium trade and quietly abandons the plan. If you no
   longer want the shares, say so and close — do not roll.
2. **Take the assignment** when it comes. The position becomes stock at the effective basis;
   from then on it is a holding, and covered calls against it are a *separate* decision under
   the call program's rules.
3. **Roll for a better basis only**, i.e. down and out for a credit that lowers the effective
   basis, when the thesis is unchanged and the cash is still reserved.
4. **Close** when the reason to own the name has gone — not when the mark looks bad.
5. If the total promised delivery breaches AP-4 because cash fell, **reduce contracts** before
   opening anything anywhere else in the account.
6. **Give up the contracts least likely to deliver, first** (**AP-7**) — not the biggest winner
   and not the biggest loser, both of which are mark-driven and therefore forbidden by §4.4. The
   weakest claim on reserved cash is the leg whose |Δ| says the limit order is not going to
   fill: it consumes the whole funding cap while contributing almost no chance of the purchase
   it exists to make. Where a leg's delta cannot be measured it ranks as the *strongest* claim,
   so an unmeasurable position is never the one the system tells you to give up. | **AP-7** |
7. **The mark is never a trigger in this book.** No verdict here may be produced by captured
   percentage, cost-to-close or unrealised P/L. There are exactly three reasons to act: the
   assignment arrived (§4.2), the thesis died (§4.4), or the funding cap binds (§4.5/AP-7).

`|Δ|` is read **inversely** to the premium books: high is good, because it is the market's own
estimate that the limit order fills. Below **0.10** the position is collecting premium while
reserving cash — §5's "the strikes are too far away to be a real accumulation plan" — and at or
above **0.30** delivery is a live prospect, so the cash has to be present rather than promised.

## 5. Success criteria

Not credit kept — that is the premium book's measure and it scores a successful acquisition
as a loss.

* **Basis vs market.** Assigned at an effective basis below where the name traded over the
  following month: the acquisition worked.
* **Discount captured** = premium ÷ strike. It is the discount on a purchase you wanted
  anyway, so it is earned whether or not assignment happens.
* **Unassigned is a partial win, not a win.** Keeping the premium without getting the shares
  means the limit order did not fill; if that keeps happening, the strikes are too far away
  to be a real accumulation plan.
* **Funding failures are the only hard failure.** An assignment that forces a sale elsewhere
  costs more than any premium it collected.

## 6. What the pages do with this

* `/risk` → **Acquisition book** finding (`R-DELIVERY`): delivery cost per name, effective
  basis versus spot, what share of cash and NLV the promise represents, and which legs are
  already ITM so delivery is live rather than hypothetical. Severity is driven by funding,
  not by the mark.
* `/risk` → **What to do now** runs a *separate ladder* for these legs (`acquisitionVerdictFor`
  in `lib/bookrisk.ts`), which can only return **Take delivery**, **Reduce contracts (AP-4)** or
  **Hold**. The premium verdicts — close, roll, defend, let expire — are unreachable for a
  declared leg and `bookrisk-check` asserts it in every state. This is the fix for a live defect:
  until 2026-08-23 the harvest rule printed *"kept 80% of the credit — close, free the margin,
  re-sell at 35–45 DTE"* on declared GDX puts, which is §4.4 violated by the page itself.
* The **fill-weighted delivery** figure (Σ delivery × |Δ|) says how much of the promise is a
  live accumulation. It is an acquisition-quality measure and **never** a funding one: the cash
  reserve is always the full obligation, because one theme's deltas rise together.
* The **AP-7 reduction plan** is computed whenever a cap binds (`planReduction`), contract by
  contract, and states what it releases, what buying it back costs, and which caps it actually
  clears — plus any it cannot.
* `SC-B4` (side inversion) now compares calls against **premium** puts only, and says how
  much acquisition credit it excluded.
* `bySide` splits *Short puts (premium)* from *Short puts (acquisition)*.
* These legs still appear in theme and σ statistics: the correlated exposure is real even
  when it is wanted, and hiding it would be the opposite error.

## 7. Open questions

1. **Is the basis actually good?** Needs a follow-through measure: for each assignment, the
   name's price 1/3/6 months later against the basis paid. Nothing tracks this yet.
2. **Should covered calls be written against assigned shares automatically?** That is the
   call program's business, but the hand-off is undefined.
3. **Cash earmarking is a convention, not a mechanism.** Nothing in the system stops the
   premium book from using the same cash as margin. The honest fix is a reserved-cash figure
   the margin KPI subtracts.
4. **Is |Δ| the right measure of "will this fill"?** It is a risk-neutral probability, not a
   forecast, and this book's deltas are reconstructed where IB's are stale (`system-gaps.md`
   §1). AP-7's ordering therefore inherits that error — it is right about *rank* far more
   confidently than about the percentages it prints. Two legs shown as "0.07" can order
   differently because the unrounded values differ.
5. **A reduction is not measured yet either.** Nothing records whether contracts given up
   under AP-7 would have delivered, so the rule is reasoned rather than evidenced.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.1 | 2026-08-23 | **AP-7** and §4.7: the mark can no longer produce a verdict in this book, and a funding-driven reduction gives up the contracts least likely to deliver. Adds the fill-weighted delivery measure, the computed reduction plan, and the separate verdict ladder on `/risk` — closing the defect where declared legs were still being told to harvest at 70% captured. Records the GDX cap decision: reduce, do not raise. |
| 1.0 | 2026-08-23 | First spec. Declares GDX and SOXX as acquisition names, defines effective basis as the measure, replaces delta/cushion gates with the funding cap AP-4, forbids rolling to avoid assignment, and removes these legs from `SC-B4`'s inversion test. Prompted by the pages reading an intended long position as a doctrine breach. |
