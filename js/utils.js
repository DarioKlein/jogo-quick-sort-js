(function initializeUtils(namespace) {
  "use strict";

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function easeInOutCubic(value) {
    return value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  function isSorted(values) {
    return values.every((value, index) => index === 0 || values[index - 1] <= value);
  }

  function roundedRect(context, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.roundRect(x, y, width, height, safeRadius);
  }

  namespace.Utils = Object.freeze({ clamp, lerp, easeInOutCubic, isSorted, roundedRect });
})(window.SortFactory || (window.SortFactory = {}));
