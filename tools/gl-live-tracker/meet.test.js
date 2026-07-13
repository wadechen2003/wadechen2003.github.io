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
