# Agent guide

This repo's operational map, knowledge index, and file map live in **[CLAUDE.md](CLAUDE.md)** —
read it first. It routes you to the domain spec (`docs/spec.md`), test plan
(`docs/test-plan.md`), strategy (`docs/strategy.md`), and the CC model
(`docs/cc-target-strategy.md`).

Non-negotiables before you touch anything: only the `option_harvest_*` tables in the
`option_harvester*` databases are ours; **data writes go to the test server only**; and
`npm run build` breaks live prod until `sudo systemctl restart option_harvester`. Full
rules in CLAUDE.md.
