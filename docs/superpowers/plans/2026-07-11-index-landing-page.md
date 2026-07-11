# Index Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static `index.html` landing page for `wadechen2003.github.io` that lists future notes/tools/logs as cards, grouped by an extensible, data-driven category system.

**Architecture:** Pure HTML/CSS/JS, zero dependencies, no build step. A data file (`entries.js`) defines categories and entries; a pure logic module (`render.js`) groups/sorts/filters entries by category; a thin DOM-wiring script (`main.js`) renders the result into `index.html`. Content pages (notes/tools/logs) each live in their own folder and are referenced by URL from `entries.js` — they are out of scope for this plan.

**Tech Stack:** Vanilla HTML, CSS (custom properties + `prefers-color-scheme`), vanilla JS (ES5-compatible, no framework), Node's built-in `node:test` runner for unit-testing pure logic (no npm packages).

## Global Constraints

- Zero dependencies, no build step — plain HTML/CSS/JS only.
- The category system must be data-driven and extensible: adding a 4th/5th category (e.g. `project`) must only require adding an entry to `SITE_CATEGORIES` in `entries.js` — no changes to rendering logic.
- A category section renders only if it has at least one entry; empty categories render nothing.
- Cards within a category are sorted by `date` descending (newest first).
- Theme (dark/light) follows the OS via `prefers-color-scheme`; no manual toggle button.
- No search or tag-filtering UI in this version.
- Site title is "Wade's Notes"; UI copy is Traditional Chinese.

---

### Task 1: Repo cleanup — remove template leftovers, add real README

**Files:**
- Delete: `LICENSE.txt`
- Delete: `README.txt`
- Create: `README.md`

**Interfaces:** None (no code dependencies on this task).

- [ ] **Step 1: Remove the old HTML5UP template files**

Run:
```bash
git rm LICENSE.txt README.txt
```
Expected: both files staged for deletion.

- [ ] **Step 2: Create `README.md`**

```markdown
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

1. 建立 `<category>/<slug>/index.html`（`category` 是 `notes`、`tools` 或 `logs`）
2. 在 `assets/js/entries.js` 的 `SITE_ENTRIES` 加一筆：
   ```js
   { title: "...", description: "...", url: "tools/<slug>/index.html", category: "tool", date: "YYYY-MM-DD" }
   ```
3. Commit + push，GitHub Pages 會自動部署

## 執行測試

```bash
node --test assets/js/render.test.js
```
```

- [ ] **Step 3: Verify the working tree**

Run: `git status`
Expected: shows `deleted: LICENSE.txt`, `deleted: README.txt`, `new file: README.md` (README.md untracked/staged once added).

- [ ] **Step 4: Commit**

```bash
git add README.md LICENSE.txt README.txt
git commit -m "Replace HTML5UP template leftovers with project README"
```

---

### Task 2: Pure category-grouping logic (`render.js`) — TDD

**Files:**
- Create: `assets/js/render.js`
- Test: `assets/js/render.test.js`

**Interfaces:**
- Produces: `groupEntries(categories, entries)` function.
  - `categories`: `Array<{ key: string, label: string }>`
  - `entries`: `Array<{ title: string, description: string, url: string, category: string, date: string }>` (`date` is `"YYYY-MM-DD"`)
  - Returns: `Array<{ key: string, label: string, items: entry[] }>` — one element per category **that has at least one matching entry**, in the same order as `categories`, with `items` sorted by `date` descending.
  - Exposed as `module.exports.groupEntries` (Node) and `window.SiteRender.groupEntries` (browser).
- Consumed by: Task 4 (`main.js`).

- [ ] **Step 1: Write the failing tests**

Create `assets/js/render.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { groupEntries } = require('./render.js');

test('returns empty array when there are no categories', () => {
  assert.deepStrictEqual(groupEntries([], []), []);
});

test('excludes categories with zero matching entries', () => {
  const categories = [
    { key: 'note', label: '筆記' },
    { key: 'tool', label: '工具' },
  ];
  const entries = [
    { title: 'A', description: '', url: '#', category: 'tool', date: '2026-01-01' },
  ];
  const result = groupEntries(categories, entries);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].key, 'tool');
});

test('sorts items within a category by date descending', () => {
  const categories = [{ key: 'tool', label: '工具' }];
  const entries = [
    { title: 'Old', description: '', url: '#', category: 'tool', date: '2026-01-01' },
    { title: 'New', description: '', url: '#', category: 'tool', date: '2026-06-01' },
  ];
  const result = groupEntries(categories, entries);
  assert.deepStrictEqual(result[0].items.map((e) => e.title), ['New', 'Old']);
});

test('preserves category order from the categories list', () => {
  const categories = [
    { key: 'note', label: '筆記' },
    { key: 'tool', label: '工具' },
    { key: 'log', label: '紀錄' },
  ];
  const entries = [
    { title: 'Log entry', description: '', url: '#', category: 'log', date: '2026-01-01' },
    { title: 'Note entry', description: '', url: '#', category: 'note', date: '2026-01-01' },
  ];
  const result = groupEntries(categories, entries);
  assert.deepStrictEqual(result.map((g) => g.key), ['note', 'log']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test assets/js/render.test.js`
Expected: FAIL — `Cannot find module './render.js'`.

- [ ] **Step 3: Implement `render.js`**

Create `assets/js/render.js`:

```js
(function (global) {
  'use strict';

  function groupEntries(categories, entries) {
    return categories
      .map(function (category) {
        var items = entries
          .filter(function (entry) {
            return entry.category === category.key;
          })
          .slice()
          .sort(function (a, b) {
            return b.date.localeCompare(a.date);
          });
        return { key: category.key, label: category.label, items: items };
      })
      .filter(function (group) {
        return group.items.length > 0;
      });
  }

  var api = { groupEntries: groupEntries };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.SiteRender = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test assets/js/render.test.js`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add assets/js/render.js assets/js/render.test.js
git commit -m "Add pure category-grouping logic for landing page with tests"
```

---

### Task 3: Content list data file (`entries.js`)

**Files:**
- Create: `assets/js/entries.js`

**Interfaces:**
- Produces: `window.SITE_CATEGORIES` (`Array<{ key: string, label: string }>`), `window.SITE_ENTRIES` (`Array<entry>`, matching the shape from Task 2).
- Consumed by: Task 4 (`main.js`).

- [ ] **Step 1: Write `entries.js`**

Create `assets/js/entries.js`:

```js
window.SITE_CATEGORIES = [
  { key: 'note', label: '筆記' },
  { key: 'tool', label: '工具' },
  { key: 'log', label: '紀錄' },
  // 未來新增分類，直接在這裡加一筆，例如：
  // { key: 'project', label: '專案' },
];

window.SITE_ENTRIES = [
  // 新增項目時在這裡加一筆物件：
  // { title: '...', description: '...', url: 'tools/<slug>/index.html', category: 'tool', date: 'YYYY-MM-DD' },
];
```

- [ ] **Step 2: Syntax-check the file**

Run: `node --check assets/js/entries.js`
Expected: no output (exit code 0). `node --check` only parses the file, so the browser-only `window` reference does not cause an error.

- [ ] **Step 3: Commit**

```bash
git add assets/js/entries.js
git commit -m "Add extensible content list data file for landing page"
```

---

### Task 4: DOM rendering glue (`main.js`)

**Files:**
- Create: `assets/js/main.js`

**Interfaces:**
- Consumes: `window.SiteRender.groupEntries` (Task 2), `window.SITE_CATEGORIES` / `window.SITE_ENTRIES` (Task 3), a DOM element with `id="content"` (produced by Task 5's `index.html`).
- Produces: on `DOMContentLoaded`, appends one `<section class="entry-section">` per non-empty category (each containing an `<h2>` and a `.card-grid` of `.card` links) into `#content`.

- [ ] **Step 1: Write `main.js`**

Create `assets/js/main.js`:

```js
(function () {
  'use strict';

  function createCard(entry) {
    var card = document.createElement('a');
    card.className = 'card';
    card.href = entry.url;

    var title = document.createElement('h3');
    title.textContent = entry.title;

    var description = document.createElement('p');
    description.textContent = entry.description;

    var date = document.createElement('time');
    date.textContent = entry.date;
    date.setAttribute('datetime', entry.date);

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(date);
    return card;
  }

  function createSection(group) {
    var section = document.createElement('section');
    section.className = 'entry-section';

    var heading = document.createElement('h2');
    heading.textContent = group.label;
    section.appendChild(heading);

    var grid = document.createElement('div');
    grid.className = 'card-grid';
    group.items.forEach(function (entry) {
      grid.appendChild(createCard(entry));
    });
    section.appendChild(grid);

    return section;
  }

  function render() {
    var content = document.getElementById('content');
    var groups = window.SiteRender.groupEntries(window.SITE_CATEGORIES, window.SITE_ENTRIES);
    groups.forEach(function (group) {
      content.appendChild(createSection(group));
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
```

- [ ] **Step 2: Syntax-check the file**

Run: `node --check assets/js/main.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add assets/js/main.js
git commit -m "Add DOM rendering glue for landing page cards"
```

---

### Task 5: Landing page markup (`index.html`)

**Files:**
- Create: `index.html`

**Interfaces:**
- Produces: `#content` element that Task 4's `main.js` renders into; loads `assets/js/entries.js`, `assets/js/render.js`, `assets/js/main.js` in that order (each later script depends on globals the earlier one sets).
- Consumes: `assets/css/style.css` (Task 6).

- [ ] **Step 1: Write `index.html`**

Create `index.html`:

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wade's Notes</title>
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
  <header class="site-header">
    <h1>Wade's Notes</h1>
    <p class="tagline">筆記、工具與紀錄的集散地</p>
  </header>

  <main id="content"></main>

  <script src="assets/js/entries.js"></script>
  <script src="assets/js/render.js"></script>
  <script src="assets/js/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify required elements are present**

Run:
```bash
grep -c 'id="content"' index.html
grep -c 'assets/js/entries.js' index.html
grep -c 'assets/js/render.js' index.html
grep -c 'assets/js/main.js' index.html
```
Expected: each command prints `1`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add landing page markup"
```

---

### Task 6: Styling (`style.css`)

**Files:**
- Create: `assets/css/style.css`

**Interfaces:**
- Consumes: class names produced by Task 4's `main.js` — `.entry-section`, `.card-grid`, `.card` (with `<h3>`, `<p>`, `<time>` children) — and `index.html`'s `.site-header`, `.tagline`.

- [ ] **Step 1: Write `assets/css/style.css`**

```css
:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  --card-bg: #f5f5f5;
  --accent: #2a9d8f;
  --border: #e0e0e0;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a1a;
    --fg: #e8e8e8;
    --card-bg: #262626;
    --accent: #4fd1c5;
    --border: #3a3a3a;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  line-height: 1.6;
}

.site-header {
  padding: 3rem 1.5rem 2rem;
  text-align: center;
}

.site-header h1 {
  margin: 0 0 0.5rem;
  font-size: 2rem;
}

.tagline {
  margin: 0;
  color: var(--fg);
  opacity: 0.7;
}

.entry-section {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem;
}

.entry-section h2 {
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.5rem;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.card {
  display: block;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1.25rem;
  text-decoration: none;
  color: var(--fg);
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
}

.card h3 {
  margin: 0 0 0.5rem;
  color: var(--accent);
}

.card p {
  margin: 0 0 0.75rem;
  font-size: 0.9rem;
}

.card time {
  font-size: 0.8rem;
  opacity: 0.6;
}
```

- [ ] **Step 2: Verify key selectors are present**

Run:
```bash
grep -c 'prefers-color-scheme: dark' assets/css/style.css
grep -c '.card-grid' assets/css/style.css
```
Expected: each command prints at least `1`.

- [ ] **Step 3: Commit**

```bash
git add assets/css/style.css
git commit -m "Add landing page styles with dark/light theme support"
```

---

### Task 7: End-to-end verification

**Files:** None (verification only — exercises Tasks 1–6 together).

- [ ] **Step 1: Run the unit tests one more time as a regression check**

Run: `node --test assets/js/render.test.js`
Expected: PASS — all 4 tests green.

- [ ] **Step 2: Start a local static server in the background**

Run:
```bash
python3 -m http.server 8000 >/tmp/http-server.log 2>&1 &
echo $! > /tmp/http-server.pid
sleep 1
```

- [ ] **Step 3: Verify the page and all assets are served**

Run:
```bash
curl -s http://localhost:8000/ | grep "Wade's Notes"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/assets/js/entries.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/assets/js/render.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/assets/js/main.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/assets/css/style.css
```
Expected: first command prints a line containing `Wade's Notes`; each `curl -w` command prints `200`.

- [ ] **Step 4: Stop the local server**

Run:
```bash
kill "$(cat /tmp/http-server.pid)"
rm /tmp/http-server.pid /tmp/http-server.log
```

- [ ] **Step 5: Manual browser check (human, not automated)**

`SITE_ENTRIES` is empty at this point (no real notes/tools/logs exist yet), so the page is expected to show only the header with no card sections — that's the correct empty state per the design spec. Open `http://localhost:8000` in a browser and confirm:
- The header "Wade's Notes" and tagline render.
- No empty/broken section appears below the header.
- No console errors.
- Toggling the OS between light/dark mode changes the page colors.

To eyeball actual card rendering before real content exists, temporarily paste this into the browser console, then reload the page afterward to discard it:
```js
SITE_ENTRIES.push({ title: '測試卡片', description: '這是一筆測試資料', url: '#', category: 'tool', date: '2026-07-11' });
SiteRender && document.getElementById('content').appendChild(
  (function (g) {
    var s = document.createElement('section');
    s.className = 'entry-section';
    var h = document.createElement('h2'); h.textContent = g.label; s.appendChild(h);
    var grid = document.createElement('div'); grid.className = 'card-grid'; s.appendChild(grid);
    return s;
  })(SiteRender.groupEntries(SITE_CATEGORIES, SITE_ENTRIES).find(function (g) { return g.key === 'tool'; }))
);
```
(This is a manual sanity check only — no code changes are needed for it.)

- [ ] **Step 6: Confirm final repo state**

Run: `git status`
Expected: clean working tree (`nothing to commit, working tree clean`), all prior tasks' commits present in `git log`.
