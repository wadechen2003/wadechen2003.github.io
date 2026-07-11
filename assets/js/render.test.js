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
