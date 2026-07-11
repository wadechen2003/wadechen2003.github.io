# IPF GL Points Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static tool page at `tools/ipf-gl-points/index.html` that calculates IPF GL Points from sex, equipment, event, bodyweight, and result, using the official IPF formula and coefficients.

**Architecture:** Self-contained tool page, sharing only the site's `assets/css/style.css` theme variables (not its JS architecture). A pure calculation module (`gl-points.js`) holds the coefficient table and formula, unit-tested against the IPF PDF's own worked examples; a thin DOM-wiring script (`main.js`) reads the form and displays results. Same pattern as the landing page's `render.js`/`main.js` split.

**Tech Stack:** Vanilla HTML, CSS (reusing the site's CSS custom properties), vanilla JS (ES5-compatible), Node's built-in `node:test` runner for unit-testing pure logic (no npm packages).

## Global Constraints

- Zero dependencies, no build step — plain HTML/CSS/JS only.
- Formula: `IPF GL Coefficient = 100 / (A - B * e^(-C * Bwt))`, rounded to 6 decimal places; `IPF GL Points = Coefficient * Result`, also rounded to 6 decimal places; if `Result === 0`, `Points = 0`.
- Coefficient values are exact and must match the table in the design spec verbatim (8 entries: men/women × classic/equipped × powerlifting/bench).
- Minimum bodyweight: men ≥ 40kg, women ≥ 35kg. Below the minimum, the calculation returns `null` (invalid), not an error throw.
- Only kg is supported (no lb conversion).
- Display only the final GL Points score (not the intermediate coefficient), to 2 decimal places.
- The tool page reuses `assets/css/style.css`'s theme (CSS custom properties: `--bg`, `--fg`, `--card-bg`, `--accent`, `--border`) for visual consistency with the landing page — it must not redefine or override these variables.
- UI copy is Traditional Chinese.

---

### Task 1: Pure calculation logic (`gl-points.js`) — TDD

**Files:**
- Create: `tools/ipf-gl-points/gl-points.js`
- Test: `tools/ipf-gl-points/gl-points.test.js`

**Interfaces:**
- Produces: `calculateGLPoints({ sex, equipment, event, bodyweight, result })` function.
  - `sex`: `'men' | 'women'`
  - `equipment`: `'classic' | 'equipped'`
  - `event`: `'powerlifting' | 'bench'`
  - `bodyweight`, `result`: numbers (kg)
  - Returns: a number (GL Points, rounded to 6 decimal places) or `null` if the sex/equipment/event combination is unknown, or if `bodyweight` is below the minimum for `sex`.
  - Also exports `COEFFICIENTS` (the raw coefficient table, keyed `"{sex}-{equipment}-{event}"`).
  - Exposed as `module.exports` (Node) and `window.GLPoints` (browser).
- Consumed by: Task 2 (`main.js`).

- [ ] **Step 1: Write the failing tests**

Create `tools/ipf-gl-points/gl-points.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateGLPoints } = require('./gl-points.js');

test('matches official example: men equipped powerlifting', () => {
  const points = calculateGLPoints({
    sex: 'men',
    equipment: 'equipped',
    event: 'powerlifting',
    bodyweight: 92.04,
    result: 1035.0,
  });
  assert.strictEqual(points, 112.855365);
});

test('matches official example: women classic bench press', () => {
  const points = calculateGLPoints({
    sex: 'women',
    equipment: 'classic',
    event: 'bench',
    bodyweight: 70.50,
    result: 122.5,
  });
  assert.strictEqual(points, 96.783453);
});

test('returns null when bodyweight is below the minimum for the sex', () => {
  const points = calculateGLPoints({
    sex: 'men',
    equipment: 'classic',
    event: 'powerlifting',
    bodyweight: 39,
    result: 500,
  });
  assert.strictEqual(points, null);
});

test('returns 0 when result is 0', () => {
  const points = calculateGLPoints({
    sex: 'women',
    equipment: 'classic',
    event: 'powerlifting',
    bodyweight: 60,
    result: 0,
  });
  assert.strictEqual(points, 0);
});

test('returns null for an unknown sex/equipment/event combination', () => {
  const points = calculateGLPoints({
    sex: 'men',
    equipment: 'raw',
    event: 'powerlifting',
    bodyweight: 80,
    result: 500,
  });
  assert.strictEqual(points, null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tools/ipf-gl-points/gl-points.test.js`
Expected: FAIL — `Cannot find module './gl-points.js'`.

- [ ] **Step 3: Implement `gl-points.js`**

Create `tools/ipf-gl-points/gl-points.js`:

```js
(function (global) {
  'use strict';

  var COEFFICIENTS = {
    'men-equipped-powerlifting': { A: 1236.25115, B: 1449.21864, C: 0.01644 },
    'men-classic-powerlifting': { A: 1199.72839, B: 1025.18162, C: 0.00921 },
    'men-equipped-bench': { A: 381.22073, B: 733.79378, C: 0.02398 },
    'men-classic-bench': { A: 320.98041, B: 281.40258, C: 0.01008 },
    'women-equipped-powerlifting': { A: 758.63878, B: 949.31382, C: 0.02435 },
    'women-classic-powerlifting': { A: 610.32796, B: 1045.59282, C: 0.03048 },
    'women-equipped-bench': { A: 221.82209, B: 357.00377, C: 0.02937 },
    'women-classic-bench': { A: 142.40398, B: 442.52671, C: 0.04724 },
  };

  var MIN_BODYWEIGHT = { men: 40, women: 35 };

  function round6(value) {
    return Math.round(value * 1e6) / 1e6;
  }

  function calculateGLPoints(input) {
    var key = input.sex + '-' + input.equipment + '-' + input.event;
    var coeffs = COEFFICIENTS[key];
    if (!coeffs) {
      return null;
    }

    var minBodyweight = MIN_BODYWEIGHT[input.sex];
    if (typeof input.bodyweight !== 'number' || input.bodyweight < minBodyweight) {
      return null;
    }

    if (input.result === 0) {
      return 0;
    }

    var coefficient = round6(100 / (coeffs.A - coeffs.B * Math.exp(-coeffs.C * input.bodyweight)));
    return round6(coefficient * input.result);
  }

  var api = { COEFFICIENTS: COEFFICIENTS, calculateGLPoints: calculateGLPoints };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.GLPoints = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tools/ipf-gl-points/gl-points.test.js`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add tools/ipf-gl-points/gl-points.js tools/ipf-gl-points/gl-points.test.js
git commit -m "Add IPF GL Points calculation logic with tests against official examples"
```

---

### Task 2: DOM rendering glue (`main.js`)

**Files:**
- Create: `tools/ipf-gl-points/main.js`

**Interfaces:**
- Consumes: `window.GLPoints.calculateGLPoints` (Task 1); a `<form id="gl-form">` with named fields `sex`, `equipment`, `event`, `bodyweight`, `result`; elements `#result` and `#hint` (all produced by Task 3's `index.html`).
- Produces: on any `input` event within the form, updates `#result` with the formatted GL Points score, or `#hint` with a validation message, or clears both if the form is incomplete.

- [ ] **Step 1: Write `main.js`**

Create `tools/ipf-gl-points/main.js`:

```js
(function () {
  'use strict';

  function getFormValues(form) {
    return {
      sex: form.sex.value,
      equipment: form.equipment.value,
      event: form.event.value,
      bodyweight: parseFloat(form.bodyweight.value),
      result: parseFloat(form.result.value),
    };
  }

  function isComplete(values) {
    return (
      values.sex !== '' &&
      values.equipment !== '' &&
      values.event !== '' &&
      !isNaN(values.bodyweight) &&
      !isNaN(values.result)
    );
  }

  function render(values, points) {
    var resultEl = document.getElementById('result');
    var hintEl = document.getElementById('hint');
    var minBodyweight = values.sex === 'men' ? 40 : 35;

    if (points === null) {
      resultEl.textContent = '';
      hintEl.textContent = '體重需 ≥ ' + minBodyweight + 'kg';
      return;
    }

    hintEl.textContent = '';
    resultEl.textContent = 'GL Points: ' + points.toFixed(2);
  }

  function update() {
    var form = document.getElementById('gl-form');
    var values = getFormValues(form);
    var resultEl = document.getElementById('result');
    var hintEl = document.getElementById('hint');

    if (!isComplete(values)) {
      resultEl.textContent = '';
      hintEl.textContent = '';
      return;
    }

    var points = window.GLPoints.calculateGLPoints(values);
    render(values, points);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('gl-form');
    form.addEventListener('input', update);
  });
})();
```

- [ ] **Step 2: Syntax-check the file**

Run: `node --check tools/ipf-gl-points/main.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add tools/ipf-gl-points/main.js
git commit -m "Add DOM rendering glue for IPF GL Points calculator form"
```

---

### Task 3: Page markup (`index.html`)

**Files:**
- Create: `tools/ipf-gl-points/index.html`

**Interfaces:**
- Produces: `<form id="gl-form">` with fields `sex`, `equipment`, `event`, `bodyweight`, `result`, and `#result`/`#hint` elements that Task 2's `main.js` reads/writes.
- Consumes: `../../assets/css/style.css` (existing site theme) and `tools/ipf-gl-points/style.css` (Task 4).

- [ ] **Step 1: Write `index.html`**

Create `tools/ipf-gl-points/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IPF GL Points 計算器 — Wade's Notes</title>
  <link rel="stylesheet" href="../../assets/css/style.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="site-header">
    <h1>IPF GL Points 計算器</h1>
    <p class="tagline"><a href="../../index.html">&larr; 回首頁</a></p>
  </header>

  <main class="tool-page">
    <form id="gl-form" class="gl-form">
      <label>
        性別
        <select name="sex" required>
          <option value="">請選擇</option>
          <option value="men">男 Men</option>
          <option value="women">女 Women</option>
        </select>
      </label>

      <label>
        裝備
        <select name="equipment" required>
          <option value="">請選擇</option>
          <option value="classic">Classic（無裝備）</option>
          <option value="equipped">Equipped（裝備）</option>
        </select>
      </label>

      <label>
        項目
        <select name="event" required>
          <option value="">請選擇</option>
          <option value="powerlifting">Powerlifting（三項總和）</option>
          <option value="bench">Bench Press</option>
        </select>
      </label>

      <label>
        體重（kg）
        <input type="number" name="bodyweight" step="0.01" min="0" required>
      </label>

      <label>
        成績（kg）
        <input type="number" name="result" step="0.5" min="0" required>
      </label>
    </form>

    <div class="gl-result">
      <p id="result"></p>
      <p id="hint" class="hint"></p>
    </div>
  </main>

  <script src="gl-points.js"></script>
  <script src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify required elements are present**

Run:
```bash
grep -c 'id="gl-form"' tools/ipf-gl-points/index.html
grep -c 'id="result"' tools/ipf-gl-points/index.html
grep -c 'id="hint"' tools/ipf-gl-points/index.html
grep -c 'gl-points.js' tools/ipf-gl-points/index.html
grep -c '"main.js"' tools/ipf-gl-points/index.html
grep -c '../../assets/css/style.css' tools/ipf-gl-points/index.html
```
Expected: each command prints `1`.

- [ ] **Step 3: Commit**

```bash
git add tools/ipf-gl-points/index.html
git commit -m "Add IPF GL Points calculator page markup"
```

---

### Task 4: Tool-specific styling (`style.css`)

**Files:**
- Create: `tools/ipf-gl-points/style.css`

**Interfaces:**
- Consumes: CSS custom properties defined in `assets/css/style.css` (`--bg`, `--fg`, `--card-bg`, `--accent`, `--border`) — must reuse them, not redefine them.
- Consumes: class/id names produced by Task 3's `index.html` — `.tool-page`, `.gl-form`, `.gl-result`, `#result`, `.hint`.

- [ ] **Step 1: Write `tools/ipf-gl-points/style.css`**

```css
.tool-page {
  max-width: 480px;
  margin: 0 auto;
  padding: 1.5rem;
}

.gl-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gl-form label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

.gl-form select,
.gl-form input {
  padding: 0.6rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--fg);
  font-size: 1rem;
}

.gl-result {
  max-width: 480px;
  margin: 1.5rem auto 0;
  padding: 0 1.5rem;
  text-align: center;
}

#result {
  font-size: 1.75rem;
  font-weight: bold;
  color: var(--accent);
  min-height: 2.5rem;
}

.hint {
  color: var(--fg);
  opacity: 0.7;
  font-size: 0.9rem;
}
```

- [ ] **Step 2: Verify no theme variables are redefined**

Run:
```bash
grep -c ':root' tools/ipf-gl-points/style.css || true
grep -c 'var(--' tools/ipf-gl-points/style.css
```
Expected: the first command prints `0` (no `:root` block — this file must not redefine theme variables); the second prints at least `1` (it does consume them).

- [ ] **Step 3: Commit**

```bash
git add tools/ipf-gl-points/style.css
git commit -m "Add IPF GL Points calculator page styling"
```

---

### Task 5: Register the tool on the landing page

**Files:**
- Modify: `assets/js/entries.js`

**Interfaces:**
- Modifies `window.SITE_ENTRIES` (defined in this file, consumed by the landing page's `assets/js/main.js` and `assets/js/render.js` — already implemented and unrelated to this plan). Adding a `category: 'tool'` entry makes it appear in the landing page's existing "工具" section; no landing-page code changes are needed.

- [ ] **Step 1: Add the entry**

The current content of `assets/js/entries.js` is:

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

Replace the `window.SITE_ENTRIES` block with:

```js
window.SITE_ENTRIES = [
  // 新增項目時在這裡加一筆物件：
  // { title: '...', description: '...', url: 'tools/<slug>/index.html', category: 'tool', date: 'YYYY-MM-DD' },
  {
    title: 'IPF GL Points 計算器',
    description: '輸入性別、裝備、體重與成績，計算 IPF 官方 GL Points 分數',
    url: 'tools/ipf-gl-points/index.html',
    category: 'tool',
    date: '2026-07-11',
  },
];
```

(`window.SITE_CATEGORIES` is unchanged.)

- [ ] **Step 2: Syntax-check the file**

Run: `node --check assets/js/entries.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Regression-check the landing page's own tests still pass**

Run: `node --test assets/js/render.test.js`
Expected: PASS — all 4 tests green (this task doesn't touch `render.js`, but confirms the edit didn't break anything it depends on).

- [ ] **Step 4: Commit**

```bash
git add assets/js/entries.js
git commit -m "Register IPF GL Points calculator on the landing page"
```

---

### Task 6: End-to-end verification

**Files:** None (verification only — exercises Tasks 1–5 together).

- [ ] **Step 1: Run both unit test suites as a regression check**

Run:
```bash
node --test tools/ipf-gl-points/gl-points.test.js
node --test assets/js/render.test.js
```
Expected: both PASS (5/5 and 4/4 respectively).

- [ ] **Step 2: Start a local static server in the background**

Run:
```bash
python3 -m http.server 8000 >/tmp/http-server.log 2>&1 &
echo $! > /tmp/http-server.pid
sleep 1
```

- [ ] **Step 3: Verify the tool page and its assets are served**

Run:
```bash
curl -s http://localhost:8000/tools/ipf-gl-points/index.html | grep "IPF GL Points"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/tools/ipf-gl-points/gl-points.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/tools/ipf-gl-points/main.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/tools/ipf-gl-points/style.css
curl -s http://localhost:8000/index.html | grep "IPF GL Points"
```
Expected: first command prints a line containing `IPF GL Points`; each `curl -w` command prints `200`; the last command (checking the landing page picked up the new entry's title text) also prints a line containing `IPF GL Points` — note this only confirms the string is embedded in `entries.js`, which `index.html` loads as a `<script>`, not that it renders; visual confirmation is Step 5.

- [ ] **Step 4: Stop the local server**

Run:
```bash
kill "$(cat /tmp/http-server.pid)"
rm /tmp/http-server.pid /tmp/http-server.log
```

- [ ] **Step 5: Manual browser check (human, not automated)**

Start the server again (`python3 -m http.server 8000`) and open `http://localhost:8000/tools/ipf-gl-points/index.html` in a browser. Confirm:
- Selecting 男 Men / Equipped / Powerlifting, entering bodyweight `92.04` and result `1035`, shows `GL Points: 112.86`.
- Selecting 女 Women / Classic / Bench Press, entering bodyweight `70.5` and result `122.5`, shows `GL Points: 96.78`.
- Selecting 男 Men with bodyweight `39` shows the "體重需 ≥ 40kg" hint instead of a score.
- The page's colors match the landing page's dark/light theme (toggle OS theme to confirm).
- Clicking "← 回首頁" navigates to the landing page.
- On `http://localhost:8000/index.html`, the "工具" section now shows an "IPF GL Points 計算器" card, and clicking it opens the calculator.

Stop the server afterward (`kill %1` or find and kill the `http.server` process).

- [ ] **Step 6: Confirm final repo state**

Run: `git status`
Expected: clean working tree (`nothing to commit, working tree clean`), all prior tasks' commits present in `git log`.
