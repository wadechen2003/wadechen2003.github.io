# GL Live Tracker — 設計文件

日期：2026-07-13

## 背景與目標

Wade 即將參加一場以 IPF GL Points（而非單純三項總和）計分的比賽，需要一個比賽當天現場使用的工具：即時輸入自己與至少 5 位對手的體重與三項（squat/bench/deadlift）目前最佳成功重量，即時算出每個人的 GL Points，並告訴 Wade 距離目前最接近、分數領先他的對手還差多少，下一項試舉需要達到幾公斤才有機會超前。

比賽現場可能由 Wade 與一位幫手分別在不同裝置上輸入（Wade 輸入自己的成績，幫手幫忙輸入對手的成績），需要在數秒內即時同步到彼此畫面。

這是 [2026-07-11-ipf-gl-points-calculator-design.md](2026-07-11-ipf-gl-points-calculator-design.md) 之後的延伸子專案，重用該工具的 GL Points 計算邏輯。

## 非目標

- 不記錄完整的 3 次試舉歷程（成功/失敗），只追蹤「目前最佳成功重量」
- 不支援同場次內不同性別/裝備類別混合比較（全場共用一組 Men/Women × Classic/Equipped 設定）
- 不做帳號系統/真正的登入介面（用匿名登入 + 隨機場次代碼）
- 不處理離線模式（比賽現場需要基本連線，斷線時只顯示連線狀態，不做本機暫存後補送的複雜邏輯）
- 不自動建立 Firebase 專案（需 Wade 自行以 Google 帳號建立一次）

## 技術方案

延續現有站台「零依賴、無 build step」的精神，但這個工具因為需要多裝置即時同步，必須引入一個真正的後端服務。選用 **Firebase Realtime Database**：

- 免費方案（Spark Plan）額度：1GB 儲存、每月 10GB 傳輸、100 個同時連線 — 遠超這次一天使用的需求
- 透過 `<script type="module">` 載入 Firebase JS SDK，不需要自架伺服器、不需要 build step
- 資料變動後，所有連線裝置約 1 秒內透過即時監聽器（`onValue`）自動更新

**安全性**：Firebase 的 apiKey 等設定值本來就不是機密（安全性由 Security Rules 把關，不是靠隱藏設定值）。採用：
- **匿名登入**（`signInAnonymously()`）：訪客打開頁面時背景自動取得匿名帳號，無登入畫面
- **隨機場次代碼**：每場比賽產生一組長隨機字串 `meetId`，網址帶 `?meet={meetId}`，Security Rules 限制「需登入（含匿名）才能讀寫」，實際防護主要靠 `meetId` 不可猜測

## Firebase 手動設定步驟（Wade 需要自己做一次）

1. 前往 [Firebase Console](https://console.firebase.google.com/)，用 Google 帳號登入，點「新增專案」，專案名稱可自訂（例如 `wade-gl-tracker`），不需要啟用 Google Analytics
2. 在專案左側選單找到「Realtime Database」，點「建立資料庫」，地區選擇離台灣近的（例如 `asia-southeast1`），安全性規則先選「測試模式」（稍後會改成正式規則）
3. 在專案左側選單「Authentication」→「Sign-in method」，啟用「匿名」登入方式
4. 在專案設定（齒輪圖示 →「專案設定」）的「一般」頁籤，往下捲到「你的應用程式」，點「網頁」圖示新增一個網頁應用程式（名稱隨意，不需要勾選 Firebase Hosting），會出現一段 `firebaseConfig` 物件，把整段複製起來
5. 把複製的設定值貼到 `tools/gl-live-tracker/firebase-config.js`（實作階段我會先建立好這個檔案的骨架，你只要貼進去對應的值）
6. 回到 Realtime Database →「規則」頁籤，把規則改成（實作階段我會提供確切內容）：需要登入（`auth != null`）才能讀寫 `/meets/` 底下的資料

完成以上步驟後，這個工具就可以正常運作，之後不需要再回來設定。

## 檔案結構

```
tools/gl-live-tracker/
├── index.html            # UI：性別/裝備設定、我的成績區、對手列表、排行榜與差距提示
├── style.css              # 沿用 assets/css/style.css 的主題變數
├── firebase-config.js     # Firebase 專案設定值（Wade 貼入，非機密可直接 commit）
├── sync.js                 # Firebase 初始化、匿名登入、即時讀寫封裝
├── meet.js                 # 純邏輯：排名、差距計算、反推所需重量
├── meet.test.js            # node:test 測試 meet.js
└── main.js                 # DOM 邏輯：表單 ⇄ sync.js ⇄ meet.js ⇄ 畫面渲染
```

透過 `<script src="../ipf-gl-points/gl-points.js">` 重用既有的 `window.GLPoints.calculateGLPoints`，不複製係數表。

## 資料結構（Firebase Realtime Database）

```
/meets/{meetId}/
  settings: { sex: 'men' | 'women', equipment: 'classic' | 'equipped' }
  me:       { bodyweight, squat, bench, deadlift, nextLift: 'squat' | 'bench' | 'deadlift' }
  opponents/{opponentId}: { name, bodyweight, squat, bench, deadlift }
```

`opponentId` 用時間戳記或隨機字串產生（新增對手時建立，刪除對手時移除該節點）。`squat`/`bench`/`deadlift` 未輸入時視為 `0`。

## 場次流程

1. 打開 `tools/gl-live-tracker/index.html`（無 `?meet=` 參數）→ 顯示「建立新場次」按鈕
2. 按下後：`signInAnonymously()` → 產生隨機 `meetId`（例如 `crypto.randomUUID()` 取前 8 碼）→ 在 Firebase 建立 `/meets/{meetId}` 節點 → 網址更新為 `?meet={meetId}`（`history.replaceState`，不整頁重新導向）
3. 把這個網址複製給幫手；幫手打開同一網址 → 偵測到 `?meet=` 參數 → 自動 `signInAnonymously()` 並訂閱該節點的即時更新
4. 之後雙方對表單欄位的任何修改，都會寫入 Firebase，並透過即時監聽器同步到對方畫面

## 核心計算邏輯（`meet.js`，純函式，不依賴 DOM/Firebase）

```js
function computeTotal({ squat, bench, deadlift }) { /* squat+bench+deadlift */ }

function computePoints(calculateGLPoints, { sex, equipment, bodyweight, total }) {
  // 呼叫 window.GLPoints.calculateGLPoints({ sex, equipment, event: 'powerlifting', bodyweight, result: total })
}

function rankCompetitors(list) {
  // list: [{ id, name, points, ... }] → 依 points 由高到低排序，附上名次
}

function findClosestAbove(myPoints, othersWithPoints) {
  // 回傳目前分數領先我、但差距最小的對手；若我已領先全場則回傳 null
}

function requiredWeightForNextLift(calculateGLPoints, { me, targetPoints }) {
  // 1. 用 calculateGLPoints({...me, result: 1}) 取得我的係數（result=1 時回傳值即為四捨五入後的係數，
  //    這個技巧刻意不修改 gl-points.js 既有介面）
  // 2. requiredTotal = targetPoints / coefficient
  // 3. otherTwoSum = me 除了 nextLift 之外兩項的重量總和
  // 4. requiredWeight = requiredTotal - otherTwoSum
  // 5. 若 requiredWeight <= 0，代表已經超前，回傳 0 或特殊標記
}
```

## UI 與資料流

- **頁首**：性別（Men/Women）、裝備（Classic/Equipped）下拉選單 — 全場共用一次設定，寫入 `/meets/{meetId}/settings`
- **「我的成績」區**：體重、squat、bench、deadlift 數字輸入框 + 「下一項試舉」下拉選單（squat/bench/deadlift）— 寫入 `/meets/{meetId}/me`
- **對手列表**：可動態新增/刪除的表格，預設顯示 5 行，每行：姓名（選填）、體重、squat、bench、deadlift — 寫入/刪除 `/meets/{meetId}/opponents/{opponentId}`
- **排行榜區**：即時訂閱整個 `/meets/{meetId}` 節點，任何變動都重新計算並重新渲染：
  - 依 GL Points 排序的名單（我 + 所有對手），標示我的那一行
  - 若有人分數領先我：「距離最接近的對手還差 X.XX GL Points，下一項（[squat/bench/deadlift]）需要達到 Y.Yc kg 才能追平/超前」
  - 若我已領先全場：「目前領先，安全分差 X.XX GL Points」

## 錯誤處理

- 我的體重/性別/裝備尚未填寫完整時，不計算我的分數，排行榜區顯示提示文字，不當機
- Firebase 連線失敗/離線：畫面顯示簡單的連線狀態提示（例如「連線中…」/「連線失敗，請檢查網路」），不做本機暫存/離線佇列等複雜邏輯（YAGNI，比賽現場需要基本連線才有意義使用這個工具）
- `squat`/`bench`/`deadlift` 欄位空白視為 `0`，不阻擋計算（允許「這項還沒開始」的狀態自然呈現在總和裡）

## 測試

- `meet.test.js`：用 `node:test`，直接 `require('../ipf-gl-points/gl-points.js')` 取得真實的 `calculateGLPoints`（不 mock），測試：
  - `computeTotal` 基本加總
  - `rankCompetitors` 排序正確、名次正確
  - `findClosestAbove` 正確找出最接近的領先者；我已領先時回傳 `null`
  - `requiredWeightForNextLift` 反推重量的數值正確性（可用「已知係數反推」的方式設計 golden test：先用 `calculateGLPoints` 正向算出某個總和對應的 GL Points，再用 `requiredWeightForNextLift` 反推回同一個總和，兩者應一致）
  - 已領先情境回傳「不需要更多重量」的標記
- `sync.js`/`main.js`（Firebase 即時同步、DOM 渲染、場次建立流程）：無法在 `node:test` 中模擬真實 Firebase 連線，採手動瀏覽器驗證（開兩個瀏覽器分頁模擬「我」與「幫手」，確認輸入即時同步）

## 驗證方式

- `node --test tools/gl-live-tracker/meet.test.js` 全數通過
- 本機 static server 開啟頁面：
  - 按「建立新場次」，網址出現 `?meet=` 參數
  - 開第二個瀏覽器分頁貼上同一網址，兩分頁互相輸入資料，確認數秒內互相同步
  - 輸入情境：我落後時看到正確的「還差多少/需要幾公斤」；我領先時看到「安全分差」訊息
  - 新增/刪除對手行列功能正常
  - 頁面配色與首頁一致（深色/淺色主題）
