# `/stock/[ticker]` — visual audit against the house design system

**Status: implemented and deployed 2026-09-07.** Written by the `ux-visual` role after an operator
report that "the layout of the company details is bad", then executed by the default agent.
Verified against the running page:

* **Blocks A, B, C and D all shipped.** `text-[Npx]` **72 → 0** across 12 distinct sizes; half-pixel
  values **32 → 0**; sub-11px **2 → 0**; `text-ink-faint` text uses **52 → 0**. Card titles rose
  12.5 → `text-lede` (16) against 14px body, inverting the D-1 relationship.
* **The grey ruling held.** All four sentences named in § 2.1 — the spike factor `detail`, `e.why`,
  `r.why` and `sc.read` — are `text-ink`. Every footnote is `text-small` `ink-muted`, so nothing grey
  sits below 12px.
* **Hue reduced to breach / caution / pass / neutral**, named once as local constants at the top of
  the page (the `breach`/`caution`/`pass` Tailwind tokens were never shipped and
  `tailwind.config.ts` is shared with 35 files, so § 3.2's tokens are expressed as four `const`s
  instead). `orange`, `indigo` and the raw `#0f766e` are gone — grep returns zero.
* **Both ramps are structural.** Spike: dot count `○ / ● / ●● / ●●●` + edge width 0/2/3/4px +
  weight, hue only at the ends. Trend: the five-cell `▪▫▫▫▫` gauge with `mixed` off-axis in the `?`
  cell as the one legitimate amber. Factor marks split `▲` (high) from `△` (medium).
* **Departure — `ACTION_META` keeps `sky`.** Shared lib; see the sibling doc's Departure 1.
* **Correction found while implementing**: the answer-band chip read "report clear of the report"
  because it prefixed a label that already contained the word. `EARN_RAMP` now carries a separate
  `chip` string.

Original brief follows. The authority for every ruling below is
**[docs/proposals/risk-page-redesign.md](risk-page-redesign.md)** — § 2 (type scale), § 3.1 (grey),
§ 3.2 (hue), § 4 (ramps encode as structure). The tokens in `globals.css` and `tailwind.config.ts`
are **correct and out of scope**: they ship to 35 other files and this audit proposes no change to
them. The only instrument here is call sites in `src/app/stock/[ticker]/page.tsx`.

Scope discipline, same as the `/risk` spec: **no number, threshold, gate id, verdict or severity
ordering changes.** This is presentation only.

**Companion document:** [`stock-page-redesign.md`](stock-page-redesign.md) covers the same page's
**layout and information architecture** (the card skeleton, the answer band, `PageToc` items). This
audit covers **type and colour only** and deliberately proposes no grid change — the two are
independent and can ship in either order, though the two-line Block A below is the cheapest.

Reference implementation: `src/app/risk/page.tsx`, already migrated. Measured target state —
**0** arbitrary `text-[Npx]`, **0** `text-ink-faint` text applications, 26 `text-micro`,
18 `text-small`, 17 `text-body`, 3 `text-lede`, 2 `text-h2`, 2 `text-h1`, 1 `text-kpi`,
1 `text-kpi-lg`, and 63 `text-ink` against 37 `text-ink-muted`.

Line numbers are from the file as read at audit time. Apply the § 5 checklist by **string match**,
or bottom-up, since earlier edits shift later lines.

---

## 0. Diagnosis — why "the layout is bad" is a typography report

The page is not too dense and the information architecture is sound: *what the thing is* → *the
trade* → *the two risks that veto it* → *history*. The complaint is mechanical, and it is the same
three defects the `/risk` spec already diagnosed and fixed there.

**D-1 reproduced verbatim.** `Card` (`:47`) renders every card title as `text-[12.5px]
font-semibold text-ink`, and the body inside those cards is `text-[12.5px]` / `text-[13px]` prose
(`:97, :194, :351, :395, :468`). **A card title is the same size as, or smaller than, the content it
introduces.** Fourteen cards, one type size. There is no *chapter* signal, so the reader gets an
undifferentiated field of 11–13px text and reads it as a wall. This is the single largest cause of
the complaint and it is one line to fix.

**D-2 reproduced and worse.** Twelve distinct sizes: **9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5,
16, 24, 28** across **72** `text-[Npx]` applications. **32 of the 72 are half-pixel**, banned by
§ 2: under `body { zoom: 1.125 }` a 0.5px step becomes 0.56px — invisible as hierarchy — while
landing every glyph off the device-pixel grid, so hinting and baseline snapping differ row to row.
The page pays the full cost of twelve sizes and receives the hierarchy of about three. Two values
(`9.5px`, `:778` and `:800`) are **below the documented 11px floor**; at 1.125 zoom that is 10.7
device px of uppercase tracked grey, which is decoration, not text.

**D-3 reproduced as a call-site problem.** The token was already darkened to `#6b7280` (4.83:1), so
nothing here fails AA outright — but this page applies `text-ink-faint` **52 times** against 29
`ink-muted` and only 34 `ink`, and **23 of those greys sit below 12px**, the exact compound § 3.1
rule 1 forbids. Grey is this page's default and ink is the exception, which is the inversion § 3
calls the primary defect. `/risk` after migration is 63 ink / 37 muted / **0 faint**.

**D-4 reproduced at higher amplitude.** Eight hues in play — emerald, amber, orange, rose, indigo,
sky, a raw `#0f766e` teal and accent blue — carrying at least nine meanings each for emerald, amber
and rose, including **two that directly contradict each other inside one card** (§ 3).

Two layout observations, offered without a redesign since they are not the reported cause: the
three-column grids alternate `2+1` then `1+2` (`:643`, `:649`) which zigzags the eye down the page;
and `:755` is an `xl:grid-cols-2` grid containing a single `xl:col-span-2` child, i.e. a grid doing
nothing. Neither is worth touching before the type pass lands.

---

## 1. Size mapping — every arbitrary value → a token

Eight of the twelve sizes serve **two or more distinct purposes**, so eight rows split. The result
is the six scale steps plus `text-kpi`/`text-kpi-lg`, and the smallest text on the page rises from
9.5px to 11px.

| Now | n | Purpose at the call site | → Token | Rationale |
| --- | --- | --- | --- | --- |
| **9.5px** | 1 | `ACTION_META` suggestion chip (`:778`) | `text-micro` | § 2: chips are `--fs-micro`. 9.5 is below the 11px floor; nothing on any page may be smaller. |
| | 1 | trade-history `thead` (`:800`) | `text-micro` | § 2: column headers are `--fs-micro`. Same floor. |
| **10px** | 4 | `thead` × 3 (`:406, :496, :765`), ROIC overline (`:734`) | `text-micro` | Column headers and overlines are the canonical `--fs-micro` use. § 3.1 rule 1: *"never 10 or 10.5"*. |
| | 2 | ETF pill (`:622`), expiry chips (`:690`) | `text-micro` | Chips. |
| | 1 | peer flags cell `NC ▾ ◆` (`:522`) | `text-micro` | Glyph column, not text — micro is correct and it is already ink-faint-as-furniture. |
| | 1 | **KPI sub-line** `all $X` (`:794`) | `text-small` | *Split.* This is a caption on a value, not a header — no uppercase, no tracking, so the 11px header carve-out does not cover it. § 3.1 rule 1 forces it to 12px to stay grey. |
| **10.5px** | 6 | provenance / method footnotes (`:208, :315, :322, :361, :444, :530`) | `text-small` | § 2: `--fs-small` is *"footnotes"*. This is the largest single group and the one that most needs the floor. |
| | 1 | news byline + date (`:750`) | `text-small` | *Split.* Caption, stays grey, therefore ≥ 12px. Keeps a clean 14/12 step against the headline. |
| | 1 | "…showing latest 14 of N" (`:816`) | `text-small` | Footnote with a link. |
| | 1 | **suggestion `why`** (`:778`) | `text-small` | *Split.* This is **reasoning**, not a footnote — see § 2. Size to small, colour to `ink`. |
| | 1 | "Percentiles withheld" (`:296`) | `text-small` | *Split.* A stated data limit. Size to small; hue stays `caution` (§ 3, the canonical use). |
| **11px** | 1 | own-record chip (`:183`) | `text-micro` | Chip. |
| | 4 | card `hint` (`:48`), fit strip (`:187`), peer counts (`:464`), IV/rank (`:635`) | `text-small` | *Split.* Captions and metric strips: grey, lower-case, untracked → 12px floor applies. |
| | 1 | **"falling or flat is the favourable side"** (`:391`) | `text-small` | *Split.* This is a **legend** — it states what the badge means. § 3.1 rule 2 makes it ink; size small. |
| **11.5px** | 2 | peers table (`:495`), trade-history table (`:799`) | `text-small` | § 2: table cells are `--fs-small`. |
| | 3 | gate rows (`:125`), spike factors (`:275`), gap rows (`:305`) | `text-small` | § 2: *"evidence bullets"*. Exactly what these are. |
| | 3 | **prose blocks** — own-record paragraph (`:226`), gate-divergence callout (`:397`), held-peers callout (`:482`) | `text-body` | *Split.* Running prose. § 2: *"all prose: mechanism, action, section intros"* = 14px. `:397` is the most important sentence in `TrendCard` and is currently the second-smallest text in it. |
| **12px** | 5 | verdict chips (`:181, :269, :343, :388, :634`) | `text-micro` | Chips. Dropping them 12 → 11 while titles rise 12.5 → 16 is what makes the chip read as a *label on* the card rather than a peer of it. |
| | 3 | trend table (`:405`), position table (`:764`), price-history legend (`:662`) | `text-small` | Table cells / a scanned metric strip. |
| | 2 | earnings date value (`:345`), sector name (`:463` sub-industry) | `text-body` | Values and sub-heads sit at body. |
| | 2 | `◆` held glyph (`:623`) — and no other | `text-body` | Icon; size only, no semantic change. |
| | 3 | **`e.why` (`:351`), `r.why` (`:395`), `sc.read` (`:468`)** | `text-body` | *Split.* Reasoning prose — the three sentences that explain the three verdicts. See § 2. |
| | 1 | **sector-standing paragraph (`:104`)** | `text-body` | *Split.* Prose. |
| | 1 | **spike headline `r.headline` (`:270`)** | `text-lede` | *Split.* § 2: `--fs-lede` is *"the brief's headline sentence"*. This is that sentence for this card. |
| **12.5px** | 1 | **`Card` title (`:47`)** | `text-lede` | **The D-1 fix.** 16 > 14 body, so a title finally outranks its own content. Highest-value single edit on the page. |
| | 1 | `Field` row (`:56`) | `text-small` | Label/value pairs are table rows in disguise; § 3.1's table puts cells at small. |
| | 1 | business description (`:97`) | `text-body` | Prose — the paragraph the card exists to show. |
| | 6 | empty-state explanations (`:99, :153, :214, :743, :762, :790`) | `text-body` | *Split.* Each explains **why** there is nothing to show ("no IV snapshot and no expiry ladder, so there is nothing to propose"). That is reasoning, at body, in ink. |
| | 1 | sector name (`:462`) | `text-body` | Sub-head inside the card. |
| | 1 | news row (`:747`) | `text-body` | Primary content — a headline you are meant to read and click. |
| **13px** | 1 | **"Sell the K call expiring E…" (`:194`)** | `text-lede` | *Split.* The single most consequential sentence on the page: the trade. § 2 lede. |
| | 1 | masthead name + sector (`:626`) | `text-body` | Sub-line under `h1`. |
| | 1 | day change % (`:631`) | `text-body` | *Split.* Secondary to the price. |
| | 1 | `▾` downtrend glyph (`:624`) | `text-body` | Icon. |
| **13.5px** | 1 | company name `s.name` (`:95`) | `text-lede` | The lede of the About card. Only 13.5 on the page — a size that exists for one string is the definition of an unmanaged scale. |
| **16px** | 4 | trade-history KPI values (`:794–797`) | `text-kpi` | § 2: *"KPI values: 22px semibold"*. At 16 these four numbers are currently the same size as a card title should be and read as body. |
| **24px** | 1 | price (`:630`) | `text-kpi` | § 2 KPI. Deliberately **not** `text-kpi-lg` (26): at 26 it competes with the 28px ticker and the masthead loses its anchor. |
| **28px** | 1 | ticker `h1` (`:621`) | `text-h1` | Same rendered size, tokenised. |

**Net effect:** 12 sizes → 8 (six steps + two KPI), 32 half-pixel values → 0, sub-11px values → 0,
and the title/body relationship inverts from 12.5-over-12.5 to **16-over-14**.

There is no `text-h2` use in the mapping and that is deliberate: this page has no section headings —
it is a grid of cards, and `Card` titles are the chapter level. If a future pass groups the fourteen
cards into named bands ("The trade", "The risks", "My record"), those band headings are `text-h2`.

---

## 2. Grey audit — "grey is for what a number *is*, never for what it *says*"

§ 3.1 rule 2 is the whole ruling. A **label** may be grey. A **value** may be grey only where it is
subordinate to a value beside it. A **reason** and an **instruction** may never be grey, at any size.
Rule 1 then caps the rest: **no grey below 12px**, with the single carve-out the spec names —
uppercase, tracked **column headers and overlines** may be `text-micro` (11) + `ink-muted`, because
tracking and caps buy back what the size costs. Nothing else grey may sit below 12.

`text-ink-faint` becomes **non-text only** on this page, exactly as on `/risk`: hairlines, the sector
dot, the `·` placeholder glyphs, the peer-flags glyph column. Every one of the 52 current text uses
resolves to `ink-muted`, `ink`, or is deleted with its element.

### 2.1 The explicit rulings requested — all four are reasoning text, all four go to `ink`

| Element | Now | Ruling | Why |
| --- | --- | --- | --- |
| **Spike-risk factor `f.detail`** (`:277`) | `text-ink-muted` inside `text-[11.5px]` | **`text-ink`, `text-small`** | The `label` is *"Strike was reached often in its own history"*; the `detail` is the evidence that makes it true — the touch rate, the σ distance, the window count. The page currently prints the claim in near-black and **its proof in grey**. That is rule 2 backwards. The `label`/`detail` distinction survives on **weight** (`font-medium` vs regular), which is already there. |
| **Earnings `e.why`** (`:351`) | `text-[12px] text-ink-muted` | **`text-body text-ink`** | This is the entire content of `EarningsCard` below the badge. The badge says *"Report inside the trade"*; `why` says why that is fatal and what the σ cushion cannot price. If one of the two is grey it must be the badge, not the sentence. |
| **Trend `r.why`** (`:395`) | `text-[12px] text-ink-muted` | **`text-body text-ink`** | Same shape. The verdict chip is a five-way enum; `why` is the reading. |
| **Sector `sc.read`** (`:468`, and the duplicate at `:104`) | `text-[12px] text-ink-muted` | **`text-body text-ink`** | This is a written interpretation of the peer set — the most prose-like string on the page. It appears **twice** (once as "Sector standing." in `Introduction`, once in `SectorCard`); both go to ink, and the duplication is worth a separate look. |

The `/risk` spec already supplies the proof for this: its `action` line was the one prose element
already in `text-ink` and § 3.1b records it as *"noticeably the most readable prose on the page — that
is the proof of the fix, and it should be the rule rather than the exception."*

### 2.2 Must move to `text-ink` — reasons, instructions and primary values

| Line | Element | Now | → |
| --- | --- | --- | --- |
| `:97` | business description | `ink-muted` 12.5 | `text-body text-ink` |
| `:99` | "no profile description on file … the ingest pulls it from the quote summary" | `ink-faint` 12.5 | `text-body text-ink` |
| `:104` | "Sector standing." + `sc.read` | `ink-muted` 12 | `text-body text-ink` |
| `:133` | gate row wrapper carrying `g.marginLabel` | `ink-muted` 11.5 | `text-small text-ink` — the margin (*value vs limit*) is the gate's substance; § 6 of the `/risk` spec forbids a chip losing it, and greying it is a softer form of the same loss |
| `:153` | "No option chain data … nothing to propose" | `ink-faint` 12.5 | `text-body text-ink` |
| `:214` | "No strike could be proposed — that needs both a price and an IV snapshot" | `ink-faint` 12.5 | `text-body text-ink` |
| `:226–241` | "Your record here:" paragraph, `rec.verdictWhy`, theme load, profile misses | `ink-muted` 11.5 | `text-body text-ink` (the leading `font-semibold text-ink` labels stay) |
| `:277` | spike factor `detail` | `ink-muted` | `text-ink` |
| `:308, :312` | `gap:` / `close-to-close:` **values** | inherit `ink-muted`, label spans `ink-faint` | values → `text-ink`; the two `gap:` / `close-to-close:` labels → `ink-muted` |
| `:351` | `e.why` | `ink-muted` | `text-body text-ink` |
| `:391` | "for a short call, falling or flat is the favourable side" | `ink-faint` 11 | `text-small text-ink` — a legend states meaning |
| `:395` | `r.why` | `ink-muted` | `text-body text-ink` |
| `:415` | trend-table `Fitted` column | `ink-muted` | `text-ink` — § 3.1's table puts `tbody` cells at ink |
| `:421` | trend-table `R²` column | **`ink-faint`** | `text-ink` |
| `:468` | `sc.read` | `ink-muted` | `text-body text-ink` |
| `:514, :516` | peer `Sub-industry`, `Cap` | `ink-faint` | `ink-muted` (identifiers, subordinate) — never faint |
| `:515, :517` | peer `Price`, `IV` | `ink-muted` | `text-ink` — primary cells |
| `:743, :762, :790` | three empty states | `ink-faint` 12.5 | `text-body text-ink` |
| `:778` | `sug.why` (the per-leg instruction) | `ink-muted` 10.5 | `text-small text-ink` — this is an **instruction**; it is currently the smallest and one of the faintest strings on the page |
| `:772–776` | position table `Qty`/`Strike`/`Expiry` | `ink-muted` | `text-ink` |
| `:806, :808, :810` | history table `Strat`/`Expiry`/`Status` | `ink-muted` | `text-ink` |
| `:809` | history `DTE` | **`ink-faint`** | `ink-muted` |
| `:811` | history P/L when `status === "open"` | `ink-faint` | `ink-muted` + the literal "open" is a state, not a number |

### 2.3 Stay grey, but as `ink-muted` and never below 12px

| Line(s) | Element | → |
| --- | --- | --- |
| `:48` | card `hint` | `text-small text-ink-muted` |
| `:57` | `Field` label | `text-ink-muted` (the value beside it stays ink) |
| `:134` | gate `(spec)` parenthetical | `ink-muted` |
| `:187, :464, :635` | fit strip, peer counts, IV/rank | `text-small text-ink-muted`; the **numbers inside** them → `text-ink` |
| `:315, :322, :361, :444, :530` | provenance / method footnotes | `text-small text-ink-muted` |
| `:208` | "Strike and credit are Black-Scholes constructions … not quotes" | `text-small text-ink-muted` — a *disclaimer* is metadata about the number, which rule 2 permits; but never at 10.5 |
| `:626` | masthead sector / sub-industry tail | `ink-muted` |
| `:690` | expiry chip `Nd` tail | `ink-muted` |
| `:750` | news byline | `text-small text-ink-muted` |
| `:816` | "showing latest 14 of N" | `text-small text-ink-muted` |
| `:406, :496, :765, :800` | four `thead`s | `text-micro text-ink-muted` — the named carve-out |
| `:122, :286, :306, :618, :794–797` | eight `.overline`s | `text-ink-muted` — `.overline` is already 11px + `0.14em` tracking + caps, so the carve-out covers it |
| `:734` | ROIC-by-year overline | `text-micro text-ink-muted` |

### 2.4 Remains `ink-faint` — non-text only

`:422, :519` (the `·` placeholder when a trend label is absent), `:522` (the `NC ▾ ◆` glyph column),
`:665` (the `·` in the price-history legend), `:748` (the `·` news bullet), the `TREND_CLS.sideways`
entry, and `border-line` hairlines. Everything else in the 52 is text and moves.

**Resulting balance:** 52 faint / 29 muted / 34 ink becomes roughly **6 faint (all glyphs) / 38 muted
/ 71 ink** — the same shape as migrated `/risk` (0 / 37 / 63), and the inversion § 3 calls the primary
defect is gone.

---

## 3. Hue audit against § 3.2

§ 3.2 permits exactly three semantic hues plus neutral: `breach` (rose-700), `caution` (amber-700),
`pass` (emerald-800), neutral (`ink` / `bg-line` / hairline). The page currently runs **eight** hues.

### 3.1 What each hue means today

| Hue | Distinct meanings currently carried |
| --- | --- |
| **emerald** | gate passes (`:128, :168`) · spike **low** (`:255`) · earnings **clear** (`:334`) · trend **down**/**weak** (`:371–372`) · cushion above the σ floor (`:203`) · price **below** SMA50/200 (`:436, :441`) · **positive** return / P/L (`:38` via `pnlCls`) · **rising** price (`:40` via `TREND_CLS`) · premium collected (`:796`) · **the instrument is a call** (`:561`) |
| **amber** | gate **unknown** (via `bg-line`, but amber for the card border `:165`) · spike **moderate** (`:256`) · earnings **unconfirmed** (`:333`) · trend **mixed** (`:374`) · thin weekly ladder (`:682`) · earnings 11–35 d out (`:718`) · percentiles withheld (`:296`) · the gate-divergence note (`:397`) · the held-peers note (`:482`) |
| **rose** | gate fails (`:128, :171`) · spike **high** (`:258`) · earnings **danger** (`:332`) · trend **up** (`:375`) · cushion below the floor (`:203`) · worst run-up (`:292`) · wide spread (`:686`) · earnings ≤ 10 d (`:716`) · **negative** return / P/L (`:38`) · **falling** price (`:40`) · negative news (`:748`) · sustained downtrend (`:624`) |
| **orange** | spike **elevated** — one meaning, one call site (`:257`) |
| **indigo** | the instrument is a **put** (`:561`) |
| **sky** | `take_delivery`, `watch` (`ACTION_META`) |
| `#0f766e` raw teal | ROIC ≥ 15% (`:728`) |
| accent blue | links, the held `◆` (`:623`) |

### 3.2 Where hue is doing double duty

**(a) The self-contradiction, and it is inside one card.** `TrendCard` colours its verdict badge with
`VERDICT_TONE`, where **`down` is emerald and `up` is rose** — correct for a seller, and the code even
says so in a comment (`:371`). Eleven lines further down, the same card's table colours the *Net move*
column with `pnlCls` (`:419`, positive → emerald) and the *Label* column with `TREND_CLS` (`:422`,
`up` → emerald). **So the card renders "UP" in red at the top and "↑ up" in green in the row below
it, four centimetres apart.** No reader can build a rule from that, and the one they will build is
"green is good" — which is the wrong rule on this page.

**(b) Amber is four unrelated things**, precisely the D-4 pattern: *uncertainty* (unconfirmed date,
withheld percentiles), *mild badness* (spike moderate, thin ladder, earnings 11–35 d), *disagreement*
(the gate-divergence note), and *neutral cross-reference* (the held-peers note, which is a
navigational aid styled as a warning). § 3.2 assigns amber to **uncertainty and nothing else**.

**(c) Emerald means "pass" and also means "this is a call."** `sideCls` (`:561`) paints the `NC` chip
emerald and the `NP` chip indigo. That is a **category**, not a verdict, and it collides head-on with
emerald-as-pass three chips away. The `NC` / `NP` text already carries the category; the hue is
redundant and actively misleading.

**(d) Four ordinal ramps compete for three hues.** Spike needs 4 levels, trend 5, earnings 4, gates
3. That is 16 states against 3 legal hues, which is how `orange` got invented — a hue that exists
solely to fill a ramp slot and carries no meaning anywhere else in the app. § 4 is the answer: ramps
encode as structure.

### 3.3 The inversion trap — ruled explicitly

**Green-means-up is wrong on this page and must be deleted.**

This page exists to answer one question: *should I sell a naked call on this name?* The reader is
always the **seller of upside**. In that frame a **falling** price is favourable (the strike moves
further away, the option decays) and a **rising** price is the threat (assignment, unbounded loss).
`VERDICT_TONE`, the SMA fields and `pnlCls(-sc.relRet3m)` already encode this correctly. `pnlCls` on
price returns and `TREND_CLS` do not.

The ruling, in two parts:

1. **`TREND_CLS` inverts.** `up → breach`, `down → pass`, `sideways → neutral ink-muted`. The
   `TREND_ARROW` glyphs `↑ ↓ →` stay — direction is carried by the arrow, valence by the hue, and
   after the inversion the two finally agree with the badge above them.
2. **`pnlCls` is split in two, because it is currently serving three different questions.**
   * **`pnlCls` keeps only actual money** — realized P/L, unrealized P/L, proceeds, premium
     (`:631` is *not* money; `:777, :794, :811` are). Here positive genuinely is good, and green is
     correct.
   * **A new `dirCls` handles price direction** — rising → `breach`, falling/flat → `pass`. Applies
     to `:419` (net move), `:471` (its 3M), `:518` (peer 3M), `:631` (day change %), `:730` (analyst
     target upside — a target *above* spot is upside risk to a call seller, so the current
     `pnlCls(tgt)` is backwards too).
   * **Relative-to-sector and IV richness are neither** — `:473` already negates
     (`pnlCls(-sc.relRet3m)`), which is a hand-rolled `dirCls` and should become one; `:477`
     (`Relative IV`) is **richness, not direction** — higher IV is more premium — and should be
     neutral `text-ink font-semibold` rather than borrowing green, so the palette does not acquire a
     fourth meaning.

The comment at `:371` proves the author already knew the correct orientation. The defect is that it
was applied in one of five places.

### 3.4 The single consistent assignment

| Token | Means, and only means | Call sites after the pass |
| --- | --- | --- |
| **`breach`** rose-700 / rose-50 | a doctrine rule is broken, or the name is moving against the seller **now** | gate `pass === false` (`:128, :133, :171`) · card border when blocked (`:165`) · spike **high** (`:258`) · earnings **danger** (`:332`) · trend verdict **up** (`:375`) · cushion < `ENTRY_SIGMA_FLOOR` (`:203`) · worst run-up ≥ cushion (`:292`) · price above SMA50/200 (`:436, :441`) · rising net move (`:419, :471, :518, :631`) · spread > 15% (`:686`) · earnings ≤ 10 d (`:716`) · negative news (`:747, :748`) · sustained downtrend `▾` (`:624`) · negative money (`pnlCls`) |
| **`caution`** amber-700 / amber-50 | **uncertainty only** — an input is missing, stale or unconfirmed, and a gate therefore cannot be answered | gate `pass === null` (`:128`) · card border when `verdict === "check"` (`:165`) · earnings **unknown** (`:333`) · percentiles withheld (`:296`) · trend verdict **mixed** (see § 4.2 — the two windows disagree, which *is* uncertainty) · no IV snapshot (`:214`) |
| **`pass`** emerald-800 / emerald-50 | compliant, inside a limit, or moving in the seller's favour | all hard gates clear (`:128, :168`) · spike **low** (`:255`) · earnings **clear** (`:334`) · trend **down**/**weak** (`:371–372`) · cushion ≥ floor (`:203`) · price below SMA (`:436, :441`) · falling net move · "Sell this expiry instead" (`:356`, the remedy) · positive money (`pnlCls`) |
| **neutral** `ink` / `ink-muted` / `bg-line` | no verdict is being expressed | `NC`/`NP` side chip (`:561` — **drop emerald and indigo**) · `earnings n/a` (`:335`, already correct) · spike **moderate** and **elevated** (§ 4.1) · trend **flat** (`:373`) · `info`-severity factors (`:260`, already correct) · `take_delivery` / `watch` / `hold` in `ACTION_META` (**drop sky**) · ROIC ≥ 15% (`:728` — **drop the raw `#0f766e`**; a fundamental quality flag is not a doctrine verdict, so `text-ink font-semibold` carries it) · thin weekly ladder (`:682` — a liquidity *fact*, not an uncertainty; **drop amber**) · earnings 11–35 d (`:718` — **drop amber**; either the print is inside the trade, which is `breach`, or it is not) · `Relative IV` (`:477`) |

**Deleted outright: `orange`, `indigo`, `sky`, `#0f766e`.** Four hues, zero information lost, because
every one of them was encoding a *category* or a *ramp position* — both of which § 4 encodes as
structure. Accent blue stays for links only.

Two callouts change character rather than hue:

* **`:397` the gate-divergence note** — currently `bg-amber-50 text-amber-900`, so a *reconciliation
  of two correct readings* looks like an alarm. It genuinely is uncertainty (the doctrine and the
  trade window disagree), so `caution` is defensible — but it must lose the fill and become a
  `border-l-2 caution` note on `surface`, so it reads as a margin annotation rather than a fifth
  warning chip. This mirrors the `/risk` spec's AP-4 ruling: *"styling it amber currently makes the
  fix look like the problem."*
* **`:482` the held-peers note** — pure neutral. "You already hold 3 names in this sector" with links
  is **navigation**, and the sentence itself already says what the theme cap is for. Amber here is
  the clearest instance of hue-as-emphasis rather than hue-as-meaning. `bg-canvas`, `text-ink`,
  hairline border.

---

## 4. The two ramps — structure, not hue-on-hue (§ 4)

Neither ramp can be carried by hue: three legal hues cannot express four and five ordered states, and
the attempt is what produced `orange`. Both ramps get an **ordinal channel that is not colour**, with
hue marking only the two endpoints — the same move § 4 makes for severity on `/risk` (width + weight
+ dot instead of a 2px border in four near-identical reds).

### 4.1 Spike risk — 4 levels, dot count is the ramp

| Level | Dot (before the badge) | Card left edge | Badge | Badge weight |
| --- | --- | --- | --- | --- |
| **low** | `○` hollow ring, `pass` | none (`border-line`, as now) | `pass` on `pass-bg` | medium |
| **moderate** | `●` one filled, `ink-muted` | 2px `ink-faint` | `ink` on `bg-canvas` | medium |
| **elevated** | `●●` two filled, `ink` | 3px `breach` at 40% | `ink` on `bg-canvas`, uppercase | **semibold** |
| **high** | `●●●` three filled, `breach` | **4px** `breach` | `breach` on `breach-bg` | **semibold** |

Three channels move together — **dot count, edge width, weight** — and hue moves only at the ends.
Dot count is legible at any zoom, in greyscale, and to a deuteranopic reader, none of which is true of
amber-100 against orange-100. The two middle levels going neutral is the point: they are *not*
verdicts, they are positions on a ramp, and § 3.2 has no hue for "somewhat".

The factor rows inside the card keep `SEV_MARK` (`▲ ▲ ·`) but the two `▲`s must stop being identical:
`high` → `breach` + `font-semibold`, `medium` → `ink` + `font-medium` with a hollow `△`, `info` → `·`
`ink-muted`. Same defect as `/risk` D-5, same fix.

### 4.2 Recent trend — 5 levels, a fixed-width gauge is the ramp

The trend ramp is a **signed axis** (favourable → unfavourable), so give it a position, not a colour:

| Verdict | Gauge | Glyph | Hue | Weight |
| --- | --- | --- | --- | --- |
| **down** | `[▪▫▫▫▫]` | `▼▼` | `pass` | semibold |
| **weak** | `[▫▪▫▫▫]` | `▼` | `pass` | medium |
| **flat** | `[▫▫▪▫▫]` | `■` | neutral `ink-muted` | medium |
| **mixed** | `[▫▫?▫▫]` | `◆` | **`caution`** | medium |
| **up** | `[▫▫▫▫▪]` | `▲` | `breach` | **semibold** |

Five positions in a five-cell `tnum` track, left = favourable, right = the threat. Position carries
the level; hue marks only the ends. **`mixed` is the one legitimate `caution` in either ramp**, and
for a real reason: `mixed` means the 1M and 3M windows disagree, so the reading is genuinely
uncertain — which is exactly § 3.2's definition of amber. It sits off-axis (the `?` cell) rather than
between `flat` and `up`, because it is not a position on the axis at all. That is also why amber must
be stripped from `moderate` and `elevated` in § 4.1: if amber means uncertainty in one ramp it cannot
mean "moderately bad" in the ramp directly beside it.

Both gauges are plain text in a `.tnum` span, so they survive the `/md/*.md` mirror extraction, need
no client JS, and cost no layout.

---

## 5. Mechanical find/replace checklist

Ordered so each block is independently verifiable. Match on the **string**, not the line number.
`:NNN` are audit-time positions. Presentation only — no logic, no numbers, no gate ids.

### Block A — the D-1 fix (2 edits, largest single gain)

1. `:47` `text-[12.5px] font-semibold text-ink` → `text-lede font-semibold text-ink`
2. `:48` `text-[11px] text-ink-faint` → `text-small text-ink-muted`

Ship and look at it before doing anything else. Fourteen cards gain a title.

### Block B — kill every arbitrary size (72 → 0)

3. `text-[9.5px]` ×2 (`:778, :800`) → `text-micro`
4. `text-[10px]` → `text-micro` at `:406, :496, :522, :622, :690, :734, :765`; → `text-small` at `:794`
5. `text-[10.5px]` → `text-small` at all ten (`:208, :296, :315, :322, :361, :444, :530, :750, :778, :816`)
6. `text-[11px]` → `text-micro` at `:183`; → `text-small` at `:48, :187, :391, :464, :635`
7. `text-[11.5px]` → `text-small` at `:125, :275, :305, :495, :799`; → `text-body` at `:226, :397, :482`
8. `text-[12px]` → `text-micro` at `:181, :269, :343, :388, :634`; → `text-small` at `:405, :662, :764`; → `text-body` at `:104, :345, :351, :395, :463, :468, :623`; → `text-lede` at `:270`
9. `text-[12.5px]` → `text-lede` at `:47`; → `text-small` at `:56`; → `text-body` at `:97, :99, :153, :214, :462, :743, :747, :762, :790`
10. `text-[13px]` → `text-lede` at `:194`; → `text-body` at `:624, :626, :631`
11. `text-[13.5px]` → `text-lede` at `:95`
12. `text-[16px]` ×4 (`:794–797`) → `text-kpi`
13. `text-[24px]` (`:630`) → `text-kpi`
14. `text-[28px]` (`:621`) → `text-h1`

**Verify:** `grep -c 'text-\[[0-9.]*px\]' 'src/app/stock/[ticker]/page.tsx'` → `0`.

### Block C — grey (52 `ink-faint` text uses → 6 glyph uses)

15. Four `thead`s (`:406, :496, :765, :800`): `text-ink-faint` → `text-ink-muted`
16. Eight `.overline`s (`:122, :286, :306, :618, :794, :795, :796, :797`): `text-ink-faint` → `text-ink-muted`
17. Footnotes and captions (`:208, :315, :322, :361, :444, :530, :626, :690, :734, :750, :816`): `text-ink-faint` → `text-ink-muted`
18. Metric strips (`:187, :464, :635`): `text-ink-faint` → `text-ink-muted`
19. **Reasoning and instructions → `text-ink`**: `:99, :153, :214, :391, :743, :762, :790` (`ink-faint`) and `:104, :133, :277, :308, :312, :351, :395, :468, :778` (`ink-muted`)
20. **Table cells → `text-ink`** per § 3.1: `:415, :421` (trend), `:515, :517` (peers), `:772, :774, :776` (position), `:806, :808, :810` (history); `:514, :516, :809` → `ink-muted`; `:811` open-state → `ink-muted`
21. Leave `ink-faint` only at `:422, :519, :522, :665, :748` and in `TREND_CLS.sideways` — all glyphs

**Verify:** every surviving `text-ink-faint` is on a `·`, a `▾`, a `◆`, or the flags column.

### Block D — hue

22. `:40` `TREND_CLS` → `{ up: <breach>, down: <pass>, sideways: "text-ink-muted" }` — **the inversion fix**
23. `:38` restrict `pnlCls` to money (`:777, :794, :811`); add `dirCls` (rising → breach, falling/flat → pass) for `:419, :471, :518, :631, :730`; convert `:473`'s hand-negated `pnlCls(-sc.relRet3m)` to `dirCls`
24. `:477` `Relative IV` → `text-ink font-semibold` (richness ≠ direction)
25. `:255–258` `SPIKE_TONE` → the § 4.1 table; **delete both `orange` entries**
26. `:260` `SEV_CLS` / `SEV_MARK` → `high` breach+semibold+`▲`, `medium` ink+medium+`△`, `info` ink-muted+`·`
27. `:371–375` `VERDICT_TONE` → the § 4.2 table; `mixed` keeps `caution`, `flat` → neutral
28. `:561` `sideCls` → `bg-line text-ink-muted` for **both** call and put; **delete emerald and indigo**
29. `:682` weekly ladder, `:718` earnings 11–35 d → `text-ink` (**drop amber**; § 3.2 reserves it for uncertainty)
30. `:728` ROIC → `text-ink font-semibold` (**drop the raw `#0f766e`**)
31. `:397` divergence note → `border-l-2` `caution` on `surface`, drop `bg-amber-50`
32. `:482` held-peers note → `bg-canvas text-ink border border-line`, drop amber entirely
33. `src/lib/posanalysis.ts` `ACTION_META`: `take_delivery`, `watch` → `bg-line text-ink-muted` (**drop sky**). *Shared file — check the other consumers first; if it is used elsewhere with a different palette contract, leave it and note the exception.*

### Block E — verify

34. `grep -c 'text-\[[0-9.]*px\]'` → 0; `grep -o 'text-\[9.5px\]\|text-\[10' ` → nothing
35. `grep -c 'orange-\|indigo-\|sky-\|0f766e'` → 0 in this file
36. `curl -s http://127.0.0.1:19210/md/stock/TICKER.md | wc -c` before and after if a markdown mirror exists for this route — a large drop means content was lost, not restyled
37. Spot-check three names with different verdicts (one blocked, one sellable, one with no chain) so every branch of `SPIKE_TONE` / `EARN_TONE` / `VERDICT_TONE` renders at least once

Blocks A–C are pure presentation with no branch changes and can ship together. Block D touches every
chip on the page and matches the `/risk` spec's phase 5 — do it last, when the type pass is stable.

---

## 6. What I could not verify

* **No visual inspection.** Every finding is derived from source, from the shipped token values, and
  from the `/risk` spec. I did not render the page, and per the task constraints I ran no build and
  restarted nothing.
* **`Card` title at 16px may wrap** in the narrowest grid column ("Recent trend · 1–3 months",
  "Upside-spike risk") at the operator's window width. `items-baseline justify-between` with a hint
  beside it makes that plausible. Untested; if it wraps, the hint moves below the title rather than
  the title coming back down.
* **`ACTION_META` and `TARGET_VERDICT_META` are shared** (`src/lib/posanalysis.ts`,
  `src/lib/shortcall.ts`). I did not enumerate their other consumers, so checklist item 33 is
  conditional.
* **Whether the operator's "layout" complaint is the type scale.** The evidence is strong — D-1 is
  reproduced exactly, and on `/risk` the type scale plus the grey pass accounted for most of the same
  complaint — but "bad layout" could also mean the 2+1 / 1+2 grid zigzag or the `Field` column
  measure, and I have deliberately not redesigned the grid on an unverified assumption.

---

## Executive summary

1. The complaint is a typography failure, not an information-architecture one: the page's structure is sound and its type scale is not.
2. **D-1 from the `/risk` spec is reproduced verbatim** — every one of the fourteen card titles is 12.5px, *smaller* than the 14px-equivalent prose it introduces, so nothing on the page reads as a chapter.
3. **72 arbitrary `text-[Npx]` values across 12 distinct sizes**, against zero on the already-migrated `/risk`; 32 are half-pixel (banned by § 2) and 2 sit at 9.5px, below the 11px floor.
4. Those 12 sizes map cleanly onto the six shipped tokens plus `text-kpi`; eight sizes serve two or more purposes and are split by call site in § 1. No token change is proposed or needed.
5. **52 `text-ink-faint` text applications, 23 of them below 12px** — the exact compound § 3.1 rule 1 forbids. Grey is this page's default and ink its exception, the inversion § 3 calls the primary defect.
6. Ruling on the four strings named in the brief: the spike factor `detail`, `e.why`, `r.why` and `sc.read` are **all reasoning text and all move to `text-ink`** — the page currently prints its claims in black and its evidence in grey.
7. **Eight hues carry ~30 meanings.** Emerald alone means pass, low risk, clear, falling, rising, positive P/L and "this is a call" — including two mutually contradictory readings.
8. **The inversion trap is real and live inside a single card**: `TrendCard` renders "UP" in red at the top and "↑ up" in green in the table below it. Green-means-up is wrong for an upside seller; `TREND_CLS` inverts and `pnlCls` splits into money-valence and price-direction.
9. The 4-level spike and 5-level trend ramps drop hue-on-hue for **dot count + edge width + weight** and a **five-cell position gauge**, with hue only at the endpoints — which deletes `orange`, `indigo`, `sky` and a raw teal hex at no information cost.
10. § 5 is a 37-step mechanical checklist in five blocks; **Block A is two lines and delivers the largest readability gain on the page**, and Block D (hue) should ship last, exactly as `/risk` phase 5 did.
