# wadechen2003.github.io

個人筆記與小工具的集散地，透過 GitHub Pages 靜態託管。

## 結構

- `index.html` — 導入頁，依分類自動列出下方各筆記/工具
- `assets/js/entries.js` — 內容清單設定檔，新增筆記/工具時在這裡加一筆
- `assets/js/render.js` — 純邏輯：依分類分組、排序
- `assets/js/main.js` — 讀取 entries.js，渲染卡片到頁面
- `assets/css/style.css` — 樣式（跟隨系統深色/淺色模式）
- `notes/` `tools/` `logs/` — 各類頁面各自的資料夾，每個項目一個資料夾

## 新增一筆筆記/工具/紀錄

1. 建立 `<folder>/<slug>/index.html`（`folder` 是複數的資料夾名稱：`notes`、`tools` 或 `logs`）
2. 在 `assets/js/entries.js` 的 `SITE_ENTRIES` 加一筆，注意 `category` 欄位是**單數**，必須跟 `SITE_CATEGORIES` 裡的 `key` 完全一致（`note`、`tool` 或 `log`，不是資料夾名稱）：
   ```js
   { title: "...", description: "...", url: "tools/<slug>/index.html", category: "tool", date: "YYYY-MM-DD" }
   ```
3. Commit + push，GitHub Pages 會自動部署

## 執行測試

```bash
node --test assets/js/render.test.js
```
