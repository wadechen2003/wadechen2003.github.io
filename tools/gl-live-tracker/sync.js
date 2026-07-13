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
