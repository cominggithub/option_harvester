# Strategy sessions

Working memory for the **option-adviser** role, so a conversation can be ended and a new one
started without losing the thread. Kept under `docs/` deliberately: that is the only tree the
adviser may write to, so it can save its own session without any other permission.

## Why this exists

The adviser's always-loaded context is the doctrine (three specs), the rule registry, the
system-gaps list and this folder's `latest.md`. What that does *not* carry is the state of an
argument: which hypothesis is being tested, what was measured last time, what was rejected and
why, and what the next `n` needs to be. Re-deriving that costs a whole context window and
usually loses the reasons, which is how a rejected idea comes back as a new one.

## Files

| File | Role |
| --- | --- |
| `latest.md` | **Always loaded** by the agent. The current session: open threads, last measurements, next actions. One file, overwritten. |
| `YYYY-MM-DD-<slug>.md` | Frozen archive of a session, written when it closes. Never edited afterwards. |
| `_template.md` | The shape a session file takes. |

`latest.md` is a *pointer to now*, not an append-only log: it must stay short enough to be
worth loading every turn. Anything historical belongs in the dated archive, which the agent
reaches with `read`/`grep` or through the `option_harvester-docs` knowledge base.

## Protocol

**Starting a conversation.** The agent reads `latest.md` from its context automatically, and
its `agentSpawn` hook prints the last five commits, so it can see whether code moved since the
session was written. If the two disagree, the commits win and the session is stale — say so
before relying on it.

**Saving before you clear the window.** Ask for it explicitly ("save the strategy session").
The agent then:

1. writes `docs/sessions/<today>-<slug>.md` from `_template.md`, with the numbers it actually
   measured this session (each with its `n` and its date, per the playbook's evidence rules);
2. rewrites `latest.md` to point at it and to carry only what the next conversation needs;
3. states in the reply what it recorded and what it deliberately left out.

**Resuming.** Start the new conversation with "resume the strategy session". The agent
restates the open threads and the last measured numbers, re-runs `npm run reconcile:sc` (or
reads the live pages) before quoting anything, and says which figures moved since the save.

## Rules for what goes in a session file

* **Numbers carry their date and `n`.** A session file is a snapshot, and a stale figure that
  looks live is worse than an absent one. The reader must be able to tell instantly whether a
  number needs re-measuring — assume it does.
* **Record rejections.** An idea tested and killed is the most valuable line in the file,
  because it is the one most likely to be proposed again.
* **Never record a conclusion without its evidence.** "MRNA was the problem" is not a
  finding; "MRNA −$10,086 = 14.9× credit, 98% of the deficit, `npm run reconcile:sc`
  2026-08-21" is.
* **No trade instructions.** Sessions record analysis and hypotheses. What to trade is the
  operator's decision, taken against the live pages, not against a saved file.
* **Point at code and docs rather than restating them.** If the rule is in `sc-rules.ts`, cite
  the id; if the limitation is in `system-gaps.md`, cite the section. Duplicated doctrine
  drifts.
