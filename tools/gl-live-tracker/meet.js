(function (global) {
  'use strict';

  function computeTotal(lifts) {
    return (lifts.squat || 0) + (lifts.bench || 0) + (lifts.deadlift || 0);
  }

  function computePoints(calculateGLPoints, person) {
    if (!person.bodyweight) {
      return null;
    }
    return calculateGLPoints({
      sex: person.sex,
      equipment: person.equipment,
      event: 'powerlifting',
      bodyweight: person.bodyweight,
      result: computeTotal(person),
    });
  }

  function rankCompetitors(people) {
    return people
      .filter(function (p) {
        return typeof p.points === 'number';
      })
      .slice()
      .sort(function (a, b) {
        return b.points - a.points;
      })
      .map(function (p, index) {
        var withRank = {};
        Object.keys(p).forEach(function (key) {
          withRank[key] = p[key];
        });
        withRank.rank = index + 1;
        return withRank;
      });
  }

  function findClosestAbove(myPoints, others) {
    var above = others.filter(function (o) {
      return typeof o.points === 'number' && o.points > myPoints;
    });
    if (above.length === 0) {
      return null;
    }
    return above.reduce(function (closest, o) {
      return o.points < closest.points ? o : closest;
    });
  }

  function requiredWeightForNextLift(calculateGLPoints, input) {
    var coefficient = calculateGLPoints({
      sex: input.sex,
      equipment: input.equipment,
      event: 'powerlifting',
      bodyweight: input.bodyweight,
      result: 1,
    });

    if (typeof coefficient !== 'number' || coefficient === 0) {
      return 0;
    }

    var requiredTotal = input.targetPoints / coefficient;
    var otherTwoSum = computeTotal(input) - (input[input.nextLift] || 0);
    var requiredWeight = requiredTotal - otherTwoSum;

    if (requiredWeight <= 0) {
      return 0;
    }
    return Math.round(requiredWeight * 100) / 100;
  }

  var api = {
    computeTotal: computeTotal,
    computePoints: computePoints,
    rankCompetitors: rankCompetitors,
    findClosestAbove: findClosestAbove,
    requiredWeightForNextLift: requiredWeightForNextLift,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.MeetTracker = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
