# Agent guide

This repo's operational map, knowledge index, and file map live in **[CLAUDE.md](CLAUDE.md)** —
read it first. It routes you to the domain spec (`docs/spec.md`), test plan
(`docs/test-plan.md`), strategy (`docs/strategy.md`), and the CC model
(`docs/cc-target-strategy.md`).

Non-negotiables before you touch anything: only the `option_harvest_*` tables in the
`option_harvester*` databases are ours; and **data writes go to the test server only**.

**IBKR data comes from ib_agent, not from IB directly.** Never write code that calls
the IBKR Client Portal or TWS API from this repo — route it through the read-only
`ib-agent` CLI (`man ib-agent`, skill installed at `~/.kiro/skills/ib-agent/`). Which
flows have moved, which three stay on the Chrome extension, and how to call the CLI
safely: **[docs/ib-agent-integration.md](docs/ib-agent-integration.md)**.

**You own the deploy.** After any code change, deploy it yourself as one atomic step —
`npm run build && sudo systemctl restart option_harvester` — then verify. Never leave a
build without the restart: prod and the test server share one `.next` dir, so a build
swaps the on-disk chunks under the running prod process, and until the restart prod
serves HTML pointing at chunk hashes that no longer exist ("Application error: a
client-side exception"). So the rule is not "don't build" — it's **build → restart →
verify → done**, and never hand that off to the user. Full rules in CLAUDE.md.
