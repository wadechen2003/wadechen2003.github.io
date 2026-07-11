# 個人筆記/工具導入頁 — 設計文件

日期：2026-07-11

## 背景與目標

`wadechen2003.github.io` 是一個 GitHub Pages 靜態網站,用來存放：

- 各種 HTML 筆記
- 用靜態網頁技術（HTML/CSS/JS）完成的小工具，例如第一個要做的 IPF GL Points 計算器
- 未來可能的每日紀錄類頁面，例如健力訓練組數/重量/心得紀錄

需要一個導入頁（`index.html`），讓使用者可以從選單/卡片進入這些未來會陸續新增的頁面。內容數量會隨時間增加，因此需要一個容易維護、不需要改版面程式碼就能新增項目的機制。

## 非目標（Non-Goals）

- 不做搜尋/標籤過濾功能（項目少，之後需要再加）
- 不引入 build 工具或框架（Jekyll、Vite 等）
- 不在這份設計中決定「訓練紀錄頁面」的資料儲存方案（見下方「未來考量」）

## 技術方案

純靜態 HTML/CSS/JS，零依賴，無 build step。理由：

- 內容本質是「一堆各自獨立的 HTML 頁面」，不需要範本引擎或組件系統
- GitHub Pages 原生支援，直接 push 就部署
- 對比 Jekyll：不需要學 Jekyll 規則與 front matter，且目前不需要 Markdown 轉 HTML 或自動掃描目錄的能力

## 檔案結構

```
/
├── index.html                    # 導入頁
├── assets/
│   ├── css/style.css             # 樣式（含深色/淺色主題，跟隨系統設定）
│   └── js/
│       ├── entries.js            # 清單設定檔（分類定義 + 項目清單）
│       └── main.js               # 讀取 entries.js 並渲染卡片
├── notes/                        # 筆記，每個筆記一個資料夾
│   └── <note-slug>/index.html
├── tools/                        # 工具，每個工具一個資料夾
│   └── <tool-slug>/index.html
├── logs/                         # 紀錄類頁面，每個一個資料夾
│   └── <log-slug>/index.html
├── README.md                     # 新的簡短說明（取代舊 HTML5UP README.txt）
└── .gitignore
```

舊的 `LICENSE.txt`、`README.txt`（HTML5UP 範本殘留檔，內容與本專案無關）將被刪除。

## 資料模型：可擴充分類系統

`entries.js` 定義兩個全域變數：分類清單與項目清單。設計重點是**分類可擴充**——未來要加第 4、5 個分類（例如「project」）時，只需要在 `SITE_CATEGORIES` 加一筆、建對應資料夾、幫項目打上該 category，完全不用修改 `main.js` 的渲染邏輯。

```js
// assets/js/entries.js
window.SITE_CATEGORIES = [
  { key: "note", label: "筆記" },
  { key: "tool", label: "工具" },
  { key: "log",  label: "紀錄" },
  // 未來新增分類，直接在這裡加一筆，例如：
  // { key: "project", label: "專案" },
];

window.SITE_ENTRIES = [
  {
    title: "IPF GL Points 計算器",
    description: "輸入量級與成績自動算出 GL Points",
    url: "tools/ipf-gl-points/index.html",
    category: "tool",
    date: "2026-07-11",
  },
];
```

`main.js` 的渲染規則：

1. 依 `SITE_CATEGORIES` 的順序逐一處理
2. 篩選出該 category 底下的 `SITE_ENTRIES`
3. 若該分類目前沒有項目，整個區塊不渲染（不顯示空狀態卡片，保持首頁乾淨）
4. 若有項目，渲染區塊標題（`label`）+ 卡片網格，卡片依 `date` 新到舊排序

## 視覺設計

- **配色**：簡約淡雅風格，透過 `prefers-color-scheme` 自動偵測系統深色/淺色模式，不做手動切換按鈕。深色模式用深灰底 + 淺灰文字；淺色模式用白/米白底 + 深灰文字；兩者共用同一組強調色。
- **版面**：頁首（站名 "Wade's Notes" + 一句話 tagline）→ 依序排列各分類區塊（標題 + 卡片網格，RWD：桌面多欄、手機單欄）。
- **卡片內容**：標題、簡介、日期；整張卡片可點擊跳轉到對應頁面。
- **不做**的裝飾：輪播、進場動畫等，僅用 CSS Grid + 簡單 hover 效果。

## 錯誤處理

`entries.js` 是內嵌的純資料（`<script>` 定義全域變數），沒有 fetch/AJAX，因此沒有網路請求失敗的情境需要處理。空分類的處理已在「資料模型」一節說明（整個區塊不渲染）。

## 內容新增流程

未來新增一筆筆記/工具/紀錄的步驟：

1. 建立新資料夾與其 `index.html`（例如 `tools/ipf-gl-points/index.html`），內容是該頁面自己完整的 HTML（可以有自己的 CSS/JS，不受首頁架構限制）
2. 在 `assets/js/entries.js` 的 `SITE_ENTRIES` 加一筆物件
3. Commit + push，GitHub Pages 自動部署，首頁自動出現新卡片

## 未來考量（不在本次實作範圍）

- **IPF GL Points 計算器**：屬於 `tool` 分類的第一個項目，是本次之後的下一個獨立子專案。
- **健力訓練紀錄頁面**：屬於未來 `log` 分類。GitHub Pages 是純靜態託管，沒有後端/資料庫，可能的資料持久化方案：
  - 瀏覽器端 `localStorage`（簡單，但資料綁定單一裝置/瀏覽器，需搭配匯出/匯入 JSON 備份）
  - 串接第三方雲端服務（如 Firebase/Supabase 免費方案），可跨裝置同步，但需管理外部服務與 API 金鑰
  - 用 GitHub API 把資料寫回本 repo，需處理 token 授權
  
  這個決定會在該子專案自己的 brainstorming/spec 中處理，不影響本次 index 頁架構。

## 驗證方式

- 本機起一個簡單 static server（例如 `python3 -m http.server`）開啟 `index.html`，確認：
  - 三個分類區塊（含未來新增的第 4、5 個）都能正確渲染
  - 只有一筆測試資料時，其餘空分類不顯示
  - 卡片點擊可正確跳轉
  - RWD：桌面多欄、手機單欄皆正常
  - 系統切換深色/淺色模式時頁面配色跟著變化
