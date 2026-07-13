# GL Live Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a meet-day tool at `tools/gl-live-tracker/index.html` where Wade and a helper, on separate devices, can live-input bodyweight/squat/bench/deadlift for Wade and at least 5 opponents, see a real-time GL Points leaderboard, and see how much weight Wade needs on his next attempt to catch the closest opponent above him.

**Architecture:** Pure calculation logic (`meet.js`) is a dual Node/browser module, unit-tested with golden/round-trip tests — same pattern as the existing `tools/ipf-gl-points/gl-points.js`, which this plan reuses via `<script>` tag rather than duplicating its coefficient table. Multi-device real-time sync uses Firebase Realtime Database (free tier) with anonymous auth and an unguessable per-meet room ID; `sync.js` wraps the Firebase modular SDK. `opponents-table.js` manages the dynamic opponent rows' DOM, reconciling incoming realtime data without clobbering whatever the local user is actively typing. `main.js` (an ES module, since it uses `import` for Firebase-backed `sync.js`) orchestrates: meet creation/joining, wiring form inputs to Firebase writes, and rendering the leaderboard from `meet.js`'s pure functions.

**Tech Stack:** Vanilla HTML, CSS (reusing the site's CSS custom properties), vanilla JS (`meet.js` and `opponents-table.js` are classic scripts, ES5-style, dual Node/browser export; `sync.js` and `main.js` are ES modules using `import`/`export`, required for the Firebase SDK). Firebase JS SDK v12.16.0 loaded from the `gstatic.com` CDN — no npm, no bundler. Node's built-in `node:test` runner for unit-testing `meet.js` (no npm packages).

## Global Constraints

- `meet.js` has zero dependencies and no DOM access — pure functions only, dual-exported (`module.exports` for Node, `window.MeetTracker` for browser), matching the pattern in `tools/ipf-gl-points/gl-points.js`.
- **Explicit exception to the site's "zero dependencies" rule**: this tool loads the Firebase JS SDK from `https://www.gstatic.com/firebasejs/12.16.0/firebase-{app,auth,database}.js` via ES module `import`. This is a deliberate, spec-approved exception (multi-device real-time sync requires a real backend) — do not flag it as a violation. There is still no build step and no npm.
- The new tool reuses `tools/ipf-gl-points/gl-points.js`'s `window.GLPoints.calculateGLPoints` via `<script src="../ipf-gl-points/gl-points.js">` — the coefficient table must not be duplicated anywhere in this plan's files.
- Firebase config values (`tools/gl-live-tracker/firebase-config.js`) are not secret and are committed directly — this matches Firebase's own security model (protection comes from Security Rules, not from hiding the config).
- Security: reads/writes to `/meets/**` require `auth != null` (anonymous auth is sufficient); access control otherwise relies on the per-meet room ID being an unguessable random string, not a login system.
- Any DOM update driven by a realtime Firebase snapshot must skip overwriting an `<input>`/`<select>` that currently has focus (`document.activeElement === input`) — otherwise the local user's own typing gets clobbered by the echo of their own writes (or a remote update) arriving mid-keystroke. This applies uniformly to the "我的成績" fields and every opponent row field.
- Event type passed to `calculateGLPoints` is always `'powerlifting'` (three-lift total) — this tool has no bench-only mode.
- UI copy is Traditional Chinese.

---

### Task 1: Pure meet logic (`meet.js`) — TDD

**Files:**
- Create: `tools/gl-live-tracker/meet.js`
- Test: `tools/gl-live-tracker/meet.test.js`

**Interfaces:**
- Produces:
  - `computeTotal(lifts)` — `lifts: { squat?, bench?, deadlift? }` → number (missing lifts treated as 0).
  - `computePoints(calculateGLPoints, person)` — `person: { sex, equipment, bodyweight, squat, bench, deadlift }` → number, or `null` if `bodyweight` is falsy. Calls `calculateGLPoints({ sex, equipment, event: 'powerlifting', bodyweight, result: computeTotal(person) })`.
  - `rankCompetitors(people)` — `people: Array<{ id, points, ... }>` → array of the entries with a numeric `points`, sorted descending by `points`, each with a `rank` (1-based) added. Entries with non-numeric `points` (e.g. `null`) are dropped.
  - `findClosestAbove(myPoints, others)` — `others: Array<{ id, points, ... }>` → the entry with the smallest `points` that is still `> myPoints`, or `null` if none (i.e. already leading).
  - `requiredWeightForNextLift(calculateGLPoints, input)` — `input: { sex, equipment, bodyweight, squat, bench, deadlift, nextLift, targetPoints }` → the kg needed on `input[nextLift]` so the total reaches `targetPoints`, rounded to 2 decimals; returns `0` if already at or above the target. Computes the coefficient via `calculateGLPoints({ sex, equipment, event: 'powerlifting', bodyweight, result: 1 })` (an existing, already-reviewed code path — `result: 1` returns the rounded coefficient itself), so `gl-points.js` needs no changes.
  - Exposed as `module.exports` (Node) and `window.MeetTracker` (browser), matching `tools/ipf-gl-points/gl-points.js`'s pattern.
- Consumed by: Task 5 (`main.js`).
- Test file consumes the real `tools/ipf-gl-points/gl-points.js` via `require('../ipf-gl-points/gl-points.js')` (already implemented and tested; do not mock it).

- [ ] **Step 1: Write the failing tests**

Create `tools/gl-live-tracker/meet.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateGLPoints } = require('../ipf-gl-points/gl-points.js');
const {
  computeTotal,
  computePoints,
  rankCompetitors,
  findClosestAbove,
  requiredWeightForNextLift,
} = require('./meet.js');

test('computeTotal sums squat, bench, deadlift', () => {
  assert.strictEqual(computeTotal({ squat: 200, bench: 150, deadlift: 250 }), 600);
});

test('computeTotal treats missing lifts as 0', () => {
  assert.strictEqual(computeTotal({ squat: 200 }), 200);
});

test('computePoints returns null when bodyweight is missing', () => {
  const points = computePoints(calculateGLPoints, {
    sex: 'men',
    equipment: 'classic',
    squat: 200,
    bench: 150,
    deadlift: 250,
  });
  assert.strictEqual(points, null);
});

test('computePoints matches calculateGLPoints directly', () => {
  const points = computePoints(calculateGLPoints, {
    sex: 'men',
    equipment: 'classic',
    bodyweight: 90,
    squat: 200,
    bench: 150,
    deadlift: 250,
  });
  const expected = calculateGLPoints({
    sex: 'men',
    equipment: 'classic',
    event: 'powerlifting',
    bodyweight: 90,
    result: 600,
  });
  assert.strictEqual(points, expected);
});

test('rankCompetitors sorts by points descending and assigns rank', () => {
  const ranked = rankCompetitors([
    { id: 'a', points: 100 },
    { id: 'b', points: 150 },
    { id: 'c', points: 120 },
  ]);
  assert.deepStrictEqual(ranked.map((p) => p.id), ['b', 'c', 'a']);
  assert.deepStrictEqual(ranked.map((p) => p.rank), [1, 2, 3]);
});

test('rankCompetitors excludes entries without numeric points', () => {
  const ranked = rankCompetitors([
    { id: 'a', points: 100 },
    { id: 'b', points: null },
  ]);
  assert.deepStrictEqual(ranked.map((p) => p.id), ['a']);
});

test('findClosestAbove returns the smallest-gap competitor ahead of me', () => {
  const closest = findClosestAbove(100, [
    { id: 'a', points: 150 },
    { id: 'b', points: 110 },
    { id: 'c', points: 90 },
  ]);
  assert.strictEqual(closest.id, 'b');
});

test('findClosestAbove returns null when already leading', () => {
  const closest = findClosestAbove(200, [
    { id: 'a', points: 150 },
    { id: 'b', points: 110 },
  ]);
  assert.strictEqual(closest, null);
});

test('requiredWeightForNextLift round-trips to the total that produced the target points', () => {
  const bodyweight = 90;
  const sex = 'men';
  const equipment = 'classic';
  const squat = 200;
  const bench = 150;
  const targetTotal = 600;

  const targetPoints = calculateGLPoints({
    sex,
    equipment,
    event: 'powerlifting',
    bodyweight,
    result: targetTotal,
  });

  const requiredWeight = requiredWeightForNextLift(calculateGLPoints, {
    sex,
    equipment,
    bodyweight,
    squat,
    bench,
    deadlift: 0,
    nextLift: 'deadlift',
    targetPoints,
  });

  assert.ok(Math.abs(requiredWeight - (targetTotal - squat - bench)) < 0.01);
});

test('requiredWeightForNextLift returns 0 when already ahead of the target', () => {
  const requiredWeight = requiredWeightForNextLift(calculateGLPoints, {
    sex: 'men',
    equipment: 'classic',
    bodyweight: 90,
    squat: 200,
    bench: 150,
    deadlift: 300,
    nextLift: 'deadlift',
    targetPoints: 1,
  });
  assert.strictEqual(requiredWeight, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tools/gl-live-tracker/meet.test.js`
Expected: FAIL — `Cannot find module './meet.js'`.

- [ ] **Step 3: Implement `meet.js`**

Create `tools/gl-live-tracker/meet.js`:

```js
(function (global) {
  'use strict';

  function computeTotal(lifts) {
    return (lifts.squat || 0) + (lifts.bench || 0) + (lifts.deadlift || 0);
  }

  function computePoints(calculateGLPoints, person) {
    if (!person.bodyweight) {
      return null;
    }
    return calculateGLPoints({
      sex: person.sex,
      equipment: person.equipment,
      event: 'powerlifting',
      bodyweight: person.bodyweight,
      result: computeTotal(person),
    });
  }

  function rankCompetitors(people) {
    return people
      .filter(function (p) {
        return typeof p.points === 'number';
      })
      .slice()
      .sort(function (a, b) {
        return b.points - a.points;
      })
      .map(function (p, index) {
        var withRank = {};
        Object.keys(p).forEach(function (key) {
          withRank[key] = p[key];
        });
        withRank.rank = index + 1;
        return withRank;
      });
  }

  function findClosestAbove(myPoints, others) {
    var above = others.filter(function (o) {
      return typeof o.points === 'number' && o.points > myPoints;
    });
    if (above.length === 0) {
      return null;
    }
    return above.reduce(function (closest, o) {
      return o.points < closest.points ? o : closest;
    });
  }

  function requiredWeightForNextLift(calculateGLPoints, input) {
    var coefficient = calculateGLPoints({
      sex: input.sex,
      equipment: input.equipment,
      event: 'powerlifting',
      bodyweight: input.bodyweight,
      result: 1,
    });

    if (typeof coefficient !== 'number' || coefficient === 0) {
      return 0;
    }

    var requiredTotal = input.targetPoints / coefficient;
    var otherTwoSum = computeTotal(input) - (input[input.nextLift] || 0);
    var requiredWeight = requiredTotal - otherTwoSum;

    if (requiredWeight <= 0) {
      return 0;
    }
    return Math.round(requiredWeight * 100) / 100;
  }

  var api = {
    computeTotal: computeTotal,
    computePoints: computePoints,
    rankCompetitors: rankCompetitors,
    findClosestAbove: findClosestAbove,
    requiredWeightForNextLift: requiredWeightForNextLift,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.MeetTracker = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tools/gl-live-tracker/meet.test.js`
Expected: PASS — all 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add tools/gl-live-tracker/meet.js tools/gl-live-tracker/meet.test.js
git commit -m "Add pure meet-comparison logic for GL Live Tracker with tests"
```

---

### Task 2: Firebase configuration and security rules

**Files:**
- Create: `tools/gl-live-tracker/firebase-config.js`
- Create: `tools/gl-live-tracker/firebase-rules.json`

**Interfaces:**
- Produces: `export const firebaseConfig = {...}` — consumed by Task 3 (`sync.js`) via `import { firebaseConfig } from './firebase-config.js'`.
- `firebase-rules.json` is documentation/reference only (committed for reproducibility) — it is not auto-deployed; Wade pastes it into the Firebase Console manually (see Step 3).

- [ ] **Step 1: Write `firebase-config.js`**

Create `tools/gl-live-tracker/firebase-config.js`:

```js
export const firebaseConfig = {
  apiKey: "AIzaSyBAI0AiZvdLEXVKuYfkC8QesUdqYFRwdNE",
  authDomain: "gl-points-in-game.firebaseapp.com",
  databaseURL: "https://gl-points-in-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gl-points-in-game",
  storageBucket: "gl-points-in-game.firebasestorage.app",
  messagingSenderId: "582834631732",
  appId: "1:582834631732:web:3b3fa7db0c517d2ff64661",
  measurementId: "G-7M3B6TC44G"
};
```

- [ ] **Step 2: Write `firebase-rules.json`**

Create `tools/gl-live-tracker/firebase-rules.json`:

```json
{
  "rules": {
    "meets": {
      "$meetId": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    ".read": false,
    ".write": false
  }
}
```

- [ ] **Step 3: Verify JSON syntax and leave a note for Wade**

Run: `node -e "JSON.parse(require('fs').readFileSync('tools/gl-live-tracker/firebase-rules.json', 'utf8')); console.log('valid json')"`
Expected: prints `valid json`.

This step does not deploy the rules — deploying requires the Firebase Console (project access only Wade has). After this task is implemented, tell Wade: "Open the Firebase Console → your project (`gl-points-in-game`) → Realtime Database → Rules tab → replace the contents with `tools/gl-live-tracker/firebase-rules.json` → Publish." This must be done before the live sync features work end-to-end (the database currently defaults to test-mode rules from setup).

- [ ] **Step 4: Commit**

```bash
git add tools/gl-live-tracker/firebase-config.js tools/gl-live-tracker/firebase-rules.json
git commit -m "Add Firebase config and security rules for GL Live Tracker"
```

---

### Task 3: Firebase realtime sync glue (`sync.js`)

**Files:**
- Create: `tools/gl-live-tracker/sync.js`

**Interfaces:**
- Produces (ES module exports, consumed by Task 5's `main.js` via `import`):
  - `createOpponentId()` → random string ID.
  - `joinOrCreateMeet(meetId)` → `Promise<string>`. If `meetId` is falsy, generates a new random ID, initializes `/meets/{id}` with default `settings`/`me`, and resolves with the new ID. If `meetId` is provided, resolves with it unchanged (assumes the meet already exists). Ensures anonymous auth completes first in both cases.
  - `subscribeMeet(meetId, callback)` — subscribes to `/meets/{meetId}` with `onValue`; calls `callback(data)` (an empty object if the node doesn't exist yet) on every change, including immediately with the current value.
  - `updateSettings(meetId, settings)`, `updateMe(meetId, me)` — partial updates (Firebase `update()`, not `set()`, so unspecified fields are preserved) to `/meets/{meetId}/settings` and `/meets/{meetId}/me`.
  - `upsertOpponent(meetId, opponentId, opponent)` — full `set()` of `/meets/{meetId}/opponents/{opponentId}`.
  - `removeOpponent(meetId, opponentId)` — `remove()` of that path.
- Consumes: `tools/gl-live-tracker/firebase-config.js` (Task 2).

- [ ] **Step 1: Write `sync.js`**

Create `tools/gl-live-tracker/sync.js`:

```js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getDatabase, ref, set, update, remove, onValue } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

var app = initializeApp(firebaseConfig);
var auth = getAuth(app);
var db = getDatabase(app);

function ensureAuth() {
  return new Promise(function (resolve, reject) {
    onAuthStateChanged(auth, function (user) {
      if (user) {
        resolve(user);
      }
    });
    signInAnonymously(auth).catch(reject);
  });
}

function meetRef(meetId) {
  return ref(db, 'meets/' + meetId);
}

export function createOpponentId() {
  return Math.random().toString(36).slice(2, 10);
}

export function joinOrCreateMeet(meetId) {
  return ensureAuth().then(function () {
    if (meetId) {
      return meetId;
    }
    var id = Math.random().toString(36).slice(2, 10);
    return set(meetRef(id), {
      settings: { sex: 'men', equipment: 'classic' },
      me: { bodyweight: 0, squat: 0, bench: 0, deadlift: 0, nextLift: 'squat' },
    }).then(function () {
      return id;
    });
  });
}

export function subscribeMeet(meetId, callback) {
  onValue(meetRef(meetId), function (snapshot) {
    callback(snapshot.val() || {});
  });
}

export function updateSettings(meetId, settings) {
  return update(ref(db, 'meets/' + meetId + '/settings'), settings);
}

export function updateMe(meetId, me) {
  return update(ref(db, 'meets/' + meetId + '/me'), me);
}

export function upsertOpponent(meetId, opponentId, opponent) {
  return set(ref(db, 'meets/' + meetId + '/opponents/' + opponentId), opponent);
}

export function removeOpponent(meetId, opponentId) {
  return remove(ref(db, 'meets/' + meetId + '/opponents/' + opponentId));
}
```

- [ ] **Step 2: Sanity-check the file**

This file uses `import`/`export` syntax, which `node --check` cannot parse as a plain `.js` file (it would report a false-positive syntax error since Node defaults to CommonJS) — do not run `node --check` on this file. Instead, visually confirm every `export function` name matches the Interfaces list above, and that the Firebase SDK version (`12.16.0`) is identical across all three `gstatic.com` import URLs.

Run:
```bash
grep -c '12.16.0' tools/gl-live-tracker/sync.js
grep -c '^export function' tools/gl-live-tracker/sync.js
```
Expected: first command prints `3` (one per SDK import URL); second prints `7` (the seven exported functions: `createOpponentId`, `joinOrCreateMeet`, `subscribeMeet`, `updateSettings`, `updateMe`, `upsertOpponent`, `removeOpponent`).

- [ ] **Step 3: Commit**

```bash
git add tools/gl-live-tracker/sync.js
git commit -m "Add Firebase realtime sync glue for GL Live Tracker"
```

---

### Task 4: Opponent table DOM management (`opponents-table.js`)

**Files:**
- Create: `tools/gl-live-tracker/opponents-table.js`

**Interfaces:**
- Produces: `reconcileRows(tbody, opponentsObj, handlers)` — `opponentsObj: { [id]: { name, bodyweight, squat, bench, deadlift } }`, `handlers: { createId(), onChange(id, values), onRemove(id) }`. Reconciles the `<tbody>`'s rows against `opponentsObj` (adds rows for new ids, updates values for existing ids, removes rows only for ids that were previously confirmed from Firebase — tracked via `dataset.saved === 'true'` — and have now disappeared), then tops up to a minimum of 5 total rows with blank unsaved rows if below that count. **Never overwrites an `<input>` that currently has focus** (`document.activeElement === input`), so a remote update (or the echo of the local user's own write) never clobbers what's mid-typing.
  - Exposed as `module.exports` (Node, though this file has no automated test — see Task 9) and `window.OpponentsTable` (browser).
- Consumed by: Task 5 (`main.js`), which calls `window.OpponentsTable.reconcileRows(...)` on every realtime update.

**Why the `dataset.saved` tracking matters:** on a brand-new meet, `reconcileRows` adds 5 blank local rows (ids not yet in Firebase). The *next* realtime update (Firebase echoes back the current — still empty — `opponents` object almost immediately after subscribing) must NOT delete those blank rows just because their ids aren't in the incoming data yet. Only rows that were *previously confirmed* as real Firebase entries (`dataset.saved === 'true'`) are removed when their id disappears from incoming data (a genuine remote deletion, e.g. the helper clicked "刪除" on another device).

- [ ] **Step 1: Write `opponents-table.js`**

Create `tools/gl-live-tracker/opponents-table.js`:

```js
(function (global) {
  'use strict';

  var MIN_ROWS = 5;

  function reconcileRows(tbody, opponentsObj, handlers) {
    var incomingIds = Object.keys(opponentsObj);
    var existingRows = {};

    Array.prototype.forEach.call(tbody.children, function (tr) {
      existingRows[tr.dataset.id] = tr;
    });

    Object.keys(existingRows).forEach(function (id) {
      var tr = existingRows[id];
      if (tr.dataset.saved === 'true' && incomingIds.indexOf(id) === -1) {
        tr.remove();
        delete existingRows[id];
      }
    });

    incomingIds.forEach(function (id) {
      if (existingRows[id]) {
        updateRowValues(existingRows[id], opponentsObj[id]);
        existingRows[id].dataset.saved = 'true';
      } else {
        var tr = addRow(tbody, id, opponentsObj[id], handlers);
        tr.dataset.saved = 'true';
      }
    });

    while (tbody.children.length < MIN_ROWS) {
      addRow(tbody, handlers.createId(), {}, handlers);
    }
  }

  function addRow(tbody, id, opponent, handlers) {
    var tr = document.createElement('tr');
    tr.dataset.id = id;
    tr.dataset.saved = 'false';

    tr.appendChild(createCell('text', 'opp-name', opponent.name || '', '姓名', null));
    tr.appendChild(createCell('number', 'opp-bodyweight', opponent.bodyweight || '', '', '0.01'));
    tr.appendChild(createCell('number', 'opp-squat', opponent.squat || '', '', '0.5'));
    tr.appendChild(createCell('number', 'opp-bench', opponent.bench || '', '', '0.5'));
    tr.appendChild(createCell('number', 'opp-deadlift', opponent.deadlift || '', '', '0.5'));

    var removeTd = document.createElement('td');
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'opp-remove';
    removeBtn.textContent = '刪除';
    removeBtn.addEventListener('click', function () {
      tr.remove();
      handlers.onRemove(id);
    });
    removeTd.appendChild(removeBtn);
    tr.appendChild(removeTd);

    tr.addEventListener('input', function () {
      handlers.onChange(id, readRow(tr));
    });

    tbody.appendChild(tr);
    return tr;
  }

  function createCell(type, className, value, placeholder, step) {
    var td = document.createElement('td');
    var input = document.createElement('input');
    input.type = type;
    input.className = className;
    input.value = value;
    if (placeholder) {
      input.placeholder = placeholder;
    }
    if (step) {
      input.step = step;
    }
    td.appendChild(input);
    return td;
  }

  function updateRowValues(tr, opponent) {
    setIfNotFocused(tr.querySelector('.opp-name'), opponent.name || '');
    setIfNotFocused(tr.querySelector('.opp-bodyweight'), opponent.bodyweight || '');
    setIfNotFocused(tr.querySelector('.opp-squat'), opponent.squat || '');
    setIfNotFocused(tr.querySelector('.opp-bench'), opponent.bench || '');
    setIfNotFocused(tr.querySelector('.opp-deadlift'), opponent.deadlift || '');
  }

  function setIfNotFocused(input, value) {
    if (document.activeElement !== input) {
      input.value = value;
    }
  }

  function readRow(tr) {
    return {
      name: tr.querySelector('.opp-name').value,
      bodyweight: parseFloat(tr.querySelector('.opp-bodyweight').value) || 0,
      squat: parseFloat(tr.querySelector('.opp-squat').value) || 0,
      bench: parseFloat(tr.querySelector('.opp-bench').value) || 0,
      deadlift: parseFloat(tr.querySelector('.opp-deadlift').value) || 0,
    };
  }

  var api = { reconcileRows: reconcileRows };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.OpponentsTable = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 2: Syntax-check the file**

Run: `node --check tools/gl-live-tracker/opponents-table.js`
Expected: no output (exit code 0) — this file is a classic script (no `import`/`export`), so `node --check` works on it.

- [ ] **Step 3: Commit**

```bash
git add tools/gl-live-tracker/opponents-table.js
git commit -m "Add opponent table DOM reconciliation for GL Live Tracker"
```

---

### Task 5: Orchestration and rendering (`main.js`)

**Files:**
- Create: `tools/gl-live-tracker/main.js`

**Interfaces:**
- Consumes:
  - `import { joinOrCreateMeet, subscribeMeet, updateSettings, updateMe, upsertOpponent, removeOpponent, createOpponentId } from './sync.js'` (Task 3).
  - `window.GLPoints.calculateGLPoints` (from `tools/ipf-gl-points/gl-points.js`, loaded via `<script>` before this module runs).
  - `window.MeetTracker.{computePoints,rankCompetitors,findClosestAbove,requiredWeightForNextLift}` (Task 1, loaded via `<script>`).
  - `window.OpponentsTable.reconcileRows` (Task 4, loaded via `<script>`).
  - DOM elements from Task 6's `index.html`: `#setup`, `#create-meet`, `#tracker`, `#settings-sex`, `#settings-equipment`, `#me-bodyweight`, `#me-squat`, `#me-bench`, `#me-deadlift`, `#me-next-lift`, `#opponents-body`, `#leaderboard-list`, `#gap-message`.
- Produces: on load, if the URL has `?meet=ID`, joins that meet and starts rendering; otherwise shows the "建立新場次" button, which creates a new meet, updates the URL, and starts rendering. Wires the "我的成績" and settings inputs to write to Firebase on change. Renders the leaderboard and gap/required-weight message on every realtime update.

**Why `type="module"`:** this file uses `import` for `sync.js` (which itself imports the Firebase SDK), so it must load as an ES module. Module scripts execute after the document is parsed and after any classic `<script>` tags before them have already run — so `window.GLPoints`, `window.MeetTracker`, and `window.OpponentsTable` (set by classic scripts loaded earlier in `index.html`) are guaranteed to exist by the time this file's top-level code runs. Task 6 must load `gl-points.js`, `meet.js`, and `opponents-table.js` as plain classic scripts *before* this file, and load this file last with `type="module"`.

- [ ] **Step 1: Write `main.js`**

Create `tools/gl-live-tracker/main.js`:

```js
import {
  joinOrCreateMeet,
  subscribeMeet,
  updateSettings,
  updateMe,
  upsertOpponent,
  removeOpponent,
  createOpponentId,
} from './sync.js';

var currentMeetId = null;

function getMeetIdFromUrl() {
  var params = new URLSearchParams(window.location.search);
  return params.get('meet');
}

function setMeetIdInUrl(meetId) {
  var url = new URL(window.location.href);
  url.searchParams.set('meet', meetId);
  window.history.replaceState({}, '', url);
}

function setFieldIfNotFocused(input, value) {
  if (document.activeElement !== input) {
    input.value = value === undefined || value === null ? '' : value;
  }
}

function renderSettings(settings) {
  setFieldIfNotFocused(document.getElementById('settings-sex'), settings.sex || 'men');
  setFieldIfNotFocused(document.getElementById('settings-equipment'), settings.equipment || 'classic');
}

function renderMe(me) {
  setFieldIfNotFocused(document.getElementById('me-bodyweight'), me.bodyweight || '');
  setFieldIfNotFocused(document.getElementById('me-squat'), me.squat || '');
  setFieldIfNotFocused(document.getElementById('me-bench'), me.bench || '');
  setFieldIfNotFocused(document.getElementById('me-deadlift'), me.deadlift || '');
  setFieldIfNotFocused(document.getElementById('me-next-lift'), me.nextLift || 'squat');
}

function renderLeaderboard(data) {
  var settings = data.settings || { sex: 'men', equipment: 'classic' };
  var me = data.me || {};
  var opponentsObj = data.opponents || {};

  var calculateGLPoints = window.GLPoints.calculateGLPoints;
  var MeetTracker = window.MeetTracker;

  var mePerson = {
    id: 'me',
    name: '我',
    sex: settings.sex,
    equipment: settings.equipment,
    bodyweight: me.bodyweight,
    squat: me.squat,
    bench: me.bench,
    deadlift: me.deadlift,
  };
  mePerson.points = me.bodyweight ? MeetTracker.computePoints(calculateGLPoints, mePerson) : null;

  var opponents = Object.keys(opponentsObj).map(function (id) {
    var o = opponentsObj[id];
    var person = {
      id: id,
      name: o.name || '對手',
      sex: settings.sex,
      equipment: settings.equipment,
      bodyweight: o.bodyweight,
      squat: o.squat,
      bench: o.bench,
      deadlift: o.deadlift,
    };
    person.points = o.bodyweight ? MeetTracker.computePoints(calculateGLPoints, person) : null;
    return person;
  });

  var ranked = MeetTracker.rankCompetitors(opponents.concat([mePerson]));

  var listEl = document.getElementById('leaderboard-list');
  listEl.innerHTML = '';
  ranked.forEach(function (p) {
    var li = document.createElement('li');
    li.className = 'leaderboard-row' + (p.id === 'me' ? ' leaderboard-row--me' : '');
    li.textContent = p.rank + '. ' + p.name + ' — ' + p.points.toFixed(2) + ' GL';
    listEl.appendChild(li);
  });

  var gapEl = document.getElementById('gap-message');
  if (typeof mePerson.points !== 'number') {
    gapEl.textContent = '請先填寫我的體重與成績';
    return;
  }

  var closest = MeetTracker.findClosestAbove(mePerson.points, opponents);
  if (!closest) {
    var second = ranked[1];
    gapEl.textContent = second
      ? '目前領先，安全分差 ' + (mePerson.points - second.points).toFixed(2) + ' GL Points'
      : '目前領先';
    return;
  }

  var gap = closest.points - mePerson.points;
  var requiredWeight = MeetTracker.requiredWeightForNextLift(calculateGLPoints, {
    sex: settings.sex,
    equipment: settings.equipment,
    bodyweight: me.bodyweight,
    squat: me.squat,
    bench: me.bench,
    deadlift: me.deadlift,
    nextLift: me.nextLift || 'squat',
    targetPoints: closest.points,
  });

  var nextLiftLabel = { squat: 'Squat', bench: 'Bench', deadlift: 'Deadlift' }[me.nextLift || 'squat'];

  gapEl.textContent =
    '距離 ' + closest.name + ' 還差 ' + gap.toFixed(2) + ' GL Points，下一項（' +
    nextLiftLabel + '）需要達到 ' + requiredWeight.toFixed(2) + ' kg 才能追平/超前';
}

function renderAll(data) {
  renderSettings(data.settings || {});
  renderMe(data.me || {});
  window.OpponentsTable.reconcileRows(document.getElementById('opponents-body'), data.opponents || {}, {
    createId: createOpponentId,
    onChange: function (id, values) {
      upsertOpponent(currentMeetId, id, values);
    },
    onRemove: function (id) {
      removeOpponent(currentMeetId, id);
    },
  });
  renderLeaderboard(data);
}

function wireMeInputs() {
  ['bodyweight', 'squat', 'bench', 'deadlift'].forEach(function (field) {
    document.getElementById('me-' + field).addEventListener('input', function (e) {
      var patch = {};
      patch[field] = parseFloat(e.target.value) || 0;
      updateMe(currentMeetId, patch);
    });
  });

  document.getElementById('me-next-lift').addEventListener('change', function (e) {
    updateMe(currentMeetId, { nextLift: e.target.value });
  });
}

function wireSettingsInputs() {
  document.getElementById('settings-sex').addEventListener('change', function (e) {
    updateSettings(currentMeetId, { sex: e.target.value });
  });
  document.getElementById('settings-equipment').addEventListener('change', function (e) {
    updateSettings(currentMeetId, { equipment: e.target.value });
  });
}

function startMeet(meetId) {
  currentMeetId = meetId;
  setMeetIdInUrl(meetId);
  document.getElementById('setup').hidden = true;
  document.getElementById('tracker').hidden = false;
  wireSettingsInputs();
  wireMeInputs();
  subscribeMeet(meetId, renderAll);
}

document.addEventListener('DOMContentLoaded', function () {
  var existingMeetId = getMeetIdFromUrl();

  if (existingMeetId) {
    joinOrCreateMeet(existingMeetId).then(startMeet);
    return;
  }

  document.getElementById('create-meet').addEventListener('click', function () {
    joinOrCreateMeet(null).then(startMeet);
  });
});
```

- [ ] **Step 2: Sanity-check the file**

Like `sync.js`, this file uses `import`, so `node --check` will falsely report a syntax error — do not run it. Instead confirm the imported names match `sync.js`'s exports and every `getElementById` target matches an id Task 6 will create.

Run:
```bash
grep -o "getElementById('[a-z-]*')" tools/gl-live-tracker/main.js | sort -u
```
Expected: prints exactly these 13 ids (order may vary): `create-meet`, `gap-message`, `leaderboard-list`, `me-bench`, `me-bodyweight`, `me-deadlift`, `me-next-lift`, `me-squat`, `opponents-body`, `settings-equipment`, `settings-sex`, `setup`, `tracker`. Keep this list; Task 6 must create every one of these ids.

- [ ] **Step 3: Commit**

```bash
git add tools/gl-live-tracker/main.js
git commit -m "Add orchestration and rendering logic for GL Live Tracker"
```

---

### Task 6: Page markup (`index.html`)

**Files:**
- Create: `tools/gl-live-tracker/index.html`

**Interfaces:**
- Produces every DOM id Task 5's `main.js` reads (see the list printed in Task 5 Step 2), plus loads scripts in the required order: `../ipf-gl-points/gl-points.js`, `meet.js`, `opponents-table.js` (classic scripts, in that order, so their globals exist before the module script runs), then `main.js` with `type="module"`.
- Consumes: `../../assets/css/style.css` (existing site theme) and `tools/gl-live-tracker/style.css` (Task 7).

- [ ] **Step 1: Write `index.html`**

Create `tools/gl-live-tracker/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GL Live Tracker — Wade's Notes</title>
  <link rel="stylesheet" href="../../assets/css/style.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="site-header">
    <h1>GL Live Tracker</h1>
    <p class="tagline"><a href="../../index.html">&larr; 回首頁</a></p>
  </header>

  <main class="tracker-page">
    <section id="setup">
      <p>建立新場次後，把網址分享給幫忙輸入對手成績的人即可即時同步。</p>
      <button type="button" id="create-meet">建立新場次</button>
    </section>

    <section id="tracker" hidden>
      <section class="settings-panel">
        <label>
          性別
          <select id="settings-sex">
            <option value="men">男 Men</option>
            <option value="women">女 Women</option>
          </select>
        </label>
        <label>
          裝備
          <select id="settings-equipment">
            <option value="classic">Classic</option>
            <option value="equipped">Equipped</option>
          </select>
        </label>
      </section>

      <section class="me-panel">
        <h2>我的成績</h2>
        <label>體重 (kg) <input type="number" id="me-bodyweight" step="0.01" min="0"></label>
        <label>Squat (kg) <input type="number" id="me-squat" step="0.5" min="0"></label>
        <label>Bench (kg) <input type="number" id="me-bench" step="0.5" min="0"></label>
        <label>Deadlift (kg) <input type="number" id="me-deadlift" step="0.5" min="0"></label>
        <label>
          下一項試舉
          <select id="me-next-lift">
            <option value="squat">Squat</option>
            <option value="bench">Bench</option>
            <option value="deadlift">Deadlift</option>
          </select>
        </label>
      </section>

      <section class="opponents-panel">
        <h2>對手</h2>
        <table class="opponents-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>體重</th>
              <th>Squat</th>
              <th>Bench</th>
              <th>Deadlift</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="opponents-body"></tbody>
        </table>
      </section>

      <section class="leaderboard-panel">
        <h2>即時排行榜</h2>
        <ul id="leaderboard-list"></ul>
        <p id="gap-message"></p>
      </section>
    </section>
  </main>

  <script src="../ipf-gl-points/gl-points.js"></script>
  <script src="meet.js"></script>
  <script src="opponents-table.js"></script>
  <script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify every id `main.js` needs is present**

Run:
```bash
for id in create-meet gap-message leaderboard-list me-bench me-bodyweight me-deadlift me-next-lift me-squat opponents-body settings-equipment settings-sex setup tracker; do
  count=$(grep -c "id=\"$id\"" tools/gl-live-tracker/index.html)
  echo "$id: $count"
done
```
Expected: every line prints `id: 1`.

- [ ] **Step 3: Verify script load order**

Run:
```bash
grep -n '<script' tools/gl-live-tracker/index.html
```
Expected: four lines, in this order: `gl-points.js`, `meet.js`, `opponents-table.js`, then `main.js` with `type="module"`.

- [ ] **Step 4: Commit**

```bash
git add tools/gl-live-tracker/index.html
git commit -m "Add GL Live Tracker page markup"
```

---

### Task 7: Styling (`style.css`)

**Files:**
- Create: `tools/gl-live-tracker/style.css`

**Interfaces:**
- Consumes: CSS custom properties from `assets/css/style.css` (`--bg`, `--fg`, `--card-bg`, `--accent`, `--border`) — must reuse them, not redefine them (no `:root` block).
- Consumes: class/id names from Task 6's `index.html` — `.tracker-page`, `#setup`, `.settings-panel`, `.me-panel`, `.opponents-table`, `.opp-remove`, `.leaderboard-panel`, `.leaderboard-row`, `.leaderboard-row--me`, `#gap-message`.

- [ ] **Step 1: Write `tools/gl-live-tracker/style.css`**

```css
.tracker-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.5rem;
}

#setup {
  text-align: center;
}

#setup button,
.opp-remove {
  padding: 0.6rem 1.2rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--fg);
  cursor: pointer;
}

.settings-panel,
.me-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.settings-panel label,
.me-panel label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}

.settings-panel select,
.me-panel input,
.me-panel select {
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--fg);
}

.opponents-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1.5rem;
}

.opponents-table th,
.opponents-table td {
  border-bottom: 1px solid var(--border);
  padding: 0.5rem;
  text-align: left;
}

.opponents-table input {
  width: 100%;
  padding: 0.4rem;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--card-bg);
  color: var(--fg);
}

.leaderboard-panel ul {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
}

.leaderboard-row {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.leaderboard-row--me {
  color: var(--accent);
  font-weight: bold;
}

#gap-message {
  font-size: 1.1rem;
  font-weight: bold;
  color: var(--accent);
}
```

- [ ] **Step 2: Verify no theme variables are redefined**

Run:
```bash
grep -c ':root' tools/gl-live-tracker/style.css || true
grep -c 'var(--' tools/gl-live-tracker/style.css
```
Expected: first command prints `0`; second prints at least `1`.

- [ ] **Step 3: Commit**

```bash
git add tools/gl-live-tracker/style.css
git commit -m "Add GL Live Tracker page styling"
```

---

### Task 8: Register the tool on the landing page

**Files:**
- Modify: `assets/js/entries.js`

**Interfaces:**
- Modifies `window.SITE_ENTRIES`, appending one `category: 'tool'` entry — no landing-page rendering code needs to change (same mechanism used for the IPF GL Points calculator entry already present).

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
  {
    title: 'IPF GL Points 計算器',
    description: '輸入性別、裝備、體重與成績，計算 IPF 官方 GL Points 分數',
    url: 'tools/ipf-gl-points/index.html',
    category: 'tool',
    date: '2026-07-11',
  },
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
  {
    title: 'GL Live Tracker',
    description: '比賽當天即時輸入自己與對手的成績，追蹤 GL Points 差距',
    url: 'tools/gl-live-tracker/index.html',
    category: 'tool',
    date: '2026-07-13',
  },
];
```

(`window.SITE_CATEGORIES` is unchanged.)

- [ ] **Step 2: Syntax-check the file**

Run: `node --check assets/js/entries.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Regression-check the landing page's own tests still pass**

Run: `node --test assets/js/render.test.js`
Expected: PASS — all 4 tests green.

- [ ] **Step 4: Commit**

```bash
git add assets/js/entries.js
git commit -m "Register GL Live Tracker on the landing page"
```

---

### Task 9: End-to-end verification

**Files:** None (verification only — exercises Tasks 1–8 together).

**What this task can and cannot verify:** the automated steps below (tests, syntax, static serving) can be fully verified by an agent. The realtime multi-device sync behavior — the actual point of this tool — requires a real Firebase project with published Security Rules and cannot be exercised by an agent (no browser, no way to observe two simulated "devices" syncing). Step 5 is an explicit manual test for Wade to run himself.

- [ ] **Step 1: Run all three test suites as a regression check**

Run:
```bash
node --test tools/gl-live-tracker/meet.test.js
node --test tools/ipf-gl-points/gl-points.test.js
node --test assets/js/render.test.js
```
Expected: all PASS (10/10, 5/5, 4/4 respectively).

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
curl -s http://localhost:8000/tools/gl-live-tracker/index.html | grep "GL Live Tracker"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/tools/gl-live-tracker/meet.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/tools/gl-live-tracker/opponents-table.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/tools/gl-live-tracker/sync.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/tools/gl-live-tracker/main.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/tools/gl-live-tracker/firebase-config.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/tools/gl-live-tracker/style.css
curl -s http://localhost:8000/assets/js/entries.js | grep "GL Live Tracker"
```
Expected: first command prints a line containing `GL Live Tracker`; each `curl -w` command prints `200`; the last command confirms the landing-page entry text is present in `entries.js` (mirrors the same caveat noted in the IPF GL Points calculator's plan: this confirms the string is embedded in the data file, not that it renders — visual confirmation happens by eye during Step 5).

- [ ] **Step 4: Stop the local server**

Run:
```bash
kill "$(cat /tmp/http-server.pid)"
rm /tmp/http-server.pid /tmp/http-server.log
```

- [ ] **Step 5: Manual two-device browser check (Wade, not automated)**

**Prerequisite:** the Firebase Security Rules from Task 2 must already be published in the Firebase Console (Realtime Database → Rules tab) — otherwise the database may still be in open test-mode rules or, if the test-mode grace period expired, may reject all reads/writes.

Start a local server (`python3 -m http.server 8000`) and:
1. Open `http://localhost:8000/tools/gl-live-tracker/index.html` in one browser tab. Click "建立新場次" — confirm the URL gains a `?meet=` parameter and the setup button is replaced by the settings/me/opponents/leaderboard sections.
2. Copy that full URL (including `?meet=...`) into a **second, separate browser tab or window** (simulating the helper's device).
3. In tab 1, fill in 性別/裝備, then 我的成績 (e.g. bodyweight 90, squat 200, bench 150, deadlift 0, 下一項 = Deadlift). Confirm tab 2 shows the same values appear within a few seconds, without you having refreshed tab 2.
4. In tab 2, add an opponent (name, bodyweight 92, squat 210, bench 140, deadlift 240). Confirm tab 1's leaderboard updates within a few seconds and shows a "距離 [對手] 還差 X GL Points，下一項（Deadlift）需要達到 Y kg" message.
5. While tab 1 is mid-typing in the deadlift field (e.g. typing "18" then pausing before finishing "180"), confirm tab 2's simultaneous edits elsewhere do **not** reset or clear what's being typed in tab 1 — this exercises the focus-preservation logic from Task 4/5.
6. In tab 1, increase 我的 deadlift until the leaderboard shows you leading — confirm the message switches to "目前領先，安全分差 X GL Points".
7. In tab 2, delete the opponent row — confirm it disappears from tab 1's opponent table and leaderboard within a few seconds.
8. Confirm the page's colors match the landing page's dark/light theme, and "← 回首頁" navigates back to the landing page.
9. On `http://localhost:8000/index.html`, confirm the "工具" section shows a "GL Live Tracker" card that opens this tool.

Stop the server afterward.

- [ ] **Step 6: Confirm final repo state**

Run: `git status`
Expected: clean working tree (`nothing to commit, working tree clean`), all prior tasks' commits present in `git log`.
