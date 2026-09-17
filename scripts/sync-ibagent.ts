/**
 * The ib_agent sync channel — `npm run sync:ib`.
 *
 * The Chrome extension's counterpart, and deliberately a SEPARATE program rather than a
 * flag on the same one: the two channels share nothing but the guarded writers in
 * lib/syncwrite.ts, so neither can take the other down. The extension is a browser
 * extension pushing into HTTP routes; this is a cron-able script pulling from a read-only
 * CLI.
 *
 * Default mode is **shadow**: fetch, parse, diff against what we hold, write NOTHING.
 * `--write` persists. That ordering is the migration discipline from
 * docs/ib-agent-integration.md § 6 — one flow at a time, differences resolved in the
 * parser, never by loosening a diff.
 *
 *   npm run sync:ib                    # shadow diff against the prod DB (read-only)
 *   npm run sync:ib -- --write         # ⚠ writes: only on the test DB (see :test)
 *   npm run sync:ib:test -- --write    # the sanctioned write path
 *   npm run sync:ib -- --live          # ask the Gateway instead of the stored snapshot
 *   npm run sync:ib -- --only positions,balances
 *
 * Failure is the normal case, not the exception — this is the whole reason the channel is
 * separated. What that means concretely:
 *
 *  - **Nothing is deleted on a failure.** Every write goes through `checkReplace`; an empty
 *    or truncated payload is refused, and a refusal is recorded as a refusal.
 *  - **Every attempt is recorded** in `option_harvest_sync_state`, including the ones that
 *    wrote nothing, so /sync can say "ib_agent has been failing for 3 days, the book you are
 *    reading came from the extension".
 *  - **A hang is bounded.** Every CLI call has a kill timeout (lib/ibagent.ts). Measured
 *    2026-09-14: a live `sync` sat past 90s on "executions request timed out" while
 *    `status` cheerfully reported ready.
 *  - **Exit code is honest**: 0 when the run did what it could (including "the Gateway is
 *    down and we left everything alone"), 1 on an unexpected error. `--strict` makes any
 *    unusable channel a non-zero exit, for a cron that should page.
 */
import { prisma } from "../src/lib/db";
import * as ib from "../src/lib/ibagent";
import { parseIbAgentBalances, parseIbAgentOrders, parseIbAgentPositions } from "../src/lib/ibparse";
import { recordSyncAttempt } from "../src/lib/datasource";
import { positionValueSplit, writeBalance, writeOrders, writePositions } from "../src/lib/syncwrite";

const SOURCE = "ib-agent" as const;

type Flags = {
  write: boolean;
  live: boolean;
  strict: boolean;
  force: boolean;
  only: Set<string> | null;
  maxAgeMin: number;
};

function parseFlags(argv: string[]): Flags {
  const has = (f: string) => argv.includes(f);
  const val = (f: string) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const only = val("--only");
  const age = Number(val("--max-age-min"));
  return {
    write: has("--write"),
    live: has("--live"),
    strict: has("--strict"),
    force: has("--force"),
    only: only ? new Set(only.split(",").map((s) => s.trim()).filter(Boolean)) : null,
    // How old ib_agent's own snapshot may be before we refuse to write it. Generous by
    // default because `--stored` is the recommended read, but never unbounded: serving a
    // three-day-old book as current is the failure this whole change is about.
    maxAgeMin: Number.isFinite(age) && age > 0 ? age : 12 * 60,
  };
}

const wants = (f: Flags, dataset: string) => !f.only || f.only.has(dataset);

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US"));

function line(label: string, msg: string) {
  console.log(`${label.padEnd(13)} ${msg}`);
}

/** One dataset's outcome, for the summary line and the SyncRun row. */
type Outcome = { rows: number | null; wrote: boolean; note: string };

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const db = process.env.DATABASE_URL ?? "(unset)";
  // The DB name is the last path segment BEFORE the query string. Naively taking the last
  // "/" picks up `host=/var/run/postgresql` out of the query and reports the database as
  // "postgresql&schema=public" — which also breaks the prod-write warning below, the one
  // line that is supposed to notice a write aimed at the wrong database.
  const dbName = db.split("?")[0].split("/").pop() || "(unknown)";

  console.log(`ib_agent → option_harvester   ${flags.write ? "WRITE" : "shadow (read-only)"}   db=${dbName}`);
  if (flags.write && dbName === "option_harvester")
    console.log("⚠ writing to the PROD database — CLAUDE.md § Database says data writes go to the test server only");

  // 1. Is the channel usable at all? One bounded call, and its answer is recorded whatever
  //    it is: "the Gateway is down" is a data point the /sync page needs, not an exception.
  const probe = await ib.probe();
  line("status", probe.ok ? `ready=${probe.ready} readonly=${probe.readonly} flex=${probe.flexConfigured}` : `✕ ${probe.kind}: ${probe.error}`);
  if (!probe.ok || !probe.ready) {
    const err = probe.error ?? "gateway not ready";
    await recordSyncAttempt({
      dataset: "channel",
      source: SOURCE,
      ok: false,
      error: err,
      detail: { kind: probe.kind, phase: "probe" },
    });
    await logRun({ error: `channel unusable: ${err}`, outcomes: {}, flags });
    console.log("\nNothing was fetched and nothing was changed — the extension's data stands as-is.");
    process.exit(flags.strict ? 3 : 0);
  }
  await recordSyncAttempt({ dataset: "channel", source: SOURCE, ok: true, detail: { ready: true, readonly: probe.readonly } });

  const outcomes: Record<string, Outcome> = {};
  let fatal: string | null = null;

  // 2. Positions + balances come from ONE bundle, so they describe the same instant.
  //    `show` reads the stored snapshot; `--live` asks the Gateway (and costs ~3s + the risk
  //    of the hang above, hence the shorter default timeout inside the client).
  if (wants(flags, "positions") || wants(flags, "balances")) {
    try {
      const bundle = flags.live ? await ib.cli<ib.IbShowPayload>(["sync"], 90_000) : await ib.show();
      const asOf = ib.payloadAsOf(bundle);
      const ageMin = ib.payloadAgeMin(bundle);
      line("snapshot", `source=${bundle.source ?? "?"} as_of=${bundle.as_of ?? "?"}${ageMin != null ? ` (${Math.round(ageMin)}m old)` : ""}`);

      if (ageMin != null && ageMin > flags.maxAgeMin) {
        const msg = `snapshot ${Math.round(ageMin)}m old, limit ${flags.maxAgeMin}m — refusing to write it`;
        line("", `⚠ ${msg}`);
        for (const ds of ["positions", "balances"]) {
          if (wants(flags, ds)) {
            await recordSyncAttempt({ dataset: ds, source: SOURCE, ok: false, error: msg, asOf });
            outcomes[ds] = { rows: null, wrote: false, note: "stale snapshot" };
          }
        }
      } else {
        if (wants(flags, "positions")) outcomes.positions = await syncPositions(bundle, asOf, flags);
        if (wants(flags, "balances")) outcomes.balances = await syncBalances(bundle, asOf, flags);
      }
    } catch (err) {
      const e = err as ib.IbAgentError;
      const kind = e instanceof ib.IbAgentError ? e.kind : "failed";
      line("snapshot", `✕ ${kind}: ${e.message ?? String(err)}`);
      for (const ds of ["positions", "balances"]) {
        if (wants(flags, ds)) {
          await recordSyncAttempt({ dataset: ds, source: SOURCE, ok: false, error: `${kind}: ${e.message ?? String(err)}` , detail: { kind } });
          outcomes[ds] = { rows: null, wrote: false, note: kind };
        }
      }
      // exit 4 (no data) and 3 (unreachable) are channel states, not bugs: recorded, and
      // the run continues to whatever else was asked for.
      if (e instanceof ib.IbAgentError && !e.retryable && !e.needsHuman) fatal = e.message;
    }
  }

  // 3. Orders — a separate IB round trip, so a separate failure. Never migrate two flows in
  //    one step (§ 6), and note that an empty list here can mean "another client id placed
  //    them" rather than "nothing is working".
  if (wants(flags, "orders")) {
    try {
      const payload = await ib.orders();
      const rows = parseIbAgentOrders(payload);
      const held = await prisma.order.count();
      line("orders", `${fmt(rows.length)} active from ib_agent · ${fmt(held)} held${payload.master_client_id_hint ? " · note: only this client id's orders are visible unless OverrideTwsMasterClientID is set" : ""}`);
      if (flags.write) {
        const res = await writeOrders(rows, { source: SOURCE, asOf: ib.payloadAsOf(payload), force: flags.force });
        line("", res.ok ? `✓ wrote ${fmt(res.count)}` : `⛔ refused: ${res.refused?.reason}`);
        outcomes.orders = { rows: res.count, wrote: res.ok, note: res.ok ? "written" : (res.refused?.code ?? "refused") };
      } else {
        outcomes.orders = { rows: rows.length, wrote: false, note: "shadow" };
      }
    } catch (err) {
      const e = err as ib.IbAgentError;
      const kind = e instanceof ib.IbAgentError ? e.kind : "failed";
      line("orders", `✕ ${kind}: ${e.message ?? String(err)}`);
      await recordSyncAttempt({ dataset: "orders", source: SOURCE, ok: false, error: `${kind}: ${e.message ?? String(err)}`, detail: { kind } });
      outcomes.orders = { rows: null, wrote: false, note: kind };
    }
  }

  await logRun({ error: fatal, outcomes, flags });

  // 4. The summary is the point of the run: what each dataset would do / did, and which
  //    channel the data now belongs to.
  console.log("");
  for (const [ds, o] of Object.entries(outcomes)) line(ds, `${fmt(o.rows)} rows · ${o.note}`);
  if (!flags.write) console.log("\nShadow run — nothing was written. Add --write (on the test DB) to persist.");

  const unusable = Object.values(outcomes).some((o) => !o.wrote && o.note !== "shadow" && o.note !== "written");
  process.exit(fatal ? 1 : flags.strict && unusable ? 3 : 0);
}

/** Positions: diff first, always — the diff is what makes a cutover reviewable. */
async function syncPositions(bundle: ib.IbShowPayload, asOf: Date | null, flags: Flags): Promise<Outcome> {
  const rows = parseIbAgentPositions(bundle);
  const held = await prisma.position.findMany({ select: { symbol: true, right: true, strike: true, expiry: true, quantity: true, source: true } });
  const key = (p: { symbol: string; right: string | null; strike: unknown; expiry: string | null }) =>
    `${p.symbol}|${p.right ?? ""}|${p.strike == null ? "" : Number(p.strike)}|${p.expiry ?? ""}`;
  const ours = new Map(held.map((p) => [key(p), Number(p.quantity ?? 0)]));
  const theirs = new Map(rows.map((p) => [key(p), Number(p.quantity ?? 0)]));
  const onlyIb = [...theirs.keys()].filter((k) => !ours.has(k));
  const onlyDb = [...ours.keys()].filter((k) => !theirs.has(k));
  const qtyDiff = [...theirs.entries()].filter(([k, q]) => ours.has(k) && ours.get(k) !== q);
  const heldSources = [...new Set(held.map((h) => h.source ?? "unknown"))].join(",") || "none";

  line("positions", `${fmt(rows.length)} from ib_agent · ${fmt(held.length)} held (source: ${heldSources})`);
  if (onlyIb.length || onlyDb.length || qtyDiff.length) {
    line("", `diff: +${onlyIb.length} only-in-ib_agent · -${onlyDb.length} only-in-db · ${qtyDiff.length} qty differ`);
    for (const k of onlyIb.slice(0, 8)) line("", `  + ${k}`);
    for (const k of onlyDb.slice(0, 8)) line("", `  - ${k}`);
    for (const [k, q] of qtyDiff.slice(0, 8)) line("", `  ~ ${k}: db ${ours.get(k)} → ib ${q}`);
  } else if (rows.length) {
    line("", "diff: identical to what we hold");
  }

  if (!flags.write) {
    // A shadow run still records that the channel ANSWERED. Otherwise a week of healthy
    // shadow runs leaves the page saying ib_agent never worked.
    await recordSyncAttempt({
      dataset: "positions",
      source: SOURCE,
      ok: rows.length > 0,
      rows: rows.length,
      asOf,
      error: rows.length ? null : "ib_agent returned no positions",
      detail: { shadow: true, onlyIb: onlyIb.length, onlyDb: onlyDb.length, qtyDiff: qtyDiff.length },
    });
    return { rows: rows.length, wrote: false, note: "shadow" };
  }

  const res = await writePositions(rows, {
    source: SOURCE,
    asOf,
    force: flags.force,
    archive: { filename: "ib-agent", content: JSON.stringify({ as_of: bundle.as_of, source: bundle.source, positions: bundle.positions }) },
    detail: { onlyIb: onlyIb.length, onlyDb: onlyDb.length, qtyDiff: qtyDiff.length },
  });
  line("", res.ok ? `✓ wrote ${fmt(res.count)} (upload ${res.uploadId})` : `⛔ refused: ${res.refused?.reason}`);
  return { rows: res.count, wrote: res.ok, note: res.ok ? "written" : (res.refused?.code ?? "refused") };
}

async function syncBalances(bundle: ib.IbShowPayload, asOf: Date | null, flags: Flags): Promise<Outcome> {
  const b = parseIbAgentBalances(bundle);
  if (!b) {
    line("balances", "✕ no `balances` roll-up in the payload");
    await recordSyncAttempt({ dataset: "balances", source: SOURCE, ok: false, error: "no balances roll-up in payload", asOf });
    return { rows: null, wrote: false, note: "no-data" };
  }
  line("balances", `acct=${b.acct} NLV=${fmt(b.netLiquidation)} cash=${fmt(b.totalCash)} maint=${fmt(b.maintMargin)} ${b.currency ?? ""}`);
  if (!flags.write) {
    await recordSyncAttempt({
      dataset: "balances",
      source: SOURCE,
      ok: b.netLiquidation != null,
      rows: 1,
      asOf,
      error: b.netLiquidation == null ? "no NetLiquidation in payload" : null,
      detail: { shadow: true, netLiquidation: b.netLiquidation },
    });
    return { rows: 1, wrote: false, note: "shadow" };
  }
  const split = await positionValueSplit();
  const res = await writeBalance(b, { source: SOURCE, asOf, acct: b.acct, raw: bundle.account_values ?? null, split });
  line("", res.ok ? `✓ wrote ${res.date}` : `⛔ refused: ${res.refused?.reason}`);
  return { rows: 1, wrote: res.ok, note: res.ok ? "written" : (res.refused?.code ?? "refused") };
}

/**
 * One SyncRun row per script run, on the `ib-agent` channel — so /sync's run history shows
 * both channels side by side and an ib_agent run that achieved nothing is still a row with
 * a reason in it. Best-effort: the log must not fail the run it describes.
 */
async function logRun(args: { error: string | null; outcomes: Record<string, Outcome>; flags: Flags }) {
  const { error, outcomes, flags } = args;
  const written = (ds: string) => (outcomes[ds]?.wrote ? outcomes[ds].rows : null);
  try {
    await prisma.syncRun.create({
      data: {
        channel: "ib-agent",
        source: flags.write ? (flags.live ? "live" : "stored") : "shadow",
        positions: written("positions"),
        orders: written("orders"),
        error,
        raw: { outcomes, flags: { ...flags, only: flags.only ? [...flags.only] : null } } as object,
      },
    });
  } catch {
    /* bookkeeping only */
  }
}

main()
  .catch((e) => {
    console.error(`sync-ibagent failed: ${e}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
