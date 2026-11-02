"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

global.window = global;
global.performance = global.performance || { now: () => Date.now() };

require(path.join(__dirname, "..", "js", "constants.js"));
require(path.join(__dirname, "..", "js", "utils.js"));
require(path.join(__dirname, "..", "js", "renderer.js"));

function createContextStub() {
  const noop = () => {};
  const assignments = [];
  return new Proxy({ assignments }, {
    get(target, property) {
      if (property === "assignments") return target.assignments;
      if (property === "createLinearGradient") return () => ({ addColorStop: noop });
      if (property === "measureText") return (text) => ({ width: String(text).length * 8 });
      return noop;
    },
    set(target, property, value) {
      target.assignments.push({ property, value });
      return true;
    },
  });
}

const context = createContextStub();
const canvas = { getContext: () => context };
const renderer = new global.SortFactory.Renderer(canvas);
const { GameState, PivotStrategy } = global.SortFactory.Constants;
const baseSnapshot = {
  values: [8, 3, 12, 5, 1, 10],
  resolved: new Set(),
  segment: { start: 0, end: 5 },
  pivotIndex: 0,
  pivotValue: 8,
  pivotStrategy: PivotStrategy.FIRST,
  pivotTargetIndex: null,
  i: 1,
  j: 5,
  state: GameState.INSPECT_I,
  selected: null,
  comparison: null,
};
const robot = { x: 403, y: 584, facing: 1, moving: false };

function draw(snapshot, manualSwap = null, time = 1000) {
  renderer.draw({
    time,
    snapshot,
    robot,
    nearbyIndex: 1,
    manualSwap,
    paused: false,
    modalOpen: false,
    victory: false,
  });
}

assert.doesNotThrow(() => draw(baseSnapshot));
assert.doesNotThrow(() => draw({
  ...baseSnapshot,
  segment: { start: 0, end: 2 },
  pivotIndex: 0,
  i: 1,
  j: 2,
  resolved: new Set([3]),
}));
assert.doesNotThrow(() => draw({
  ...baseSnapshot,
  state: GameState.SWAP_I_J,
  selected: 1,
}, null, 1500));

[
  { phase: "handoff", phaseProgress: 0.2 },
  { phase: "handoff", phaseProgress: 0.8 },
  { phase: "carry-back", phaseProgress: 1 },
  { phase: "placing", phaseProgress: 0.35 },
  { phase: "placing", phaseProgress: 0.9 },
].forEach((manualSwap, index) => {
  assert.doesNotThrow(() => draw({
    ...baseSnapshot,
    state: GameState.SWAP_I_J,
    selected: null,
  }, { a: 1, b: 4, ...manualSwap }, 2000 + index * 100));
});

assert.doesNotThrow(() => draw({
  ...baseSnapshot,
  state: GameState.PLACE_PIVOT,
  selected: 0,
}, { a: 0, b: 0, phase: "placing", phaseProgress: 0.5 }, 3000));

assert.equal(
  context.assignments.some(({ property }) => property === "filter"),
  false,
  "caixas bloqueadas não devem usar filtros de Canvas custosos",
);

console.log("✓ Renderer: zonas ativas/bloqueadas, caixa carregada e troca manual");
