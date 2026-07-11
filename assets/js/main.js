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
