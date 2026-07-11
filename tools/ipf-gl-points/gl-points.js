(function (global) {
  'use strict';

  var COEFFICIENTS = {
    'men-equipped-powerlifting': { A: 1236.25115, B: 1449.21864, C: 0.01644 },
    'men-classic-powerlifting': { A: 1199.72839, B: 1025.18162, C: 0.00921 },
    'men-equipped-bench': { A: 381.22073, B: 733.79378, C: 0.02398 },
    'men-classic-bench': { A: 320.98041, B: 281.40258, C: 0.01008 },
    'women-equipped-powerlifting': { A: 758.63878, B: 949.31382, C: 0.02435 },
    'women-classic-powerlifting': { A: 610.32796, B: 1045.59282, C: 0.03048 },
    'women-equipped-bench': { A: 221.82209, B: 357.00377, C: 0.02937 },
    'women-classic-bench': { A: 142.40398, B: 442.52671, C: 0.04724 },
  };

  var MIN_BODYWEIGHT = { men: 40, women: 35 };

  function round6(value) {
    return Math.round(value * 1e6) / 1e6;
  }

  function calculateGLPoints(input) {
    var key = input.sex + '-' + input.equipment + '-' + input.event;
    var coeffs = COEFFICIENTS[key];
    if (!coeffs) {
      return null;
    }

    var minBodyweight = MIN_BODYWEIGHT[input.sex];
    if (typeof input.bodyweight !== 'number' || input.bodyweight < minBodyweight) {
      return null;
    }

    if (input.result === 0) {
      return 0;
    }

    var coefficient = round6(100 / (coeffs.A - coeffs.B * Math.exp(-coeffs.C * input.bodyweight)));
    return round6(coefficient * input.result);
  }

  var api = { COEFFICIENTS: COEFFICIENTS, calculateGLPoints: calculateGLPoints };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.GLPoints = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
