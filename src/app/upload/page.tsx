import Link from "next/link";
import { getPositions, getUploads } from "@/lib/positions";
import { formatTimestamp } from "@/lib/format";
import { PositionsControls } from "@/components/PositionsControls";
import { UploadHistory } from "@/components/UploadHistory";

export const dynamic = "force-dynamic";
export const metadata = { title: "IB Position Upload — Option Harvester" };

export default async function UploadPage() {
  const [positions, uploads] = await Promise.all([getPositions(), getUploads()]);
  const uploadItems = uploads.map((u) => ({
    id: u.id,
    filename: u.filename,
    rowCount: u.rowCount,
    when: formatTimestamp(new Date(u.uploadedAt)),
    isCurrent: u.isCurrent,
  }));

  return (
    <main className="min-h-full bg-canvas">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="overline text-ink-faint">Interactive Brokers</div>
        <h1 className="wordmark text-[26px] leading-tight text-ink">IB Position Upload</h1>

        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          Upload your IB positions as a CSV — an Activity Statement, Flex Query, or the Portfolio
          export. Each file is kept here; the most recent one becomes your{" "}
          <Link href="/positions" className="text-accent hover:underline">
            current positions
          </Link>
          , and held names get a <span className="text-accent">◆</span> badge plus a{" "}
          <strong className="text-ink">Holdings</strong> screen in the analyzer.
        </p>

        <div className="mt-5">
          <PositionsControls hasPositions={positions.length > 0} />
        </div>

        {positions.length > 0 && (
          <p className="mt-3 text-[13px] text-ink-muted">
            {positions.length} position{positions.length === 1 ? "" : "s"} imported ·{" "}
            <Link href="/positions" className="text-accent hover:underline">
              view current positions →
            </Link>
          </p>
        )}

        <UploadHistory uploads={uploadItems} />
      </div>
    </main>
  );
}
