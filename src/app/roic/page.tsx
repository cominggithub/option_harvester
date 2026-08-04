import { getDashboardData } from "@/lib/securities";
import { formatTimestamp } from "@/lib/format";
import { RoicScreen } from "@/components/RoicScreen";

export const dynamic = "force-dynamic";

// Value-investment screen: high-ROIC S&P 500 companies (ROIC ≥ HIGH_ROIC_MIN),
// sorted by ROIC descending. ROIC is computed at ingest (src/lib/roic.ts) and
// carried on each SecurityRow; the "high roic" flag is set in getDashboardData.
export default async function RoicPage() {
  const { securities, asOf } = await getDashboardData();
  const rows = securities
    .filter((s) => s.highRoic)
    .sort((a, b) => (b.roic ?? 0) - (a.roic ?? 0));
  return <RoicScreen rows={rows} asOf={asOf ? formatTimestamp(new Date(asOf)) : null} />;
}
