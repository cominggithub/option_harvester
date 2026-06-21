import { getDashboardData } from "@/lib/securities";
import { formatTimestamp } from "@/lib/format";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { securities, asOf } = await getDashboardData();
  // Format on the server so the client component doesn't cause a TZ hydration mismatch.
  const asOfDisplay = asOf ? formatTimestamp(new Date(asOf)) : null;

  return <Dashboard securities={securities} asOf={asOfDisplay} />;
}
