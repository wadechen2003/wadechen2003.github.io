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
