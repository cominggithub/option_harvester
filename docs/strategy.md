# 跨週期總經防禦：全現金流動性期權收租策略系統

> **這是 option_harvester 這個 web 存在的理由 (the product rationale).**
> The dashboard exists to **screen for naked-call targets** under this strategy.

> **核心戰略思想：**
> 「對弱勢產業用 CC 打游擊，對優質資產用 Put 築防線。」
> 徹底放棄持有現貨的 Beta 曝險，利用全現金的移動自由，持續收割地心引力（下跌趨勢）與時間流逝（Theta）的紅利。

---

## 一、 宏觀選時與戰場篩選 (Macro & Filter)

### 1. 總經大勢判斷 (Macro View)
* **當前環境：** 多週期低檔交會，長牛機率極低。美債、日元、日債、私人信貸及房貸等結構性地雷具備連鎖崩盤風險。
* **戰略定位：** 現階段「押牛」的風險回報比極差。策略全面轉入**全現金（100% Cash / Cash Equivalent）**狀態，保持絕對流動性與防禦力。

### 2. 標的篩選紀律 (Stock Selection)
* **產業與級別：** 嚴格限定在 **ETF 級別**（拒絕個股跳空風險），且必須符合**基本面弱勢、技術面空頭排列（陰跌、毫無向上動能）**的產業板塊。
* **分散原則：** 資金分散投入 20~30 檔不同產業、不相關的弱勢 ETF，利用大數法則分攤微觀波動。

---

## 二、 常態市場運行：空頭產業 CC 打游擊 (Bear Market CC)

平時市場平盤或常態陰跌時（70-90% 的時間），以全現金作為保證金進行期權端收租。

### 1. 建倉規格
* **方向：** 賣出虛擬 Naked Call（在全現金架構下等同於不持有現貨的 CC 套利）。
* **參數：** **初始 Delta 0.30** (約 OTM 5-10%)。
* **風控防火牆（進場即掛單）：**
  * **期權端掛 2.0 ~ 2.5 倍租金的 Stop Limit 單**（買回平倉 Buy to Close）。
  * 實務操作中，亦可使用條件單：當 ETF 現貨價格快觸及 Strike Price 時，系統自動執行期權買回。

### 2. 消防 SOP（停損控制流程）
* **觸發即虧損：** 只要標的爆發強動能反彈，期權價格觸及 Stop 線，**機械化認賠平倉，絕對不進行 Roll（硬抗轉倉）**。
* **盈虧鎖死：** 虧損死死鎖定在 1 倍租金（賺 1 賠 1）。不碰現貨流動性，現貨持有時間由始至終為零。
* **勝率重置：** 離場後將標的放入短期黑名單。完全解凍的現金立刻抽離，轉投其他「依然處於陰跌趨勢」的全新弱勢標的。

---

## 三、 極端市場運行：大崩盤退場與反手狩獵 (Panic Market CSP)

當美債、日元或私人信貸等總經地雷引發全球性恐慌大崩盤（Panic Selling）時，系統啟動升級版防禦與進攻。

### 1. 第一階段：全面退場觀望（De-risk Window）
* **動作：** 利用現貨垂直下墜、Delta 迅速萎縮的窗口，**在第一時間直接一鍵 Close 所有 CC**。
* **結果：** 帶著 80%~90% 的已到手租金利潤乾淨離場，全現金池 100% 回歸固態，在流動性大屠殺中保持看戲與絕對安全的狀態。

### 2. 第二階段：反手築防線（轉攻 Cash-Secured Put）
當市場恐慌達到頂點、IV（隱含波動率）飆破歷史高位時，利用全市場最奢侈的「實體現金流動性」轉守為攻：
* **戰場轉移：** 拋棄爛產業，**目標鎖定 QQQ、SPY 等核心優質資產/大盤指數**。
* **建倉參數：** 賣出 **Deep OTM Put (Delta 0.10 ~ 0.15)**，相當於現價再打 15-20% 折扣。
* **資金鋼鐵鐵律：** 賣出 Put 的總名義價值（履約價 × 100 × 口數），**絕對不能超過全現金池總額**。保留至少 50% 閒置現金防範券商在危機時無預警調高保證金。

### 3. 開獎後的雙贏閉環
* **情境 A：沒買到現貨（大機率）**
  市場在深水區落底 V 轉，IV 瞬間崩潰（Volatility Crush），Put 價值歸零。**無痛收乾極致暴利的 Put 權利金**。等待市場信心恢復（VIX 回落至 20 以下），資金重新回到「常態空頭產業 CC」循環。
* **情境 B：買到現貨（低機率）**
  系統用極低的跳樓打折價自動幫您建倉優質資產。此時欣然接受，長線持有這籃優質核心資產，或在其上方啟動標準 Covered Call 輪轉。

---

## 四、 系統整體損益矩陣 (Payoff Summary)

* **常態市場：** 80% 標的直接收乾 100% 租金；20% 標的反彈觸發 Stop，賠掉 100% 租金。**大數法則下，每月總金額穩定正增長。**
* **極端大牛市：** 頻繁觸發 Stop，付出例行過路費與點差磨損（慢性失血），但本金核心骨髓毫髮無傷。
* **極端大崩盤：** 第一時間 CC 獲利落袋 ➔ 轉攻優質 CSP ➔ 橫豎都贏（白拿暴利保費 或 低點擁有一籃子高價值核心資產）。

---

## 五、 實戰版本 v2：Δ0.15 廣撒網收租（2026-08 現行做法）

> **短 call 的正式規格已獨立成文：[short-call-strategy.md](short-call-strategy.md)**（含每個目標的
> 實績、賺賠歸因，以及 expiry × delta 的獲利區間）。兩者衝突時以該文件為準。
>
> 這一節是**目前實際在跑的**紀律備忘（memo），與上面 v1（Δ0.30 + 觸價機械停損）的差異
> 已逐條標出。**`/risk` 頁面就是按這一節的參數在量測整個 book**，引擎與常數在
> `src/lib/bookrisk.ts`（自我檢查 `scripts/bookrisk-check.ts`）。

### 1. 建倉紀律 (Entry)

| 參數 | v2 現行 | v1 原始 | 說明 |
| --- | --- | --- | --- |
| 天期 DTE | **35–45 天** | 未指定 | Theta 衰減曲線最甜的一段；太近 gamma 太兇，太遠資金效率差。 |
| 進場 Delta | **\|Δ\| ≈ 0.15**（band 0.10–0.20） | Δ 0.30 | 更遠的履約價換更高勝率，單筆租金變小 → **靠鋪的檔數把總額做出來**。 |
| 標的趨勢 | **必須不是上升**（陰跌 / 盤整走弱） | 同 | 賣 call 的第一道防線是趨勢，不是履約價。 |
| IV 條件 | 偏好**高 IV 且開始收縮**（IV crush 起點） | 高 IV | 高 IV 給高權利金，IV 回落本身就是獲利來源（vega 順風）。 |
| 標的範圍 | ETF **與**個股都做（個股必查財報日） | 只做 ETF | 放寬換取分散度；代價是跳空風險 → 用「財報在到期日前」清單控管。 |
| 分散 | **40+ 檔不同標的、看主題不看產業** | 20–30 檔弱勢 ETF | 產業標籤會騙人（SOXX/SOXL/TSM 是三個產業、同一個賭注）→ 用 theme 叢集看真實集中度。 |
| 單筆規模 | 每檔 1–2 口為主 | — | 「單筆不重要」是這套策略的前提；任何一筆都不該影響整體績效。 |

### 2. 部位管理 (Management) — v2 用 Roll 取代硬停損

* **獲利平倉：** 收回 **70% 權利金**就平倉（或 ≤14 天剩 50% 也平），把保證金放出來重新賣
  35–45 DTE。不為了最後幾塊錢承擔尾段 gamma。
* **Roll（v1 明文禁止、v2 核心工具）：** 當 \|Δ\| 越過 **0.30**、或現價逼近履約價 5% 以內、
  或**剩餘壽命的 σ 緩衝不到 0.75σ**（近月）時，**往外／往上 roll 收淨 credit**。
  硬性邊界：**roll 之後的到期日必須仍在 1 年以內**（book 只做 <1y），且 roll 後至少還有
  30 天空間；1 年牆前擠不進去就直接平倉，不要為了轉倉把部位推到看不見的遠月。
* **放棄線：** \|Δ\| > **0.45** 或已經 ITM → **平倉（或必要時買現貨封住）**，不要在爛部位上加碼轉倉。
* **不碰現貨：** 全現金架構不變；put 端一律以現金覆蓋名義價值。

### 3. 判斷標準：整體策略獲利，不是單筆勝率

* 「**我不需要每一筆都賺，只要策略是賺的**」——所以績效與風控都看 **portfolio 層級**：
  總 credit、已實現+未實現、Θ/日、保證金占 NLV、集中度、以及**平行衝擊下的損益**。
* 對照組不是「勝率」而是：**單一主題最大 credit 占比**、**Δ$ 淨曝險**、**<1σ 的部位數**。
* 允許個別部位虧到 1–2 倍租金；不允許的是**同一個賭注被下了十次**（叢集集中）或
  **保證金用到沒有反手能力**。

### 4. `/risk` 頁量測的紅線（超過就是紀律問題，不是市場問題）

1. **主題集中度**：任一 theme 的 credit 占比過高（HHI / effective themes 太低）。
2. **σ 緩衝**：`sigmasToStrike < 1` 的部位——%OTM 看起來很遠，但在高 IV 標的上一個
   expected move 就到履約價。
3. **趨勢背離**：short call 掛在**已經翻多**的標的上（違反第 1 條進場紀律）。
4. **財報跳空**：到期日前有財報的部位。
5. **保證金**：Σ 精算維持保證金 ÷ NLV；未同步 what-if 的部位會被**外推**（原始值只是下限）。
6. **方向偏斜**：call 端與 put 端的 credit / 名義價值失衡（賣了太多 put = 其實在做多）。

---

## How this maps to the dashboard (build implications)


The screen must surface **naked-call targets** = the right side of this strategy
(the calls are sold naked, all-cash — no spot):

1. **ETF-level only** for the naked-call game — "拒絕個股跳空風險" (reject single-stock gap risk).
   → The current universe (S&P 500 single stocks + 6 broad ETFs) is the **wrong** universe.
   We need a curated set of ~20–30 **liquid sector / thematic ETFs** (the weak-sector
   candidates), and the naked-call screen should default to `type = ETF`.
2. **Bearish / downtrend** — "基本面弱勢、技術面空頭排列（陰跌、毫無向上動能）".
   → Use the multi-window trend (esp. 3M/6M/1Y = "down") to find 陰跌 names.
3. **Liquid weekly options** — needs the weekly expiry ladder for entry/stop management.
4. **Diversification** — 20–30 uncorrelated weak sector ETFs (favorites/targets help track the basket).
5. **Panic pivot (naked puts)** — a separate screen for QQQ/SPY-class quality at high IV (Deep-OTM puts,
   Delta 0.10–0.15). Distinct from the naked-call screen.
6. **Acquisition puts (第三本帳)** — short puts on names the operator actually **wants to own**
   (currently GDX and SOXX): 想在低點買進，所以賣 put 等於「付錢請人幫你掛限價單」。**Assignment
   is the goal, not the failure**, so neither the naked-call rules nor the panic-pivot rules
   apply to them; they are judged on the **effective basis** (strike − premium) and on whether
   the cash can actually take delivery. Authority: **[acquisition-puts.md](acquisition-puts.md)**.

So "Best Harvest" (generic high-IV + weekly ladder, all stocks) is **not** the strategy screen.
The intended primary screen is **Naked Call = downtrending liquid sector ETFs**.
