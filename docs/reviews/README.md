# Adviser reviews

Frozen, dated analysis snapshots produced by the `option-adviser` role. Architecture,
report contracts and the route handoff: **[../adviser-reviews-architecture.md](../adviser-reviews-architecture.md)**.

## What lives here

One directory per run, `docs/reviews/<YYYY-MM-DD>-<HHmm>/` (Asia/Taipei):

| File | Role |
| --- | --- |
| `meta.json` | provenance: run time, HEAD, rules versions, input freshness, preconditions |
| `data.json` | every metric the reports cite, keyed — this is what makes two runs comparable |
| `strategy.md` | **Strategy improvement** — the record, and what the rules should be |
| `risk.md` | **Risk analysis** — the live book, the gates, what to do next |
| `targets.md` | **Potential target** — short-call candidates as a gate stack |
| `sources/` | the raw read-only captures the numbers were read from, verbatim |

## The three rules

1. **Write-once.** A published run is never edited. A correction is a **new** run whose
   `meta.json` names the run it corrects. If a review can be edited, comparing two of them
   stops meaning anything.
2. **Self-contained.** Every number cited appears in `data.json` and inline in the report. A
   review must render identically in a year with the database offline. Nothing is re-derived at
   render time — that is `/risk`'s job, and it keeps nothing.
3. **Provenance on every number.** `source` and `asOf` are mandatory, `n` wherever the metric is
   a cohort statistic. A keyed difference between two runs is then attributable to *the book
   moved*, *the rules moved*, or *the measurement got better* — three different findings that
   look identical without it.

## When a run happens

On request, and expected after either event that makes the previous run stale: **a portfolio
sync**, or **a doctrine change**. The protocol (capture → meta → data → three reports → diff
against the previous run → report what was left out) is §6 of the architecture document.

## Relationship to `docs/sessions/`

Sessions are the adviser's **working memory** — open threads, what was rejected, one live file.
Reviews are **published artifacts** — immutable, dated, comparable. A session says what is being
argued about; a review says what was true on a date and what was concluded from it. A review
cites session threads; a session points at the latest review rather than restating its numbers.
