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

assert.doesNotThrow(() => renderer.draw({
  time: 3500,
  snapshot: baseSnapshot,
  robot: { ...robot, moving: true, sprinting: true },
  nearbyIndex: null,
  manualSwap: null,
  paused: false,
  modalOpen: false,
  victory: false,
}));

const runningRobot = { ...robot, moving: true, sprinting: true };
const runningMotion = renderer._getRobotMotion(runningRobot, 3500);
const actionMotion = renderer._getRobotMotion(runningRobot, 3500, true);
assert.equal(runningMotion.walking, true);
assert.notEqual(runningMotion.step, 0);
assert.equal(actionMotion.walking, false, "posicionar a caixa deve omitir a caminhada");
assert.equal(actionMotion.step, 0);

const suppressedPhases = [];
const drawRobot = renderer._drawRobot.bind(renderer);
renderer._drawRobot = (...args) => suppressedPhases.push(args[4]);
draw({ ...baseSnapshot, state: GameState.SWAP_I_J }, {
  a: 1,
  b: 4,
  phase: "handoff",
  phaseProgress: 0.3,
}, 3600);
draw({ ...baseSnapshot, state: GameState.SWAP_I_J }, {
  a: 1,
  b: 4,
  phase: "placing",
  phaseProgress: 0.3,
}, 3700);
renderer._drawRobot = drawRobot;
assert.deepEqual(
  suppressedPhases,
  [true, true],
  "trocar e posicionar caixas devem congelar as pernas",
);

context.assignments.length = 0;
renderer._drawRobot(runningRobot, 3500, false);
assert.equal(
  context.assignments.some(({ property, value }) => property === "fillStyle" && value === "#71366f"),
  true,
  "robô correndo deve usar uma cor corporal diferente",
);

renderer.speedTrails = [];
renderer.lastRobotPosition = null;
renderer._updateSpeedTrails({ ...runningRobot, x: 300, y: 580 }, 4000);
renderer._updateSpeedTrails({ ...runningRobot, x: 314, y: 580 }, 4050);
assert.equal(renderer.speedTrails.length, 2, "corrida deve criar rastros temporários");
assert.ok(
  renderer.speedTrails.every((trail) => trail.x < 314 && trail.endX < trail.x),
  "rastros devem nascer atrás da direção do movimento e ficar no cenário",
);
renderer._updateSpeedTrails({ ...runningRobot, x: 328, y: 580 }, 4100, true);
assert.equal(renderer.speedTrails.length, 2, "ações que bloqueiam a corrida não devem criar rastros");
renderer._drawSpeedTrails(0.33);
assert.equal(renderer.speedTrails.length, 0, "rastros devem desaparecer rapidamente");

assert.equal(
  context.assignments.some(({ property }) => property === "filter"),
  false,
  "caixas bloqueadas não devem usar filtros de Canvas custosos",
);

console.log("✓ Renderer: zonas ativas/bloqueadas, caixa carregada e troca manual");
