// Record one `/risk` analysis — the position half every run, the strategy half only when
// the closed record or the rule version moved (src/lib/risksnap.ts § THE SPLIT).
//
// Idempotent by fingerprint: an analysis is identified by its INPUTS, so running this twice
// against the same sync writes nothing and says so. That is what makes it safe to call from
// the daily timer AND by hand after a Sync.
//
//   npm run snapshot:risk                  # record against the prod DB (what daily.sh does)
//   npm run snapshot:risk -- --dry-run     # build it, print it, write nothing
//   npm run snapshot:risk -- --note "post-harvest"
//   npm run snapshot:risk:test             # the test DB
import { takeRiskSnapshot } from "../src/lib/riskhistory";
import { fmtMetric, METRIC_BY_KEY } from "../src/lib/risksnap";
import { prisma } from "../src/lib/db";

const arg = (flag: string): string | null => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const trigger = arg("--trigger") ?? (process.argv.includes("--daily") ? "daily" : "manual");
  const res = await takeRiskSnapshot({ trigger, note: arg("--note"), dryRun });

  const m = res.position.metrics;
  const show = (key: string) => {
    const def = METRIC_BY_KEY[key];
    return `${def.label} ${fmtMetric(def.unit, m[key] ?? null)}`;
  };
  console.log(
    `risk analysis ${res.seq != null ? `#${res.seq}` : "(unsaved)"} · ${res.position.level} · ` +
      [show("legs"), show("credit"), show("accountMarginPctOfNlv"), show("cushionPct"), show("findings")].join(" · "),
  );
  console.log(`  inputs: balances ${res.position.inputs.balanceDate ?? "—"} · positions ${res.position.inputs.positionsAt ?? "—"} · ingest ${res.position.inputs.ingestAt ?? "—"}`);
  console.log(`  fingerprint ${res.position.fingerprint} → ${res.reason}`);
  console.log(
    `  strategy record ${res.strategySeq != null ? `#${res.strategySeq}` : "(unsaved)"} ${res.wroteStrategy ? "WRITTEN (the closed record moved)" : "unchanged"} · ` +
      `v${res.strategy.ruleVersion} · ${res.strategy.metrics.chains ?? 0} closed chains · realized ${fmtMetric("usd", res.strategy.metrics.realized ?? null)}`,
  );
  if (dryRun) console.log("  --dry-run: nothing written");
}

main()
  .catch((e) => {
    console.error("snapshot-risk failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
