/**
 * The curated VALUE watchlist — the operator's own moat list, recorded as data.
 *
 * WHY THIS IS NOT THE ROIC SCREEN. `/roic` and the OH:ROIC list are DERIVED: every name whose
 * measured Return on Invested Capital clears HIGH_ROIC_MIN (15%), which is 192 names and counting.
 * That is a filter, and a filter cannot hold a thesis. This list is the opposite kind of object —
 * hand-picked, small, and each entry carrying the reason it is there, in the operator's own
 * words. Neither replaces the other: the screen finds candidates nobody thought of, the list
 * remembers judgements a screen cannot express ("最大優勢不是漢堡").
 *
 * The two disagree, and the disagreement is the useful part. Measured 2026-09-11, three of the
 * eleven fail the 15% ROIC floor:
 *
 *     CHD  14.0%   just under — a defensive staple, not a compounding machine
 *     SYK  10.7%   medical devices carry heavy capital and long product cycles
 *     DHR   5.7%   and this one is structural, not a warning
 *
 * DHR is worth stating plainly because it is the case where the metric and the thesis point in
 * opposite directions FOR THE SAME REASON. Danaher's moat is acquisition plus the DBS operating
 * system — the operator's note says so — and buying companies puts their purchase price on the
 * balance sheet as goodwill, which lands in invested capital and divides the return. A serial
 * acquirer is therefore penalised by ROIC exactly in proportion to how much of its business it
 * acquired. So DHR's 5.7% is not evidence against the thesis; it is the thesis, measured with a
 * ruler that does not fit it. Same mechanism, smaller, for SYK.
 *
 * WHAT THIS LIST IS FOR. These are quality compounders, which makes them the wrong names for the
 * naked-call book and the right ones for the put side. The NC screen requires 1M/3M/6M **not
 * rising** (lib/securities.ts § isNcTarget) — a strong uptrending compounder fails that by
 * construction, and selling a call on it is a bet against the thesis that put it here. Where they
 * belong is `docs/strategy.md` § 三 (cash-backed puts on names worth owning) and
 * `docs/acquisition-puts.md`, where assignment is the goal rather than the failure state. The
 * list carries no IV floor, no liquidity floor and no screen of any kind: membership is a
 * judgement, and it changes when the operator changes it.
 */

/** One curated name, with the operator's own assessment kept verbatim. */
export type ValueName = {
  ticker: string;
  /** 公司 — the company as the operator names it. */
  company: string;
  /** 主要競爭力 / Moat */
  moat: string;
  /** 成長性 — 中 | 中高 | 高 | 極高 */
  growth: string;
  /** 現金流品質 — 很強 | 極強 */
  cashFlow: string;
  /** 我認為最值得研究的地方 — the reason this name is on the list at all. */
  thesis: string;
};

export const VALUE_NAMES: ValueName[] = [
  {
    ticker: "WMT",
    company: "Walmart",
    moat: "全球規模、供應鏈、低價、物流、門市網路、會員、生態系、零售數據",
    growth: "中高",
    cashFlow: "很強",
    thesis:
      "規模越大 → 成本越低 → 價格越低 → 流量越大；目前還增加高毛利廣告業務。FY2025 營收約 $681B，全球每週約 2.7 億客戶。",
  },
  {
    ticker: "MCD",
    company: "McDonald's",
    moat: "全球品牌、加盟制度、地點、供應鏈、規模、標準化營運",
    growth: "中",
    cashFlow: "極強",
    thesis: "最大優勢不是漢堡，而是 asset-light franchise + 全球品牌 + 高現金轉換。官方仍將品牌與 Golden Arches 視為重要 IP。",
  },
  {
    ticker: "HD",
    company: "Home Depot",
    moat: "規模、供應鏈、品牌、門市網路、專業客戶 Pro 生態、產品深度",
    growth: "中高",
    cashFlow: "很強",
    thesis: "DIY + Pro 客戶；尤其 Pro 客戶具有高黏著度。FY2025 Sales $164.7B、Adjusted ROIC 25.7%。",
  },
  {
    ticker: "SHW",
    company: "Sherwin-Williams",
    moat: "品牌、專業施工通路、產品配方、門市網路、客戶關係、規模",
    growth: "中高",
    cashFlow: "極強",
    thesis:
      "塗料本身差異不一定巨大，但專業通路 + 品牌 + 客戶習慣形成護城河。2025 年 5 年 Adjusted EPS CAGR 6.9%，5 年營運現金流 $14.3B。",
  },
  {
    ticker: "CHD",
    company: "Church & Dwight",
    moat: "ARM & HAMMER 等品牌、日用品消費習慣、通路、品牌組合",
    growth: "中",
    cashFlow: "很強",
    thesis: "防禦型消費品 + 小品牌併購。2026 Q1 CFO $174.8M，全年預期 CFO 約 $1.15B。",
  },
  {
    ticker: "SYK",
    company: "Stryker",
    moat: "醫療器材品牌、醫院關係、手術流程整合、產品創新、switching cost",
    growth: "高",
    cashFlow: "很強",
    thesis: "醫療設備具有很強的流程黏著性；人口老化 + 手術需求提供長期需求，但估值容易偏高。",
  },
  {
    ticker: "DHR",
    company: "Danaher",
    moat: "Life Science 工具、診斷設備、耗材、品牌、技術、生態系、併購能力",
    growth: "高",
    cashFlow: "很強",
    thesis: "併購 + DBS 管理系統 + 高毛利耗材。不是單純靠市場成長，而是能持續把公司買大、改善效率。",
  },
  {
    ticker: "MSFT",
    company: "Microsoft",
    moat: "Windows、Office、Azure、企業客戶、生態系、開發者、雲端、AI",
    growth: "極高",
    cashFlow: "極強",
    thesis: "這批裡面成長性 + 現金流 + 護城河最完整之一。問題主要不是企業品質，而是未來成長是否已被價格反映。",
  },
  {
    ticker: "V",
    company: "Visa",
    moat: "全球支付網路、雙邊網路效應、銀行/商戶整合、品牌、規模",
    growth: "高",
    cashFlow: "極強",
    thesis: "非常特殊：Visa 不需要承擔大部分信用風險，主要賺支付網路費；交易量增加可以帶來非常高的增量利潤。",
  },
  {
    ticker: "MA",
    company: "Mastercard",
    moat: "全球支付網路、網路效應、銀行/商戶生態、資料與服務",
    growth: "高",
    cashFlow: "極強",
    thesis: "和 Visa 類似，但 Mastercard 在全球支付基礎設施上形成極強網路效應。",
  },
  {
    ticker: "COST",
    company: "Costco",
    moat: "會員制度、規模採購、低價、會員黏著度、品牌信任、SKU 管理",
    growth: "中高",
    cashFlow: "極強",
    thesis: "商業模式非常好，但最大問題是估值。Costco 是「好公司」的典型，但不一定是「任何價格都值得買」。",
  },
];

const BY_TICKER = new Map(VALUE_NAMES.map((v) => [v.ticker.toUpperCase(), v]));

/** Is this ticker on the curated value list? */
export function isValueName(ticker: string | null | undefined): boolean {
  return BY_TICKER.has((ticker ?? "").trim().toUpperCase());
}

/** The curated entry, for a page that wants to show the operator's own reasoning. */
export function valueName(ticker: string | null | undefined): ValueName | undefined {
  return BY_TICKER.get((ticker ?? "").trim().toUpperCase());
}
