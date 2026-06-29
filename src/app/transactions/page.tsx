import { getPnlReport, getTransactionUploads } from "@/lib/transactions";
import { formatTimestamp } from "@/lib/format";
import { PnlDashboard } from "@/components/PnlDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "P/L — Option Harvester" };

export default async function PnlPage() {
  const [report, uploads] = await Promise.all([getPnlReport(), getTransactionUploads()]);
  const lastUpload = uploads[0] ? formatTimestamp(new Date(uploads[0].uploadedAt)) : null;
  return <PnlDashboard report={report} lastUpload={lastUpload} />;
}
