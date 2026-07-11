# IPF GL Points 計算器 — 設計文件

日期：2026-07-11

## 背景與目標

`wadechen2003.github.io` 的導入頁架構已完成（見 [2026-07-11-index-landing-page-design.md](2026-07-11-index-landing-page-design.md)），第一個要放進 `tool` 分類的實際項目是 IPF GL Points 計算器：輸入性別、裝備類別、項目、體重與成績，計算出 IPF 官方的 GL Points 相對分數。

未來還會有其他類似的計算工具，此頁面的檔案結構與模式應可被之後的工具參考延用。

## 公式與係數（權威來源）

來源：[IPF GL Formula 官方頁面](https://www.powerlifting.sport/rules/codes/info/ipf-formula) 與其係數 PDF [IPF_GL_Coefficients-2020.pdf](https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_GL_Coefficients-2020.pdf)（截至 2026-07-11 查證，官方頁面仍指向此文件，為目前生效版本）。

```
IPF GL Coefficient = 100 / (A - B * e^(-C * Bwt))       （四捨五入到小數點後 6 位）
IPF GL Points = IPF GL Coefficient * Result              （Result = 0 時，Points = 0）
```

體重下限：男子 ≥ 40kg，女子 ≥ 35kg（低於下限視為無效輸入）。

係數表（8 組，男/女 × Classic/Equipped × Powerlifting/Bench）：

| 分類 | A | B | C |
|---|---|---|---|
| 男子 Equipped Powerlifting | 1236.25115 | 1449.21864 | 0.01644 |
| 男子 Classic Powerlifting | 1199.72839 | 1025.18162 | 0.00921 |
| 男子 Equipped Bench Press | 381.22073 | 733.79378 | 0.02398 |
| 男子 Classic Bench Press | 320.98041 | 281.40258 | 0.01008 |
| 女子 Equipped Powerlifting | 758.63878 | 949.31382 | 0.02435 |
| 女子 Classic Powerlifting | 610.32796 | 1045.59282 | 0.03048 |
| 女子 Equipped Bench Press | 221.82209 | 357.00377 | 0.02937 |
| 女子 Classic Bench Press | 142.40398 | 442.52671 | 0.04724 |

官方驗算範例（用於單元測試的 golden values）：

1. 男子 Equipped Powerlifting，體重 92.04kg，Total 1035.0kg → coefficient = 0.109039，Points = **112.855365**
2. 女子 Classic Bench Press，體重 70.50kg，成績 122.5kg → coefficient = 0.790069，Points = **96.783453**

## 非目標

- 不支援磅（lb）單位，只支援公斤，與 IPF 官方規則一致。
- 不支援分別輸入蹲舉/臥推/硬舉三項再自動加總，只接受直接輸入的 Total/成績總和。
- 不顯示中間的 GL Coefficient，只顯示最終 GL Points 分數。

## 檔案結構

獨立自足的工具頁，放在 `tools/ipf-gl-points/`，只共用首頁 `assets/css/style.css` 的視覺主題（配色變數、字體），不依賴首頁的 `entries.js`/`render.js`/`main.js` 架構：

```
tools/ipf-gl-points/
├── index.html          # 表單頁面，引用 ../../assets/css/style.css + 自己的 style.css
├── style.css            # 表單版面樣式，延伸首頁的 CSS 變數（--bg/--fg/--accent 等）
├── gl-points.js         # 純計算邏輯：係數表 + calculateGLPoints()
├── gl-points.test.js    # 用官方驗算範例做回歸測試（node:test）
└── main.js              # DOM 邏輯：讀表單、呼叫計算、顯示結果
```

## 核心邏輯設計（`gl-points.js`）

沿用首頁 `assets/js/render.js` 的模式：純函式、無副作用、Node/瀏覽器雙用匯出。

```js
window.GLCoefficients = {
  // key 格式：{sex}-{equipment}-{event}
  'men-equipped-powerlifting': { A: 1236.25115, B: 1449.21864, C: 0.01644 },
  'men-classic-powerlifting':  { A: 1199.72839, B: 1025.18162, C: 0.00921 },
  'men-equipped-bench':        { A: 381.22073,  B: 733.79378,  C: 0.02398 },
  'men-classic-bench':         { A: 320.98041,  B: 281.40258,  C: 0.01008 },
  'women-equipped-powerlifting': { A: 758.63878, B: 949.31382, C: 0.02435 },
  'women-classic-powerlifting':  { A: 610.32796, B: 1045.59282, C: 0.03048 },
  'women-equipped-bench':        { A: 221.82209, B: 357.00377, C: 0.02937 },
  'women-classic-bench':         { A: 142.40398, B: 442.52671, C: 0.04724 },
};

function calculateGLPoints({ sex, equipment, event, bodyweight, result }) {
  // 1. 查表取得 { A, B, C }（key 由 sex-equipment-event 組成）
  // 2. 驗證體重下限：sex === 'men' ? bodyweight >= 40 : bodyweight >= 35
  //    不合格 → 回傳 null
  // 3. coefficient = 100 / (A - B * Math.exp(-C * bodyweight))，四捨五入到小數點後 6 位
  // 4. result === 0 → 回傳 0；否則回傳 coefficient * result
}
```

- 匯出方式與 `render.js` 一致：`module.exports`（Node 測試用）與 `window.GLPoints`（瀏覽器用）。
- 無效查表 key、無效體重 → 回傳 `null`，由呼叫端（`main.js`）決定如何顯示。

## 表單欄位（`index.html`）

- 性別：Men / Women（radio 或 select）
- 裝備：Classic / Equipped
- 項目：Powerlifting（三項總和）/ Bench Press
- 體重（kg，數字輸入，`step="0.01"`）
- 成績（kg，數字輸入，`step="0.5"`，對應 Powerlifting 為 Total，Bench Press 為單項成績）
- 結果顯示區：GL Points 分數，顯示到小數點後 2 位

## 資料流

使用者調整任一欄位 → `main.js` 讀取所有欄位值 → 呼叫 `GLPoints.calculateGLPoints(...)` → 依回傳值更新畫面：
- 回傳數字 → 顯示「GL Points: X.XX」
- 回傳 `null`（體重低於下限）→ 顯示提示文字，例如「體重需 ≥ 40kg（男）/ ≥ 35kg（女）」
- 任一必填欄位為空/非數字 → 不顯示結果區塊，也不顯示錯誤（避免還沒輸入完就報錯轟炸）

## 錯誤處理

- 體重低於該性別下限：`calculateGLPoints` 回傳 `null`，UI 顯示不計算的提示訊息。
- 成績為 0：依官方公式規則，GL Points 為 0，正常顯示（不是錯誤狀態）。
- 欄位空白或非數字：UI 判斷為「尚未輸入完成」，不呼叫計算或不顯示結果區塊，維持畫面乾淨。

## 測試

`gl-points.test.js` 使用 `node:test`，以官方 PDF 附的兩個驗算範例作為 golden test：

1. 男子 Equipped Powerlifting，體重 92.04kg，Total 1035.0kg → 斷言結果為 `112.855365`
2. 女子 Classic Bench Press，體重 70.50kg，成績 122.5kg → 斷言結果為 `96.783453`

另外補測試：
- 體重低於下限（如男子 39kg）→ 回傳 `null`
- 成績為 0 → 回傳 `0`

`main.js`（DOM 邏輯）沿用首頁模式，不寫自動化測試，改用本機伺服器 + 瀏覽器手動驗證（見下方驗證方式）。

## 收尾：註冊到首頁

完成後在 `assets/js/entries.js` 的 `SITE_ENTRIES` 加一筆：

```js
{
  title: 'IPF GL Points 計算器',
  description: '輸入性別、裝備、體重與成績，計算 IPF 官方 GL Points 分數',
  url: 'tools/ipf-gl-points/index.html',
  category: 'tool',
  date: '2026-07-11',
}
```

## 驗證方式

- `node --test tools/ipf-gl-points/gl-points.test.js`：確認官方驗算範例與邊界情況全數通過。
- 本機起 static server，開啟 `tools/ipf-gl-points/index.html`，確認：
  - 8 種分類組合都能選擇並正確查到係數
  - 輸入官方範例的體重/成績，畫面顯示 112.86（92.04kg, Total 1035.0kg, 男 Equipped PL）與 96.78（70.50kg, 122.5kg, 女 Classic Bench）
  - 體重低於下限時顯示提示訊息，不顯示分數
  - 頁面沿用首頁的深色/淺色主題
- 確認首頁 `index.html` 重新載入後，「工具」分類出現這個項目的卡片，點擊可正確導向。
