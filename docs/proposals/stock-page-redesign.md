# `/stock/[ticker]` — layout and information-architecture redesign

**Status: implemented and deployed 2026-09-07.** Written after an operator report that "the layout of the
company details is bad". Implementation notes, verified against the running page:

* **Shipped in full**: the answer band (§ 3), the seven-section skeleton with 19px `H2` rules and a
  `PageToc` rail (§ 2.1, § 4), one 12-column grid with spans only from {4,6,8,12} (D-3), `Card`→`Tile`
  with `h3` at `text-lede` (D-1), all nine deletions in § 2.4 (D-6), prose measure (D-9), the
  `— —` chip replaced by `no screen verdict` carrying `final.reason` as its title (D-11), flush
  `gap-px bg-line` tiles (D-12), and the ETF recessive strip (D-13).
* **Verified**: `text-[Npx]` 72 → **0**; half-pixel sizes 32 → **0**; `text-ink-faint` 52 → **0**;
  `xl:grid-cols-*` declared once (12); spans ⊆ {4,6,8,12}; `rounded-lg` 0; 18 `max-w-[Nch]` measures.
  The seven duplicated data points each now occur exactly once (checked by string count on the
  rendered page).
* **Mirror check**: `/md/stock/SMCI.md` returns 200 and its heading count ROSE from a flat list to
  **20** (`# ticker` + 7 `##` sections + 12 `###` tiles), which is the § 5 requirement — the mirror
  was never expected to be byte-identical because heading levels changed.
* **Departure 1 — `ACTION_META` keeps its `sky` tone.** § 3.2 of the visual audit rules it neutral,
  but it lives in `src/lib/posanalysis.ts` and is shared with `/risk` and `/positions`. Editing it
  would restyle two other pages silently, which is the same argument § 5 uses to forbid "fixing" the
  shared `H2`. Deferred to a separate, tested change.
* **Departure 2 — `H2` uses `mt-10`, not `mt-12`.** With seven sections rather than eighteen, 12
  units left the page feeling gapped rather than sectioned.
* **Extension — the arrow inversion needed a legend.** Inverting `TREND_CLS` so falling reads green
  (correct for a seller) is invisible without saying so, so the chart header, the trend tile and the
  peers table each carry an explicit "↓ favourable / ↑ the threat" legend.

Original brief follows. This is a spec for the **default agent**: the page is
`src/app/stock/[ticker]/page.tsx` (**823 lines**), and it may also touch
`src/components/PageToc.tsx` (read-only use) — it must **not** touch
`src/components/ScShared.tsx` (see § 5).

`docs/proposals/risk-page-redesign.md` is the house design spec and is authoritative here. Its
phases 0 and 1 shipped, so the type scale and the AA-clean greys **already exist** as tokens
(`globals.css:21–28`, `tailwind.config.ts` `fontSize` + `colors.ink`). This page has adopted
**none of them**. Most of what follows is therefore not new design — it is applying a decided
house standard to the one page that was never converted.

Scope discipline, same as the risk doc: **no number, threshold, gate id, verdict or severity
ordering changes.** Presentation only. `docs/spec.md` § 8 holds — dense editorial/financial
terminal, white, hairlines, tabular figures, **no oversized rounded cards**, no gradients, no
emoji.

The page is not too dense and it is not missing content. Its content is *excellent* — the spike
factor list, the gate ledger with margins, the trend/gate divergence note are all better than
anything on the comparable commercial screens. The problem is that **eleven sibling tiles of
identical rank, no chapters, six differently-shaped grids and seven duplicated numbers** make the
reader do the assembly that the page should have done. Measured below.

---

## 1. Diagnosis — measured, not aesthetic

### D-1 · Every card title is an `<h2>` rendered *smaller* than the body text it introduces

`page.tsx:47` — the shared `Card` header:

```
<h2 className="text-[12.5px] font-semibold text-ink">{title}</h2>
```

Body prose inside those cards is `text-[12px]`–`text-[13.5px]` (`:97, :104, :351, :395, :468`), and
the house body size is **14px** (`--fs-body`). So "Naked short call", the most important string on
the page, is set **1.5px smaller than the house body size** and only 0.5px larger than the paragraph
directly beneath it. This is exactly D-1 of the risk doc, which the risk page fixed by moving `H2`
to `text-h2` (19px ink).

The brief for this review stated "no h2 anywhere on the page". That is not right and the correction
matters: there are **twelve** `<h2>`s — one per `Card` — confirmed in the Markdown mirror, which
renders twelve `##` headings for `/stock/SMCI`. The defect is worse than absence. The document
outline is `h1` → **twelve sibling `h2`s**, all typographically demoted below body, so the page
declares twelve chapters of equal rank and then draws none of them.

### D-2 · No section level exists, on a page of twelve sections and 823 lines

There is no heading between the `h1` (`:621`) and the twelve card `h2`s, no anchor ids, and no
`PageToc`. `/risk` — the page with the identical complaint — carries a sticky `PageToc` rail plus
19px section headings for its eighteen sections. Here, "what is my own record on this name" is the
last tile on the page (`:788`) and there is no way to jump to it, no way to know it exists, and no
signal while scrolling of which of the five decision inputs you are currently inside.

### D-3 · Six stacked grids with four different column counts, so no column edge lines up

| Line | Container | `xl` columns |
| --- | --- | --- |
| `:646` | trade + earnings | **3** |
| `:652` | spike + trend | **3** |
| `:659` | price history + IV | **3** |
| `:697` | sector | **2** |
| `:701` | fundamentals + news | **3** |
| `:758` | position + history | **2** |

Each `<div>` is an independent grid, so the 2-col rows' single interior edge falls at 50% while the
3-col rows' edges fall at 33%/67%. Scrolling the page, **every tile boundary moves**. The eye has no
persistent column to track down, which is a large part of why a page of good tiles reads as rubble.

### D-4 · Two wrappers that do nothing

* `:648` — `<div className="space-y-5">` with exactly one child (`<EarningsCard>`). `space-y-*` on a
  single child is a no-op. It also visually implies "more tiles will stack here", which is why it
  exists and why it now misleads.
* `:458` — `SectorCard` carries `className="xl:col-span-2"`, and its grid at `:697` is
  `xl:grid-cols-2`. The card spans the entire grid, so **the grid is a no-op wrapper around one
  full-width card**. (The other three `xl:col-span-2` uses — `:178`, `:654`, `:741` — are inside
  3-col grids and are legitimate 2-of-3 spans.)

### D-5 · Span is assigned by position, not by content mass, so rows have large dead areas

* `:646` pairs **Naked short call** (span 2; on SMCI: verdict badge, proposal block, four fields, a
  **twelve-row** doctrine gate ledger, a five-row profile ledger, three explainer paragraphs) with
  **Earnings date** (span 1; one badge, one date, **one sentence** — 4 rendered lines on a clear
  name). The row's height is set by the tallest tile, so roughly two thirds of the Earnings column is
  blank.
* `:652` inverts the error. **Upside-spike risk** gets span 1 while containing a five-item factor
  list (`:274`) *and* a **six-cell** run-up table forced into `sm:grid-cols-3` (`:287`) — two rows
  where one would do — *and* two gap lists (`:306–:315`). **Recent trend** gets span 2 (`:654`) while
  containing a **two-row** table (`:405–:428`) and four fields (`:430–:441`). The cramped tile is the
  one with more to say.

### D-6 · Seven data points are printed twice on the same page, one of them a full sentence verbatim

| Datum | First site | Second site |
| --- | --- | --- |
| Market cap | `:86` (About) | `:705` (Long-term basics) |
| Volume | `:87` (About) | `:706` (Long-term basics) |
| Beta | `:89` (About) | `:725` (Long-term basics) |
| 52-week range | `:88` (About) | `:668` (price-history header) |
| Next earnings | Earnings tile `:341–:360` | `:708` (Long-term basics) |
| % off 52w high | `:432` (Recent trend) | `:667` (price-history header) |
| **Sector standing prose** (`sc.read`) | `:105` (About) | **`:468` (Sector & peers)** |

The last one is the same generated sentence rendered twice — verified against the live page:
`curl -s http://localhost:19210/md/stock/SMCI.md | grep -c 'Behind Information Technology'` → **2**.

Duplication is not merely wasteful here, it is actively misleading in a terminal whose whole promise
is that a number appears once, in the place that owns it. Seeing "Beta 2.00" twice invites the reader
to check whether they match — work that produces nothing. And `Next earnings` appearing as a plain
grey field at `:708`, ~6 screens below the dedicated Earnings verdict tile, is the specific failure
`docs/spec.md` warns about: **a bare date reads as inert data, while the tile above calls the same
date fatal or clear.**

### D-7 · Twelve arbitrary font sizes, five of them half-pixel, and zero use of the house scale

Counted in `page.tsx`: **72** `text-[Npx]` literals across **twelve** distinct values —
`9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 16, 24, 28`. Uses of the house tokens
(`text-micro / small / body / lede / h2 / h1 / kpi`): **zero**.

The tokens exist and are documented in `globals.css:12–28` with the reasoning ("Half-pixel sizes are
banned"), and `/risk` runs on them. Under `body { zoom: 1.125 }` (`globals.css:39`) the half-pixel
values land at 10.69 / 11.81 / 12.94 / 14.06 / 15.19px — none on a device pixel. Thirty-two of the 72
literals are half-pixel. Steps of 0.5px cannot be perceived as hierarchy but are perfectly capable of
making text look soft, so the scale costs crispness and returns nothing.

### D-8 · Grey is the default (70%), and 25 strings are grey *and* under 12px

Colour-token applications in `page.tsx`: `text-ink-faint` **52**, `text-ink-muted` **29**,
`text-ink` **34**. So **81 of 115 = 70% grey** — worse than the 60% the risk doc measured on `/risk`
before its fix, and that page called grey-as-default "the primary defect".

**Twenty-five** lines combine a size ≤ 11.5px with a grey token (23 of them `ink-faint`), against the
risk doc § 3.1 rule 1: *no grey below 12px*. Seven of those are the **methodology footnotes** — the
Black-Scholes disclaimer (`:208`), the percentile sample note (`:315`), the history window
(`:322`), the ETF/earnings caveat (`:361`), the net-move-vs-fitted explanation (`:444`), the peer
selection rule (`:530`). These are the sentences that stop a constructed number being read as a
quote and a 317-overlapping-window percentile being read as a probability. **They are currently the
least legible text on the page** — 10.5px grey — which inverts their importance exactly.

`Field` (`:54–:61`) puts every one of its **47** labels in `text-ink-faint` at 12.5px, which is where
a large share of the 52 faint applications comes from; fixing `Field` alone moves most of them.

### D-9 · Prose has no measure anywhere

`grep -c max-w` on `page.tsx` → **0**. Not one width constraint on the page. `s.description` (`:97`)
is 2,240 characters for SMCI and renders into a `minmax(0,2fr)` column of a container that is
`px-6 2xl:px-10` of the viewport — on a 2560px window that is ~1,650px, roughly **235 characters per
line** against the 45–75 optimum. Risk doc § 5.1 sets `max-w-[68ch]` for prose and `max-w-[80ch]`
for scanned bullets; this page predates that and never got it.

### D-10 · There is no answer above the fold, and the page's loudest verdict contradicts its own evidence

The operator's question is *may I sell a naked call on this name, and if not what blocks it*. Today
that requires reading four tiles spread over roughly six screens, and the four do not agree in a way
the page ever reconciles. Live, on SMCI:

* **Naked short call** (`:174`) headlines **"Blocked by 1 gate"** — and that gate is `SC-B1`, theme
  headroom, a *book-level* cap ("Semiconductors already 44% of open credit, limit 25%").
* **Recent trend** (`:386`) headlines **UP** — the name is rising, which is the single condition the
  short-call doctrine exists to refuse.
* **Upside-spike risk** (`:267`) headlines **Elevated** with five raising factors, including "the
  strike was reached in 22% of windows against a Δ-implied 11%" and "IV 75% vs 110% realized — you
  are being paid less than the stock has actually been moving".
* **Earnings date** (`:341`) is the only clean one: clear of the report.

So the most prominent verdict on the page says the obstacle is portfolio concentration, while the
page's own evidence says the obstacle is that this specific name is rising and historically jumps
through cushions like this one. Both readings are correct — the gate set genuinely does not gate on
spike risk or on the 1–3 month window — and the page even documents the near-miss version of this in
the trend/gate divergence note (`:396–:405`). But the reconciliation is buried six screens down in a
tile the reader has no index for, and **nothing above the fold carries it.** This is D-8 of the risk
doc, in a more dangerous form: not merely a missing answer, but a prominent partial one.

### D-11 · The header's most prominent chip is frequently `— —`, and a computed explanation is discarded

`:634` renders `{sideLabel} {s.final.score ?? "—"}` — the fused read-time verdict — top-right,
beside the price, the single most-looked-at spot after the ticker. Sampled live:

| SMCI | BIDU | ALB | SPY | TSLL | NVDA |
| --- | --- | --- | --- | --- | --- |
| `— —` | `— —` | `— —` | `NP 0` | `NC 28` | `NP 38` |

Three of six render as a meaningless double em-dash in prime position. Two of the six render **`NP`**
— *sell a put* — on a page whose entire body proposes a naked **call**, with no indication of why the
sides disagree. `computeFinalScore` returns a `reason` sentence for exactly this
(`src/lib/score.ts:74, :85`: "No clean harvest — wrong side or no ladder.", "Sell a naked put —
quality/index name; act when IV is rich"), and **this page never reads `s.final.reason`.** The
explanation is already computed and thrown away.

### D-12 · The tile style is off-house

`Card` (`:45`) is `rounded-lg border bg-surface`, twelve times. `docs/spec.md` § 8 says "no
oversized rounded cards/shadows", and the reference implementation on `/risk` uses flush
`bg-surface` tiles in `grid gap-px bg-line` bands (`risk/page.tsx:657, :683, :714, :754`) — the
hairline *is* the separator. Twelve rounded outlines on a canvas background, each with its own
1px border plus a 20px gap, spend a lot of ink drawing containers instead of content, and give all
twelve equal visual weight, which is precisely what "undifferentiated" means.

`Card`'s `tone` prop (`:45`, set at `:165`, `:254`, `:331`) tints the whole outline to carry the
verdict. `/risk` encodes severity as a `border-l-2` edge on the tile instead
(`risk/page.tsx` `SEV_STYLE`), which reads at any zoom and does not require a box.

### D-13 · On an ETF, "Long-term basics" is a full-weight grid of em-dashes

`:703–:737` renders twelve fixed company fields. Live on `/stock/SPY`: `Market cap —`,
`Next earnings —`, `Fwd P/E —`, `PEG —`, `Beta —`, `Div yield —`, `Profit margin —`, `ROIC —`,
`Analyst —`, `Target —` — **ten of twelve empty**, at the same visual weight as SMCI's populated
version. `TSLL` shows the same in `About` (`Market cap —`, `Beta —`). The page already knows
(`s.type === "etf"`, `isLongLeveragedEtf(s)`, both used at `:78`) and does not use that knowledge
here.

---

## 2. The recommended skeleton

One structural decision governs everything: **one 12-column grid, everywhere, with spans drawn only
from `{4, 6, 8, 12}`.** That is the explicit resolution of D-3. Twelve is divisible by 2, 3 and 4, so
every layout the page currently wants (halves, thirds, two-thirds) is expressible, and — the point —
`4|8`, `8|4`, `6|6` and `12` **all share the same gridlines**, so column edges stop moving as you
scroll. Every band is:

```tsx
<div className="mt-3 grid grid-cols-1 gap-px bg-line xl:grid-cols-12">
```

and every tile declares `xl:col-span-4` / `-6` / `-8` / `-12`. No other span values. No band declares
its own column count. Below `xl` the page stays single-column, as it is today.

`Card` becomes `Tile` — same props, house style, no rounding, no outline, optional verdict edge:

```tsx
function Tile({ title, hint, edge, span, children }: {...}) {
  return (
    <section className={`bg-surface ${edge ?? ""} ${span}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
        <h3 className="text-lede font-semibold text-ink">{title}</h3>
        {hint && <span className="text-micro text-ink-muted">{hint}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
```

`h2` → `h3` at `text-lede` (16px) is the D-1 fix: card titles now outrank body (14px) and rank below
the new 19px section headings. `edge` replaces the `tone` outline: `border-l-2 border-rose-500` /
`border-amber-500` / `border-emerald-600` / `""`, from the **same** existing tone maps.

Section headings use the `H2` from `risk/page.tsx:58–65`, copied verbatim into this file:

```tsx
<div id={id} className="mt-12 scroll-mt-4 border-t border-line pt-4">
  <h2 className="text-h2 font-semibold tracking-tight text-ink">{children}</h2>
</div>
```

`Field` (`:54–:61`) changes in one place, fixing 47 rows: `text-[12.5px]` → `text-small`, label
`text-ink-faint` → `text-ink-muted`.

### 2.1 Section order

| # | Anchor | Section (19px `H2`) | Tiles and spans | Rationale |
| --- | --- | --- | --- | --- |
| — | — | header band (`h1`) | full bleed | identity + price + IV, as today |
| — | `#answer` | *(no heading — it is the answer)* | full bleed band, § 3 | D-10 |
| 1 | `#about` | **What this is** | About `xl:col-span-12` | keeps the documented "business before numbers" order (`:68–:77`) |
| 2 | `#trade` | **The trade** | Naked short call `xl:col-span-12` | D-5: the tallest tile stops being paired with the shortest |
| 3 | `#risks` | **What kills it** | Earnings `xl:col-span-12` strip · Spike `xl:col-span-6` · Trend `xl:col-span-6` | D-5 |
| 4 | `#premium` | **Price and premium** | Price history `xl:col-span-8` · Option trend (IV) `xl:col-span-4` | unchanged proportion, now on the shared grid |
| 5 | `#sector` | **Sector and peers** | `xl:col-span-12` | D-4: the no-op 2-col grid and the no-op span both go |
| 6 | `#fundamentals` | **Long-term basics** | Basics `xl:col-span-4` · News `xl:col-span-8` | unchanged proportion, shared gridlines |
| 7 | `#record` | **My record on this name** | Position `xl:col-span-6` · Trade history `xl:col-span-6` | unchanged proportion |

Order follows the operator's decision sequence — *is it rising, is premium rich, is there a report
inside the option's life, could it spike, what is my record* — with the answer first and the
five inputs in the order they can kill the trade. `About` stays at position 1 rather than being
demoted: `:68–:77` argues on the record that an unfamiliar ticker's first question is "what is
this?", and the answer band now sits above it, so both concerns are served.

### 2.2 Earnings as a full-width strip, not a 1/3 tile

The single change that removes the worst dead area (D-5). Its content on a clear name is one badge,
one date, one sentence — that is a **strip**, and as a 12-span strip it has no unfilled area by
construction. When `verdict === "danger"` it becomes a full-width band with a rose left edge and its
two "sell this expiry instead" fields inline — full width is the emphasis a fatal gate deserves.

```tsx
<Tile title="Earnings date" hint="the gap the σ cushion cannot price"
      span="xl:col-span-12" edge={EARN_EDGE[e.verdict]}>
  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
    <span className={`rounded px-2 py-1 text-small font-semibold ${t.badge}`}>{t.label}</span>
    {e.date && <span className="tnum text-small text-ink">{formatEarningsDate(e.date)}{…}</span>}
    <p className="max-w-[80ch] text-body text-ink">{e.why}</p>
  </div>
  {e.verdict === "danger" && … /* unchanged */}
</Tile>
```

### 2.3 Spike and Trend at 6/6

Both become `xl:col-span-6`, which is where their content mass actually is, and the run-up table's
`sm:grid-cols-3` (`:287`) becomes `sm:grid-cols-6` so its six cells sit on **one** row instead of
two. Trend keeps its five-column table and its four fields go `sm:grid-cols-4` in one row. The two
tiles land within roughly a screen of each other in height instead of one being cramped beside a
roomy one.

### 2.4 What gets CUT

Deletions only — no number is recomputed, no threshold moves, nothing is rounded differently. Each
survives in the place that owns it.

| Delete | Line | Survives at |
| --- | --- | --- |
| `sc.read` paragraph in Sector & peers | `:468` | `:105` (About) — the only place it is the *sole* sector information |
| `Market cap` field | `:705` | `:86` (About facts) |
| `Volume` field | `:706` | `:87` (About facts) |
| `Beta` field | `:725` | `:89` (About facts) |
| `Next earnings` field | `:708–:723` | the Earnings tile (§ 2.2), which owns the verdict |
| `% off high` in the chart header | `:667` | `:432` (Recent trend) |
| `52w` in the chart header | `:668` | `:88` (About facts) |
| `<div className="space-y-5">` | `:648` | — (no-op, D-4) |
| the `xl:grid-cols-2` wrapper + its `xl:col-span-2` | `:697`, `:458` | — (no-op, D-4) |

That is **nine deletions**, seven of them duplicated data. Net effect: `Long-term basics` drops from
twelve fields to eight (P/E, Fwd P/E, PEG, Div yield, Profit margin, ROIC, Analyst, Target) — a
coherent "valuation and quality" tile instead of a grab bag; the chart header drops to the four trend
arrows, which are its own legend; and the page loses roughly a screen of height for free.

**Kept deliberately, despite looking duplicative:** `Its IV` / `Its 3M` in Sector & peers (`:471`,
`:475`) — they are the left-hand side of a *comparison* against the sector median and the percentile
beside them, so removing them would leave a relative number with nothing to be relative to. Same
argument for the 1M/3M rows in the Trend table versus the chart's arrows: the table carries net move,
fitted slope and R², which the arrow does not.

### 2.5 Measure

Per risk doc § 5.1, applied to a page that currently has zero width constraints:

* Every explanatory paragraph — `:97` description, `:104` sector standing, `:351` earnings why,
  `:395` trend why, `:468`→deleted, `:226` record/theme block: `max-w-[72ch] text-body text-ink`.
* Scanned lists carrying numbers — spike factors (`:274`), gate rows (`:124`), gap lists (`:306`):
  `max-w-[88ch] text-small`.
* Methodology footnotes (`:208, :315, :322, :361, :444, :530, :816`): `max-w-[80ch]` **and**
  `text-small text-ink-muted` — 12px, AA-clean. This is the D-8 rule "no grey below 12px" and it is
  the single change with the largest honesty payoff on the page.
* Tables and the chart: unchanged, full tile width. Prose and tables stop sharing a width.

### 2.6 ETF degeneracy (D-13)

Do **not** hide empty fields — "the absence of evidence is itself information" is house doctrine
(`ScShared.tsx` `CohortTable` comment) and a hidden `Beta` could read as a safe one. Instead, when
`s.type === "etf"`, render the eight company-only fields as one recessive strip under the section
note *"ETF — company fundamentals do not apply; the fund's risk is its holdings and its leverage
factor."* Labels stay in the DOM, so nothing leaves the Markdown mirror. This is a conditional
render on a flag the page already computes; no new data.

---

## 3. The answer band (the D-10 fix)

Full-bleed, directly under the header, above `About`. **It reports; it does not decide.** Every value
in it already exists on the page — the band adds no arithmetic, no threshold and no composite
verdict. Where the existing reads disagree (D-10) the band **shows the disagreement** rather than
resolving it, because resolving it would be new verdict logic and § 5 forbids that.

### 3.1 What it reads

| Element | Existing source | Currently rendered at |
| --- | --- | --- |
| state word | `verdict` — `page.tsx:164`, unchanged expression | inside `ShortCallCard` only |
| blocking gate chips | `hardFails` `:161` → `g.id` + `g.marginLabel` | `:124` gate list, 6 screens down |
| unconfirmed count | `unknowns` `:162` | badge text `:170` |
| the trade sentence | `c.proposal` — `strike, expiry, dte, estCredit, sigmas` | `:195–:203` |
| earnings chip | `earnings.verdict` + `date` + `inDays` (`:580`) | `:341` tile |
| spike chip | `spike.level` (`:587`) | `:267` tile |
| trend chip | `trendRead.verdict` (`:602`) | `:386` tile |
| record chip | `scTarget.verdict` → `TARGET_VERDICT_META[...].label` (`:576`) | `:184` |

Implementation note: lines `:160–:172` (`hardFails`, `unknowns`, `verdict`, `tone`, `badge`) are
currently local to `ShortCallCard`. Extract them **verbatim** into a pure helper in the same file,
`function scRead(c: Candidate) { … }`, called by both the band and the card. Same expression, same
output, one source. This is the only code motion the band requires.

### 3.2 Markup

```tsx
{/* The answer, before anything else. Reads only what §3.1 lists — no new computation. */}
<div id="answer" className="mt-4 scroll-mt-4 border-y border-line bg-surface">
  <div className={`border-l-4 ${r.edge} px-4 py-3`}>

    {/* line 1 — the state, and what blocks it, with margins not dots */}
    <p className="text-lede leading-snug text-ink">
      <span className="font-semibold">{r.headline}</span>
      {r.hardFails.length > 0 && (
        <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
          {r.hardFails.map((g) => (
            <span key={g.id} className="rounded bg-rose-100 px-1.5 py-0.5 text-micro font-semibold text-rose-900">
              {g.id} {g.marginLabel}
            </span>
          ))}
        </span>
      )}
    </p>

    {/* line 2 — the trade the state refers to, so "sellable" is never abstract */}
    {p ? (
      <p className="mt-1.5 max-w-[88ch] text-body text-ink">
        Sell the <span className="tnum font-semibold">{p.strike}</span> call expiring{" "}
        <span className="tnum">{p.expiry}</span> ({p.dte}d) for about{" "}
        <span className="tnum font-semibold">{money(p.estCredit)}</span> — cushion{" "}
        <span className={`tnum ${p.sigmas < ENTRY_SIGMA_FLOOR ? "text-rose-700" : "text-emerald-700"}`}>
          {num(p.sigmas, 2)}σ
        </span>.
      </p>
    ) : (
      <p className="mt-1.5 text-body text-ink">No strike could be proposed — no price or no IV snapshot.</p>
    )}

    {/* line 3 — the four reads the gate set does not gate on. Same labels, same tones, same order
        as the four sections below; each chip is an anchor to the tile that argues it. */}
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-micro">
      <a href="#risks" className={CHIP[earnTone]}>report {EARN_TONE[earnings.verdict].label.toLowerCase()}</a>
      <a href="#risks" className={CHIP[spikeTone]}>spike {SPIKE_TONE[spike.level].label.toLowerCase()}</a>
      <a href="#risks" className={CHIP[trendTone]}>trend {(trendRead.verdict ?? "no read")}</a>
      <a href="#record" className={CHIP[recTone]}>{scTarget ? TARGET_VERDICT_META[scTarget.verdict].label : "no record"}</a>
      <span className="text-ink-muted">fit {cand.signals.fit}</span>
    </div>
  </div>
</div>
```

`r.headline` is the existing `badge.text` string, unchanged: *"Clears every doctrine gate"* /
*"Clears the gates, N unconfirmed"* / *"Blocked by N gates"*. `r.edge` is the existing `tone`
(`:165`) restated as a left border. `CHIP[...]` maps the **existing** per-read tone objects
(`EARN_TONE:331`, `SPIKE_TONE:254`, `VERDICT_TONE:370`, `TARGET_VERDICT_META`) onto one chip shape —
a presentational remap of colours the page already assigns.

### 3.3 Why the three-line shape, and the one thing it must not do

On SMCI it renders, in about 80mm of vertical space:

```
Blocked by 1 gate   [SC-B1 Semiconductors already 44% of open credit (limit 25%)]
Sell the 55 call expiring 2026-10-16 (39d) for about $48 — cushion 1.60σ.
report clear · spike elevated · trend up · Too few trades · fit 14
```

Three lines, and the operator has the yes/no, the blocker with its margin, the trade it refers to,
and — critically — the fact that **the gate set said no for a reason unrelated to the two reads that
should worry them most**. That contradiction (D-10) is now visible in one glance instead of six
screens, and it is visible *as a contradiction*, which is the honest presentation.

**The band must never fuse the four chips into a single new verdict.** No "overall: avoid", no score,
no count of red chips. The gate verdict is `page.tsx:164` and stays the only verdict; the chips carry
their own existing labels. If the operator later wants a fused read, that is a change to
`sc-candidates.ts` gate logic and a different proposal.

---

## 4. `PageToc` items

`PageToc` (`src/components/PageToc.tsx`) is used as-is — sticky rail at `lg:`, horizontal strip
below, plain anchors, no client JS. Wrap the sections exactly as `risk/page.tsx:363–366` does:

```tsx
<div className="mt-4 flex items-start gap-6">
  <PageToc items={toc} />
  <div className="min-w-0 flex-1"> … sections … </div>
</div>
```

`count`/`tone` reuse values the page already has:

```tsx
const toc: TocItem[] = [
  { id: "answer", label: "Should I sell?",  count: r.hardFails.length || "clear",
    tone: r.hardFails.length ? "bad" : r.unknowns.length ? "warn" : "ok" },
  { group: true, id: "g-what", label: "What it is" },
  { id: "about",        label: "What this is" },
  { group: true, id: "g-trade", label: "The decision" },
  { id: "trade",        label: "The trade",         count: cand ? `fit ${cand.signals.fit}` : null },
  { id: "risks",        label: "What kills it",     count: spike.factors.filter((f) => f.severity === "high").length || null,
                                                    tone: spike.level === "high" || spike.level === "elevated" ? "bad" : spike.level === "moderate" ? "warn" : "ok" },
  { id: "premium",      label: "Price & premium",   count: s.ivStats.rank != null ? `IVR ${s.ivStats.rank.toFixed(0)}` : null },
  { group: true, id: "g-ctx", label: "Context" },
  { id: "sector",       label: "Sector & peers",    count: sectorCtx.members },
  { id: "fundamentals", label: "Long-term basics" },
  { id: "news",         label: "News",              count: news.length ? `${negCount}/${news.length}` : null,
                                                    tone: negCount > 0 ? "warn" : "ok" },
  { id: "record",       label: "My record",         count: rec ? rec.trades : null,
                                                    tone: scTarget?.verdict === "avoid" ? "bad" : scTarget?.verdict === "size_down" ? "warn" : "ok" },
];
```

Eight links plus three group labels. `#news` is an id on the News tile inside `#fundamentals`, so the
rail can reach it without a section of its own. Every `count` and `tone` is derived from a value
already on the page; none introduces a threshold that is not already in `lib/`.

---

## 5. What must not change

* **Every number, threshold, gate id, gate title, `marginLabel`, verdict, severity and severity
  ordering.** No rounding changes, no unit changes, no reordering of gate lists.
* **`export const dynamic = "force-dynamic"` (`:25`) and the server-component structure.** No hooks,
  no state, no client JS. The only client components remain `HistoryChart` (`:670`) and
  `IvLine`/`RoicYearBars` (`:675`, `:735`). Any collapse must be `<details>`/`<summary>`, never JS.
* **The Markdown mirror must keep working.** `/md/stock/SMCI.md` returns 200 / 11,714 bytes today
  and extracts `#page-content` (`src/lib/page-markdown.ts:151`, id set in `src/app/layout.tsx:21`),
  so new wrappers are safe as long as they stay inside `<main>`. **Note the difference from the risk
  doc's check:** headings change level (twelve `##` → seven `##` + twelve `###`), so the mirror is
  *not* expected to be byte-identical. Verify instead that **no section disappears**:
  `curl -s http://localhost:19210/md/stock/SMCI.md | grep -c '^#'` should rise, not fall, and the
  nine deletions in § 2.4 should account for the entire drop in body bytes.
* **`src/components/ScShared.tsx` must not be edited.** Its `H2` is still the pre-redesign
  `text-[13px] uppercase text-ink-faint`, and it is used by the `/short-call/*` pages. Copy
  `risk/page.tsx`'s local `H2` into the stock page; do not "fix" the shared one as a shortcut, or
  three other pages restyle silently. Deduplicating the two `H2`s is a separate, tested change.
* **Nothing may be hidden to shorten the page** — no tabs, no accordion that removes text from the
  DOM, no "show more" that drops content from the mirror. The nine deletions in § 2.4 are the only
  content removals, and each is a duplicate whose sole surviving copy is named.
* **The four verdict tones keep their current meanings**: falling is *favourable* for a short call
  (`VERDICT_TONE:370`, emerald on `down`), a missing earnings date is *caution* not safety, and a
  constructed credit stays labelled as a Black-Scholes construction (`:208`).
* The trend/gate divergence note (`:396–:405`) stays, in full. It is the page's most valuable
  sentence and § 3 depends on the same honesty.

---

## 6. Order of work

Each phase is independently shippable and each ends with the atomic deploy —
`npm run build && sudo systemctl restart option_harvester` — then verify `/stock/SMCI`,
`/stock/SPY`, `/stock/TSLL` on both ports plus `/md/stock/SMCI.md`.

| Phase | Change | Why here |
| --- | --- | --- |
| **1** | **The nine deletions of § 2.4.** Pure subtraction: seven duplicated data points, two no-op wrappers. | Smallest possible diff, zero risk, and it removes ~a screen of height plus the "did those two numbers match?" tax. Fixes D-6 and D-4. Ship it alone and look at the page before touching layout. |
| **2** | Type and colour: adopt the house tokens in `Card`/`Field`/all 72 literals, `h2`→`h3 text-lede`, footnotes to `text-small text-ink-muted`, prose `max-w-[72ch]`. | Fixes D-1, D-7, D-8, D-9 without moving a single tile. Largest readability gain per line changed, and it is applying an already-decided standard, so there is nothing to debate. |
| **3** | Section headings (`H2` copied from `risk/page.tsx`), anchor ids, `PageToc` rail, § 2.1 order. | Fixes D-2. Depends on phase 2 for the 19px token to exist in this file's vocabulary. This is the phase that answers "the layout is bad" most directly — twelve tiles become seven chapters. |
| **4** | The 12-column grid: one `xl:grid-cols-12` per band, spans from `{4,6,8,12}`, `Card`→`Tile` flush hairline bands, `tone`→`border-l-2` edge, Earnings as a 12-strip, Spike/Trend at 6/6, run-up table to `sm:grid-cols-6`. | Fixes D-3, D-5, D-12. Most markup churn, so it goes after the content is stable and the sections are drawn. |
| **5** | **The answer band** (§ 3), including the `scRead()` extraction. | Fixes D-10. Reads existing data only. Placed here because it depends on the § 2.1 anchors for its chip links — **but it is the highest-value phase for the operator's actual job, so pull it to position 2 on request** and let the chips link to nothing until phase 3. |
| **6** | Polish: header chip shows `s.final.reason` (D-11) and renders nothing rather than `— —` when `side == null`; the ETF fundamentals strip (D-13); optional `<details>` clamp on `s.description`. | Small, independent, none of it blocks anything. |

After phases 1–3, ask the operator whether the complaint is resolved before doing 4. The diagnosis
says duplication, heading inversion and the missing section level account for most of "the layout is
bad", and phase 4 is a large diff to spend on an unverified assumption — the same discipline the risk
doc applied to its own phases 2–6.

---

## 7. What I could not verify

* **No visual inspection.** I read the source, rendered the page over HTTP and read the Markdown
  mirror for SMCI, TSLL, BIDU, SPY and ALB. I did not view it in a browser, so I did not measure
  pixel height (the "~10 screens" figure is the operator's, not mine), did not confirm the height
  mismatches in D-5 as rendered geometry rather than as content mass, and cannot rule out a defect
  that only appears at the operator's window size or zoom.
* **`s.final.side` population.** I sampled six tickers and found three `null`. I did not measure the
  rate across the universe, so "frequently `— —`" in D-11 is a sample, not a census.
* **Whether the 12-column grid interacts badly with `zoom: 1.125`.** `gap-px` under a fractional
  zoom can rasterise unevenly; `/risk` already ships `gap-px bg-line` bands, which is good evidence
  it is fine, but I did not verify it at 12 columns.
* **Which of the twelve tiles the operator actually finds unreadable.** "The layout of the company
  details is bad" is a whole-page report. The phasing is my ordering by measured severity and
  risk-adjusted value, not theirs.

---

## Executive summary — the recommended skeleton

1. **Header** — ticker, name, price, change, IV/rank; the `— —` chip either explains itself with the already-computed `final.reason` or renders nothing.
2. **Answer band** (full bleed, `#answer`) — three lines: the existing gate verdict plus blocking gate chips with margins; the proposed strike/expiry/credit/cushion; then earnings · spike · trend · own-record chips. Reports, never fuses.
3. **§1 What this is** (`#about`, span 12) — description at `max-w-[72ch]`, the eight-fact rail, sector standing kept here and deleted from Sector & peers.
4. **§2 The trade** (`#trade`, span 12) — Naked short call full width, so the page's tallest tile stops sitting beside its shortest.
5. **§3 What kills it** (`#risks`) — Earnings as a span-12 strip, then Spike 6 / Trend 6; the run-up table goes to one row of six.
6. **§4 Price and premium** (`#premium`) — chart 8 / IV 4, with the duplicated `% off high` and `52w` removed from the chart header.
7. **§5 Sector and peers** (`#sector`, span 12) — the no-op 2-col grid and its no-op `col-span-2` both deleted.
8. **§6 Long-term basics** (`#fundamentals`) — basics 4 / news 8, down to eight fields after cap, volume, beta and next-earnings go to their owners.
9. **§7 My record** (`#record`) — position 6 / history 6; reachable from the rail instead of being the unindexed bottom of the page.
10. **Throughout** — one `xl:grid-cols-12` grid with spans only from `{4,6,8,12}`; flush `gap-px bg-line` tiles instead of twelve rounded outlines; `h2` 19px sections above `h3` 16px tile titles above 14px body; house tokens replacing all 72 `text-[Npx]` literals; no grey below 12px; every paragraph measured. Ship as: delete duplication → type → sections+ToC → grid → answer band → polish.
