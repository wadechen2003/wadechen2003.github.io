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
