import { getDashboardData } from "@/lib/securities";
import { formatTimestamp } from "@/lib/format";
import { computeOhWatchlists, getIbWatchlists } from "@/lib/watchlists";
import { WatchlistBrowser, type WatchlistTab } from "@/components/WatchlistBrowser";

export const dynamic = "force-dynamic";

// Watchlists browser — left-nav tabs (OH computed lists + IB synced lists) with
// the Analyzer's table view for each. OH membership is derived live; IB lists
// come from the extension sync (option_harvest_watchlist).
export default async function WatchlistsPage() {
  const [{ securities, asOf }, ibLists] = await Promise.all([getDashboardData(), getIbWatchlists()]);
  const ohLists = computeOhWatchlists(securities);

  const tabs: WatchlistTab[] = [
    ...ohLists.map((wl) => ({
      id: `oh:${wl.key}`,
      source: "OH" as const,
      label: wl.name,
      desc: wl.desc,
      tickers: wl.members.map((m) => m.ticker),
    })),
    ...ibLists.map((wl) => ({
      id: `ib:${wl.id}`,
      source: "IB" as const,
      label: wl.name,
      desc: undefined,
      tickers: wl.members.map((m) => m.ticker).filter((t): t is string => !!t),
    })),
  ];

  return <WatchlistBrowser securities={securities} asOf={asOf ? formatTimestamp(new Date(asOf)) : null} tabs={tabs} />;
}
