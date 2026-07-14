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

function setConnectionStatus(text) {
  document.getElementById('connection-status').textContent = text;
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
  setConnectionStatus('');
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

  document.getElementById('add-opponent').addEventListener('click', function () {
    window.OpponentsTable.addEmptyRow(document.getElementById('opponents-body'), {
      createId: createOpponentId,
      onChange: function (id, values) {
        upsertOpponent(currentMeetId, id, values);
      },
      onRemove: function (id) {
        removeOpponent(currentMeetId, id);
      },
    });
  });

  if (existingMeetId) {
    setConnectionStatus('連線中…');
    joinOrCreateMeet(existingMeetId).then(startMeet).catch(function () {
      setConnectionStatus('連線失敗，請檢查網路');
    });
    return;
  }

  document.getElementById('create-meet').addEventListener('click', function () {
    setConnectionStatus('連線中…');
    joinOrCreateMeet(null).then(startMeet).catch(function () {
      setConnectionStatus('連線失敗，請檢查網路');
    });
  });
});
