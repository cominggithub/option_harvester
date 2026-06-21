# 跨週期總經防禦：全現金流動性期權收租策略系統

> **這是 option_harvester 這個 web 存在的理由 (the product rationale).**
> The dashboard exists to **screen for CC targets** under this strategy.

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

## How this maps to the dashboard (build implications)

The screen must surface **CC targets** = the right side of this strategy:

1. **ETF-level only** for the CC game — "拒絕個股跳空風險" (reject single-stock gap risk).
   → The current universe (S&P 500 single stocks + 6 broad ETFs) is the **wrong** universe.
   We need a curated set of ~20–30 **liquid sector / thematic ETFs** (the weak-sector
   candidates), and the CC-target screen should default to `type = ETF`.
2. **Bearish / downtrend** — "基本面弱勢、技術面空頭排列（陰跌、毫無向上動能）".
   → Use the multi-window trend (esp. 3M/6M/1Y = "down") to find 陰跌 names.
3. **Liquid weekly options** — needs the weekly expiry ladder for entry/stop management.
4. **Diversification** — 20–30 uncorrelated weak sector ETFs (favorites/targets help track the basket).
5. **Panic pivot (CSP)** — a separate screen for QQQ/SPY-class quality at high IV (Deep-OTM puts,
   Delta 0.10–0.15). Distinct from the CC-target screen.

So "Best Harvest" (generic high-IV + weekly ladder, all stocks) is **not** the strategy screen.
The intended primary screen is **CC Targets = downtrending liquid sector ETFs**.
