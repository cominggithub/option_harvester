# `/risk` — layout, type and colour redesign

**Status: phases 0 and 1 implemented and deployed 2026-08-28. Phases 2–6 not started** — § 7
says to ask the operator whether the complaint is resolved before doing them, so they are
waiting on that answer. Written by the `option-adviser` role after an operator report that the
page is hard to read. This file is a spec for the **default agent**: the page lives in
`src/app/risk/page.tsx` (906 lines) plus `src/components/PageToc.tsx`,
`src/app/globals.css` and `tailwind.config.ts`, none of which this role may edit.

Implementation notes on what shipped, where it departed from this spec, and what the
diagnosis got right — all verified against the running page:

* **D-1, D-2, D-3 and the § 3 grey inversion are fixed.** `ink-faint` is `#6b7280`
  (4.83:1 on white, 4.55:1 on canvas); the six-step scale is in `globals.css` as
  `--fs-micro … --fs-h1` plus `--fs-kpi`/`--fs-kpi-lg`, exposed as Tailwind `text-micro …
  text-h1`; all twelve arbitrary `text-[Npx]` values are gone from `page.tsx`, and
  `text-ink-faint` in that file is now **zero** (only the `bg-ink-faint` credit bar remains).
* **Every measurement in § 1 and § 3 checked out**: 3.14:1, 463 occurrences across 35 files,
  twelve distinct sizes, and exactly 60 grey against 40 ink text applications.
* **Departure 1 — `zoom: 1.125` stays.** § 2 offered a `rem`-based scale as a recommendation
  and § 8 flagged it as the one change that could regress another page. The px integers are
  kept as the source of truth and the fractional rasterisation is accepted; the defect that
  mattered (0.5px steps that are invisible as hierarchy) is gone either way.
* **Departure 2 — `H2` dropped `uppercase`/`tracking-wider`.** At 19px, uppercase with wide
  tracking shouts and wraps; sentence-case 19px ink reads as a chapter, which is what D-1 asked
  for. Overlines keep uppercase.
* **Extension — table `tbody` moved to `text-ink`** per § 3.1's table (cells are primary), and
  column headers to `ink-muted` per § 3.1 rule 1.
* Mirror check: `/md/risk.md` is byte-identical before and after both phases (54,034), and
  `scripts/page-markdown-check.ts` passes.

Scope discipline: **no number, threshold, rule id or finding changes.** This is presentation only.
`docs/spec.md` § 8's design language holds — dense editorial/financial terminal, white, hairlines,
tabular figures, no gradients, no oversized cards, no emoji. The page is not too dense. It is
**undifferentiated**, and three specific mechanical defects make it unreadable.

---

## 1. Diagnosis — measured, not aesthetic

### D-1 · Section headings are smaller and fainter than the body text they introduce

`page.tsx:60` renders every section heading as:

```
text-[13px] font-semibold uppercase tracking-wider text-ink-faint
```

Body prose beneath it is `text-[12.5px] text-ink-muted` (`:342, :406, :533, :561`). So a heading is
**0.5px larger and substantially lighter** than its own content. With `<h1>` at 26px, the page has
**two** levels of hierarchy for **eighteen** sections plus the brief's three sub-parts. That is the
single largest cause of "wall of text": there is no visual signal for *chapter*, so the reader
scrolls through 54KB of content with no way to skim.

### D-2 · Twelve font sizes, six of them half-pixel, all multiplied by a fractional zoom

Distinct sizes in `page.tsx`: **10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 16, 20, 26px**.

`globals.css:20` sets `body { zoom: 1.125 }`. Every size is therefore multiplied by 1.125 before
rasterisation: 10.5 → 11.81px, 11.5 → 12.94px, 12.5 → 14.06px, 13.5 → 15.19px. **None of the
half-pixel values lands on a whole device pixel**, so glyph hinting and baseline snapping differ
row to row. Steps of 0.5px are imperceptible as hierarchy while being perfectly capable of making
text look slightly soft. The scale is doing harm in both directions at once.

### D-3 · The colour used for every label fails WCAG AA

`ink-faint` = `#8b929b` (`tailwind.config.ts:18`). Contrast on `#ffffff` is **3.14:1**, against the
4.5:1 AA minimum for normal-size text. It is currently used for:

* every section heading (`:60`)
* every `.overline` KPI caption (`:50, :195, :385`)
* every KPI's `sub` explainer line (`:52`, at 10.5px)
* every table column header (`:74, :161, :423`)
* the timestamp, the theme sub-label under each ticker (`:117`), the provenance notes

So **the text that tells you what a number means is the least legible text on the page**, at
10–13px. `ink-muted` (`#5c636b`, **6.08:1**) passes comfortably and is already in the palette.

### D-4 · Hue is doing double and triple duty, so the palette cannot be learned

| Colour | Currently means |
| --- | --- |
| rose | critical severity · high severity · "rising" leg chip · the stop-opening banner |
| amber | medium severity · earnings chip · tight-cushion number · "what this could not see" · ITM-delivery chip · the AP-4 plan panel |
| emerald | "clears every gate" |
| `bg-line` | info/context severity |

Amber signals four unrelated things: a **medium-severity finding**, a **known risk** (earnings,
tight cushion), a **data gap** (the caveat list), and a **recommended action** (the AP-4 panel).
A reader cannot build a rule for it, so colour stops carrying information and becomes noise.

### D-5 · Severity, the primary signal, is nearly invisible

`SEV_STYLE` (`:212`) distinguishes findings by a **2px** left border in `rose-600 / rose-400 /
amber-400 / line`. At 2px, `rose-600` (#e11d48) and `rose-400` (#fb7185) are almost
indistinguishable, and all nine findings render at identical width, padding, title size and
spacing. The nine findings in the current run include one `critical` liquidity item and one `info`
context item and they look the same.

### D-6 · Prose line length is ~1.6× the readable maximum

Prose containers are `max-w-4xl` = 56rem = 896px. At 12.5px × 1.125 zoom ≈ 14.06px, average
character width ≈ 7px, giving **~128 characters per line** against the 45–75 optimum. The brief's
`mechanism` and `action` paragraphs — the parts written to be *read* rather than scanned — are the
worst affected.

### D-7 · Wide tables have no row tracking

Row separators are `border-line/50` — 50% opacity of `#e7e9ec` on white, effectively invisible.
Rows are `py-1.5` (6px) at 12px text. There is no zebra, no sticky header, and no sticky first
column, while tables are `min-w-[980px]` and `min-w-[1120px]` and the earnings table carries **13
columns**. Tracking a leg from its ticker to its "Why" across 1120px with no visible rule is the
mechanical definition of hard to read.

### D-8 · There is no answer above the fold

The page opens with a title, a 3-line doctrine paragraph, a provenance line, an 18-item nav strip,
then a one-sentence verdict, then nine full findings. The operator's actual first question — *may I
open, and what do I do first* — is answerable in one line and currently requires scrolling past
roughly 4,000 words.

---

## 2. The type scale — six steps, integers only

Define in `globals.css` and use **nothing else** on this page. Half-pixel values are banned.

| Token | px | Use |
| --- | --- | --- |
| `--fs-micro` | **11** | table column headers, chips, rule-id pills, overlines |
| `--fs-small` | **12** | table cells, evidence bullets, footnotes |
| `--fs-body` | **14** | all prose: mechanism, action, section intros |
| `--fs-lede` | **16** | finding titles, the brief's headline sentence |
| `--fs-h2` | **19** | section headings |
| `--fs-h1` | **28** | page title |

Numerics keep `.tnum`. KPI values: **22px** semibold; the six "Book at a glance" tiles may go
**26px** since they are the page's only true summary numbers.

Two consequences worth stating: `--fs-h2` at 19px is **larger than body**, which is what fixes D-1;
and every value is an integer, so `zoom: 1.125` yields 12.375 / 13.5 / 15.75 / 18 / 21.375 / 31.5 —
still fractional. **Recommendation: express the scale in `rem` against a 16px root and delete
`zoom: 1.125` from this page's subtree**, or accept the fractional result but keep the source
integers so the scale is at least legible in code. Do not remove `zoom` globally: `globals.css:20`
records that the analyzer's wide table depends on it, so that is a separate, tested change.

---

## 3. Grey — the primary defect

**Measured on `/risk`: 60 of 100 text-colour applications are grey** — 30 `text-ink-faint`, 30
`text-ink-muted`, against 40 near-black `text-ink`. Grey is the page's *default* and black is the
exception, which inverts the correct relationship. Worse, **20 of those greys are applied to text at
10–11px**, which is the combination that destroys legibility: low contrast and small size compound,
they do not average.

Repo-wide there are **463 occurrences of `text-ink-faint` across 35 files**, so editing call sites is
the wrong instrument.

### 3.1 · Two changes, in this order

**(a) Darken the token globally — one line, fixes every page.**

```ts
// tailwind.config.ts
ink: {
  DEFAULT: "#1a1d21",   // 15.9:1  — unchanged
  muted:   "#5c636b",   //  6.08:1 — unchanged
  faint:   "#6b7280",   //  4.84:1 — was #8b929b at 3.14:1 (AA FAIL)
}
```

`#6b7280` clears AA (4.5:1) for normal text, keeps a visible step below `ink-muted`, and stays
unmistakably grey rather than black — the muted, non-decorative language of `docs/spec.md` § 8 is
preserved. This single edit repairs all 463 occurrences with **zero call-site changes**.

Blast radius is small and favourable: the only non-text uses are **29 chart labels**
(`fill-ink-faint` in `charts.tsx` ×14, `PnlCharts.tsx` ×9, `CumulativePnlChart.tsx` ×5) plus one
credit bar (`risk/page.tsx:90`). Axis labels and tick text get *more* readable; the bar gets
slightly darker, which is neutral-to-better.

**(b) On `/risk`, promote body copy from grey to ink.**

Roughly 30 `text-ink-muted` applications are running prose — the `mechanism` paragraph (`:240`),
section intros (`:342, :406, :533, :561, :575`), the `Why` column (`:144`), the evidence bullets
(`:235`), the acquisition and candidates explainers. **Body text should be `text-ink`.** The `action`
line (`:244`) is already `text-ink` and is noticeably the most readable prose on the page — that is
the proof of the fix, and it should be the rule rather than the exception.

After (a) and (b) the system is:

| Level | Token | Contrast | Used for |
| --- | --- | --- | --- |
| primary | `ink` `#1a1d21` | 15.9:1 | **all prose**, all values, finding titles, table cells |
| secondary | `ink-muted` `#5c636b` | 6.08:1 | labels, captions, column headers, timestamps, KPI sub-lines |
| tertiary | `ink-faint` `#6b7280` | 4.84:1 | chart furniture, the one bar, genuinely incidental annotation |

**Two hard rules that keep it from drifting back:**

1. **No grey below 12px.** The twenty 10–11px grey strings must either rise to 12px (`--fs-small`) or
   go to `ink`. Column headers at 11px move to `ink-muted` *and* `--fs-micro` is raised to 11px as a
   floor — never 10 or 10.5.
2. **Grey is for what a number *is*, never for what it *says*.** A label may be grey; the value, the
   reason and the instruction may not.

### 3.2 · Hue — one meaning each

Add semantic tokens to `tailwind.config.ts` and forbid raw palette use in `page.tsx`:

| Token | Value | Means, and *only* means |
| --- | --- | --- |
| `breach` | rose-700 `#be123c` | a rule is broken, or a leg is at risk **now** |
| `breach-bg` | rose-50 | ditto, as a fill |
| `caution` | amber-700 `#b45309` (5.02:1) | **uncertainty**: stale input, missing data, unknown gate, "could not see" |
| `caution-bg` | amber-50 | ditto |
| `pass` | emerald-800 `#065f46` | compliant, clears a gate, inside a limit |
| `ink-muted` | `#5c636b` (6.08:1) | **all** labels, headers, captions, sub-lines |
| `ink-faint` | `#8b929b` | **non-text only** — hairlines, disabled bars, decorative dots |

Reassignments this forces, all of which are corrections rather than restyling:

* **earnings chip → `breach`.** An earnings print inside the option's life is an `SC-S6` breach, not
  an uncertainty.
* **tight-cushion numbers (`:137`) → `breach`.** Inside 1σ is an `SC-B3` / `SC-E3` breach.
* **"no earnings date on file" → `caution`.** This is the data gap, and the distinction from the
  chip above is exactly the one `docs/spec.md` § 4 insists on: a missing date must never read as
  safety.
* **AP-4 plan panel (`:502`) → neutral ink on `surface` with a `pass`-toned action line.** It is a
  *remedy*, not a warning; styling it amber currently makes the fix look like the problem.
* **"what this could not see" (`:388`) stays `caution`** — it is the canonical use.
* **Severity ramp** becomes width + weight, not hue-on-hue: see § 4.

---

## 4. Severity — encode it in structure, not in a 2px border

| Severity | Left edge | Title | Body | Default state |
| --- | --- | --- | --- | --- |
| critical | **4px** `breach` | 16px semibold ink | full | expanded |
| high | 4px `breach` at 60% | 16px semibold ink | full | expanded |
| medium | 3px `caution` | 16px medium ink | full | **collapsed to title + evidence** |
| info / context | 3px `ink-faint` | 14px medium `ink-muted` | full | **collapsed to title** |

Add a severity **dot** before the chip so the signal survives at any zoom, and keep the uppercase
chip. `info` findings should be visually recessive — `F-VERSION` ("every closed chain predates the
written rules") is important context and it is not an alarm; today it looks like one.

Collapsing is `<details>`/`<summary>`, not JS state — the page is a server component and must stay
one.

---

## 5. Layout

### 5.1 Measure

* Prose: `max-w-[68ch]` (≈ 600px at 14px) for every `mechanism`, `action` and section intro.
* Evidence bullets: `max-w-[80ch]` — they are scanned, not read, and carry numbers.
* Tables: unchanged, full width. **Prose and tables must stop sharing a width.**

### 5.2 Section rhythm

Every section gets, in order: `mt-12`, a full-bleed `border-t border-line`, `pt-4`, then the 19px
heading. Sub-sections inside the brief (`The brief` / `Acquisition book` / `Why it fails` / `What to
sell next`) get `mt-8` and a 16px heading with no rule. Three levels, visibly distinct, is enough
for eighteen sections; two is not.

Make the section heading **sticky** at the scroll top with a `bg-canvas/95 backdrop-blur-sm` band so
the reader always knows which of the eighteen sections they are in. `PageToc.tsx` already provides
the jump targets and the breach colouring; it should also mark the **active** section.

### 5.3 The verdict band — the fix for D-8

Directly under the title, above the doctrine paragraph, a single full-width band:

```
OPENING BLOCKED · 5 of 5 book gates breached          [SC-B1 42%] [SC-B2 66%] [SC-B3 36%] [SC-B4] [SC-B5 22%]
Do first: harvest the 4 legs inside 1σ that are past 70% captured — $3,226 of credit, frees margin.
```

Line 1 is the state, at `--fs-lede`, with one chip per gate showing **value vs limit** (margin, not
a dot — the playbook's rule). Line 2 is the single highest-priority action from `What to do now`.
Both already exist in `getBookRisk`/`buildRiskBrief`; nothing new is computed. When no gate fails
the band renders `pass`-toned and says so, so its absence is never ambiguous.

The doctrine paragraph (`:342`) then moves **below** the band and drops to `--fs-small`
`ink-muted` — it is orientation for a first-time reader, not the headline.

### 5.4 Tables

* Row separators: `border-line` at **full opacity**. Drop the `/50`.
* Row padding: `py-2`.
* `thead`: `sticky top-0 bg-surface` with a 2px bottom rule, headers at `--fs-micro` `ink-muted`
  (not faint).
* **Sticky first column** (`position: sticky; left: 0; background: surface`) on every table wider
  than 900px. This is the highest-value single fix in § 5 — it is what makes a 13-column row
  traceable.
* Numerics right-aligned with `.tnum` (already correct throughout).
* Group rules: keep the existing `bg-canvas/60` total rows; they work.
* **Split the earnings table.** Thirteen columns is too many. `Name · Leg · Earnings · Print → exp ·
  DTE · |Δ| · σ to K · Credit` is the decision; `OTM · IV · Open P/L · Kept · Why` is the detail and
  belongs in an expandable second line, matching the pattern `WideStockList` already uses.

---

## 6. What must not change

* Every number, threshold, rule id, verdict and severity ordering.
* `force-dynamic` and the server-component structure. No client JS for collapse or nav.
* The three-books separation, and that a declared acquisition leg can only read *take delivery* /
  *reduce contracts* / *hold*.
* Margin-over-binary: no chip may lose the `value vs limit` text it currently carries.
* The `/md/risk.md` mirror must keep working — it extracts `#page-content`, so any new wrapper has
  to stay inside it, and `<summary>` text must remain in the DOM for collapsed findings or the
  mirror loses content. **Verify with `curl -s http://127.0.0.1:19210/md/risk.md | wc -c` before and
  after; a large drop means the mirror lost sections.**

---

## 7. Order of work

Each step is independently shippable and each ends with the atomic deploy
(`npm run build && sudo systemctl restart option_harvester`, then verify both ports).

| Phase | Change | Why first |
| --- | --- | --- |
| **0** | **`ink-faint` `#8b929b` → `#6b7280`** in `tailwind.config.ts` (§ 3.1a) | **One line. Repairs 463 occurrences across 35 pages and clears the AA failure.** Ship this on its own and look at the result before anything else. |
| **1** | Type scale (§ 2) + body prose grey → `ink` on `/risk` (§ 3.1b) + the no-grey-below-12px rule | Fixes D-1, D-2 and the remainder of D-3. Largest readability gain per line changed. |
| **2** | Section rhythm + sticky headings + prose measure (§ 5.1–5.2) | Fixes the "wall" complaint. No logic touched. |
| **3** | Verdict band (§ 5.3) | Fixes D-8. Reads existing data only. |
| **4** | Table pass: hairlines, padding, sticky head + first column (§ 5.4) | Fixes D-7 across all fifteen tables at once. |
| **5** | Semantic colour tokens + severity structure (§ 3.2–4) | Most invasive because it touches every chip; do it last, when the layout is stable. |
| **6** | Split the earnings table (§ 5.4) | Optional; largest markup change for the smallest reach. |

After phase 0 and 1, ask the operator whether the complaint is resolved before doing 2–6. The
diagnosis says the grey and the type scale account for most of it, and phases 5–6 are a lot of churn
to spend on an unverified assumption.

**Phase 0 changes every page in the app, not just `/risk`.** That is the point — the same token is
doing the same damage on `/positions`, `/pnl-predict`, `/short-call/*` and the analyzer — but it means
the verification step is "spot-check three other pages", not just this one.

---

## 8. What I could not verify

* **No visual inspection.** I read `page.tsx`, `globals.css` and `tailwind.config.ts`; I did not
  render the page or view it at the operator's window size or zoom level. Everything above is
  derived from source and from computed contrast ratios, so a defect that only appears at a
  specific viewport (for example the 18-item nav strip wrapping) is not in this list.
* **Contrast ratios** are computed for text on `#ffffff` (`surface`). Cells over `bg-canvas`
  (`#f7f8fa`) are marginally worse and I did not enumerate them; `ink-faint` fails on both.
* **`zoom: 1.125`'s blast radius.** `globals.css:20` says the analyzer table depends on it. Whether
  a `rem`-based scale on `/risk` alone interacts badly with it is untested, and it is the one part
  of this proposal that could regress another page.
* **Which sections the operator actually finds unreadable.** "The layout is bad, hard to read" is a
  whole-page report; the phasing above is my ordering by measured severity, not theirs.
