import Link from "next/link";
import { getPositions, getUploads } from "@/lib/positions";
import { getTransactions, getTransactionUploads } from "@/lib/transactions";
import { formatTimestamp } from "@/lib/format";
import { UploadControl } from "@/components/UploadControl";
import { UploadHistory, type UploadItem } from "@/components/UploadHistory";

export const dynamic = "force-dynamic";
export const metadata = { title: "IB Upload — Option Harvester" };

export default async function UploadPage() {
  const [positions, posUploads, transactions, txUploads] = await Promise.all([
    getPositions(),
    getUploads(),
    getTransactions(),
    getTransactionUploads(),
  ]);

  // One merged, time-sorted history — files are tagged by what they imported.
  const history: UploadItem[] = [
    ...posUploads.map((u) => ({ ...u, kind: "positions" as const })),
    ...txUploads.map((u) => ({ ...u, kind: "transactions" as const })),
  ]
    .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
    .map((u) => ({
      id: u.id,
      filename: u.filename,
      rowCount: u.rowCount,
      when: formatTimestamp(new Date(u.uploadedAt)),
      isCurrent: u.isCurrent,
      kind: u.kind,
    }));

  return (
    <main className="min-h-full bg-canvas">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="overline text-ink-faint">Interactive Brokers</div>
        <h1 className="wordmark text-[26px] leading-tight text-ink">IB Upload</h1>

        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          Drop in any IB CSV — a positions export (Activity Statement / Flex Query / Portfolio) or a
          transactions file (e.g.{" "}
          <code className="rounded bg-surface px-1 py-0.5 text-[12px]">U…​.TRANSACTIONS.YTD</code>).
          The format is detected automatically: positions drive your{" "}
          <Link href="/positions" className="text-accent hover:underline">
            Positions
          </Link>{" "}
          and Holdings, transactions drive your{" "}
          <Link href="/transactions" className="text-accent hover:underline">
            P/L
          </Link>
          .
        </p>

        <div className="mt-5">
          <UploadControl
            endpoint="/api/upload"
            hasData={positions.length > 0 || transactions.length > 0}
            uploadLabel="Upload IB file"
            reuploadLabel="Upload another file"
            noun="row"
            clearConfirm="Clear all imported positions and transactions?"
          />
        </div>

        <p className="mt-3 text-[13px] text-ink-muted">
          {positions.length} position{positions.length === 1 ? "" : "s"} ·{" "}
          {transactions.length} transaction{transactions.length === 1 ? "" : "s"} imported
          {(positions.length > 0 || transactions.length > 0) && (
            <>
              {" · "}
              <Link href="/positions" className="text-accent hover:underline">
                Positions
              </Link>{" "}
              ·{" "}
              <Link href="/transactions" className="text-accent hover:underline">
                P/L
              </Link>
            </>
          )}
        </p>

        <UploadHistory uploads={history} />
      </div>
    </main>
  );
}
