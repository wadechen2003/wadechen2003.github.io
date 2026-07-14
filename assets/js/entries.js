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
  {
    title: 'GL Live Tracker',
    description: '比賽當天即時輸入自己與對手的成績，追蹤 GL Points 差距',
    url: 'tools/gl-live-tracker/index.html',
    category: 'tool',
    date: '2026-07-13',
  },
];
