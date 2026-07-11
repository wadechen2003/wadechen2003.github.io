(function () {
  'use strict';

  function getFormValues(form) {
    return {
      sex: form.sex.value,
      equipment: form.equipment.value,
      event: form.event.value,
      bodyweight: parseFloat(form.bodyweight.value),
      result: parseFloat(form.result.value),
    };
  }

  function isComplete(values) {
    return (
      values.sex !== '' &&
      values.equipment !== '' &&
      values.event !== '' &&
      !isNaN(values.bodyweight) &&
      !isNaN(values.result)
    );
  }

  function render(values, points) {
    var resultEl = document.getElementById('result');
    var hintEl = document.getElementById('hint');
    var minBodyweight = values.sex === 'men' ? 40 : 35;

    if (points === null) {
      resultEl.textContent = '';
      hintEl.textContent = '體重需 ≥ ' + minBodyweight + 'kg';
      return;
    }

    hintEl.textContent = '';
    resultEl.textContent = 'GL Points: ' + points.toFixed(2);
  }

  function update() {
    var form = document.getElementById('gl-form');
    var values = getFormValues(form);
    var resultEl = document.getElementById('result');
    var hintEl = document.getElementById('hint');

    if (!isComplete(values)) {
      resultEl.textContent = '';
      hintEl.textContent = '';
      return;
    }

    var points = window.GLPoints.calculateGLPoints(values);
    render(values, points);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('gl-form');
    form.addEventListener('input', update);
  });
})();
