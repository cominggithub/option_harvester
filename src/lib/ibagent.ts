import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * The ib_agent channel: everything option_harvester knows how to ask Interactive Brokers
 * WITHOUT a browser.
 *
 * Contract (docs/ib-agent-integration.md § 2): argv only — never a shell, so a ticker can
 * never become part of a command line; always `--json`; parse stdout, diagnostics are on
 * stderr; branch on the EXIT CODE, never on message text; check `schema`; honour `as_of`.
 *
 * Everything here is failure-first, because this channel fails in ways the extension does
 * not. Measured on this box, 2026-09-14: `status` answered `ready: true` while
 * `positions --stored` exited **4** (nothing stored at all) and a live `sync` hung past 90s
 * on "executions request timed out". So:
 *
 * - every call carries a **hard timeout** and is killed, not waited on;
 * - a kill, a non-zero exit and unparseable stdout all become one typed error carrying the
 *   code, so the caller can distinguish "retry later" (3) from "retrying will not help" (4);
 * - **nothing in the request path may call this.** Pages read the DB; only scripts call the
 *   CLI. A hung Gateway must not be able to hang a render.
 */

const CLI = process.env.IB_AGENT_BIN ?? "ib-agent";
const EXPORT_PATH = process.env.IB_AGENT_EXPORT ?? "/mnt/d/project/ib_agent/data/exports/latest.json";
const PROFILE = process.env.IB_AGENT_PROFILE ?? "option_harvester";

/** Payload schema versions this code has been written against. */
export const SUPPORTED_SCHEMAS = [1];

/** Exit codes, from `man ib-agent`. `-1` = the process was killed by us (timeout). */
export const IB_EXIT = {
  ok: 0,
  failed: 1,
  usage: 2,
  unreachable: 3, // Gateway down — retrying later may help
  noData: 4, // nothing synced / empty list — retrying will NOT help
  needs2fa: 5, // a login is waiting for a code — a human must act
  interrupted: 130,
  timeout: -1,
} as const;

export class IbAgentError extends Error {
  constructor(
    readonly code: number,
    readonly stderr: string,
    readonly argv: string[],
  ) {
    super(`ib-agent ${argv.join(" ")} exited ${code}: ${stderr.trim().slice(0, 400) || "no stderr"}`);
    this.name = "IbAgentError";
  }
  /** Worth trying again later without anyone touching anything. */
  get retryable(): boolean {
    return this.code === IB_EXIT.unreachable || this.code === IB_EXIT.timeout;
  }
  /** A human has to do something (2FA, `ib-agent sync`, fix the invocation). */
  get needsHuman(): boolean {
    return this.code === IB_EXIT.needs2fa || this.code === IB_EXIT.noData || this.code === IB_EXIT.usage;
  }
  /** One-word classification for the sync-state row. */
  get kind(): string {
    switch (this.code) {
      case IB_EXIT.unreachable:
        return "gateway-unreachable";
      case IB_EXIT.noData:
        return "no-data";
      case IB_EXIT.needs2fa:
        return "needs-2fa";
      case IB_EXIT.usage:
        return "usage";
      case IB_EXIT.timeout:
        return "timeout";
      case IB_EXIT.interrupted:
        return "interrupted";
      default:
        return "failed";
    }
  }
}

/** Every payload is an object carrying `schema`; most carry `as_of` + `source`. */
export type IbPayload = { schema?: number; as_of?: string; source?: "live" | "snapshot" | string };

export type IbStatus = IbPayload & {
  ready?: boolean;
  process_running?: boolean;
  listening?: boolean;
  readonly?: boolean;
  flex_configured?: boolean;
  trading_mode?: string;
  market_data_type?: string;
};

export type IbAgentPosition = {
  account?: string;
  symbol?: string;
  local_symbol?: string;
  description?: string;
  sec_type?: string;
  right?: string;
  strike?: number | null;
  expiry?: string | null;
  quantity?: number | null;
  avg_cost?: number | null;
  market_value?: number | null;
  market_price?: number | null;
  unrealized_pnl?: number | null;
  currency?: string | null;
  conid?: number | string | null;
  und_conid?: number | string | null;
  underlying?: string | null;
  multiplier?: number | string | null;
  asset_class?: string | null;
  dte?: number | null;
};

export type IbPositionsPayload = IbPayload & { positions?: IbAgentPosition[]; count?: number; totals?: Record<string, unknown> };
export type IbShowPayload = IbPayload & {
  account?: string;
  accounts?: string[];
  account_values?: Record<string, unknown>;
  positions?: IbAgentPosition[];
};
export type IbOrdersPayload = IbPayload & { orders?: Record<string, unknown>[]; master_client_id_hint?: string };
export type IbGreeksPayload = IbPayload & { greeks?: Record<string, unknown>[]; rows?: Record<string, unknown>[]; totals?: Record<string, unknown> };

/**
 * Run one CLI command and return its parsed payload.
 *
 * `timeoutMs` is a kill, not a hope: `execFile` sends SIGTERM at the limit. 30s is
 * generous for a `--stored` read (~2s warm) and deliberately shorter than any caller's
 * patience for a live one.
 */
export async function cli<T extends IbPayload>(args: string[], timeoutMs = 30_000): Promise<T> {
  const argv = [...args, "--json"];
  let stdout: string;
  try {
    const res = await run(CLI, argv, {
      timeout: timeoutMs,
      killSignal: "SIGTERM",
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, IB_AGENT_PROFILE: PROFILE },
    });
    stdout = res.stdout;
  } catch (err) {
    const e = err as { code?: number | string; killed?: boolean; signal?: string; stderr?: string; stdout?: string };
    // A timeout surfaces as killed/SIGTERM with a non-numeric code — map it to our own -1
    // so the caller sees "timeout", not "exited null".
    const killed = e.killed || e.signal === "SIGTERM";
    const code = killed ? IB_EXIT.timeout : typeof e.code === "number" ? e.code : IB_EXIT.failed;
    throw new IbAgentError(code, killed ? `killed after ${timeoutMs}ms: ${e.stderr ?? ""}` : (e.stderr ?? ""), argv);
  }

  let payload: T;
  try {
    payload = JSON.parse(stdout) as T;
  } catch {
    // Exit 0 with non-JSON stdout: the CLI printed a human line (e.g. "no snapshots
    // stored yet") where a payload was promised. Treat it as no-data rather than crash.
    throw new IbAgentError(IB_EXIT.noData, `non-JSON stdout: ${stdout.trim().slice(0, 200) || "(empty)"}`, argv);
  }
  assertSchema(payload, argv);
  return payload;
}

/**
 * Refuse a payload version we were not written against. A bump means a field was renamed
 * or removed, and guessing at that is how a silently-null column happens.
 */
export function assertSchema(payload: IbPayload, argv: string[] = []): void {
  const s = payload?.schema;
  if (s == null) return; // some commands predate the field; absence is not a conflict
  if (!SUPPORTED_SCHEMAS.includes(s)) {
    throw new IbAgentError(
      IB_EXIT.failed,
      `unsupported payload schema ${s} (this code knows ${SUPPORTED_SCHEMAS.join(", ")}) — update the parsers before trusting it`,
      argv,
    );
  }
}

/**
 * The payload's own timestamp, as a Date. Returns null when absent or unparseable —
 * callers treat "no as_of" as "unknown age", which the guard then declines to reason
 * about rather than assuming freshness.
 */
export function payloadAsOf(p: IbPayload | null | undefined): Date | null {
  if (!p?.as_of) return null;
  const t = Date.parse(p.as_of);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** Age of a payload in minutes, or null when it carries no usable `as_of`. */
export function payloadAgeMin(p: IbPayload | null | undefined): number | null {
  const at = payloadAsOf(p);
  return at ? (Date.now() - at.getTime()) / 60_000 : null;
}

/**
 * Freshness gate for a payload we are about to write. Separate from `checkReplace` because
 * it judges the SOURCE's claim about its own data, before any comparison with what we hold.
 */
export function assertFresh(p: IbPayload, maxAgeMin: number, what = "payload"): void {
  const age = payloadAgeMin(p);
  if (age == null) throw new Error(`ib-agent ${what} carries no usable as_of — refusing to date it ourselves`);
  if (age > maxAgeMin)
    throw new Error(`ib-agent ${what} is ${Math.round(age)}min old (limit ${maxAgeMin}) — refused as stale`);
}

// ── Commands (batch/cron callers only) ───────────────────────────────────────────

export const status = (timeoutMs = 20_000) => cli<IbStatus>(["status"], timeoutMs);
/** Stored snapshot by default: contacts nothing, returns instantly, cannot hang. */
export const positions = (opts: { live?: boolean; timeoutMs?: number } = {}) =>
  cli<IbPositionsPayload>(opts.live ? ["positions"] : ["positions", "--stored"], opts.timeoutMs ?? 30_000);
export const show = (timeoutMs = 30_000) => cli<IbShowPayload>(["show"], timeoutMs);
export const orders = (timeoutMs = 45_000) => cli<IbOrdersPayload>(["orders"], timeoutMs);
export const greeks = (timeoutMs = 120_000) => cli<IbGreeksPayload>(["greeks"], timeoutMs);
export const executions = (days = 7, timeoutMs = 60_000) =>
  cli<IbPayload & { executions?: Record<string, unknown>[] }>(["executions", "--days", String(days)], timeoutMs);
export const resolveHeld = (timeoutMs = 60_000) =>
  cli<IbPayload & { resolved?: Record<string, unknown>[] }>(["resolve", "--from-positions", "--options"], timeoutMs);

/**
 * Is the channel usable at all, without throwing? One `status` call, wrapped — this is
 * what a script leads with so a dead Gateway is reported as a channel state rather than as
 * a stack trace, and what the /sync page's ib_agent card is ultimately fed from (via the
 * state table, never by calling out from a render).
 */
export async function probe(timeoutMs = 20_000): Promise<{
  ok: boolean;
  ready: boolean;
  readonly: boolean | null;
  flexConfigured: boolean | null;
  error: string | null;
  kind: string | null;
  status: IbStatus | null;
}> {
  try {
    const s = await status(timeoutMs);
    return {
      ok: true,
      ready: s.ready === true,
      readonly: typeof s.readonly === "boolean" ? s.readonly : null,
      flexConfigured: typeof s.flex_configured === "boolean" ? s.flex_configured : null,
      error: s.ready === true ? null : "gateway reports not ready",
      kind: s.ready === true ? null : "not-ready",
      status: s,
    };
  } catch (err) {
    const e = err as IbAgentError;
    return {
      ok: false,
      ready: false,
      readonly: null,
      flexConfigured: null,
      error: e.message ?? String(err),
      kind: e instanceof IbAgentError ? e.kind : "failed",
      status: null,
    };
  }
}

/**
 * The zero-subprocess read: ib_agent's `watch` loop rewrites `latest.json` atomically each
 * cycle. Missing file is a normal state (the loop may never have run), so it returns null
 * instead of throwing; a file that exists but is stale throws, because serving old
 * positions as current is the failure this whole module is about.
 */
export async function readExport<T extends IbPayload>(maxAgeMin = 30): Promise<T | null> {
  let text: string;
  try {
    text = await readFile(EXPORT_PATH, "utf8");
  } catch {
    return null; // no export written yet — not an error, just not available
  }
  const payload = JSON.parse(text) as T;
  assertSchema(payload, ["export"]);
  assertFresh(payload, maxAgeMin, "export");
  return payload;
}

export const exportPath = () => EXPORT_PATH;
