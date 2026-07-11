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
