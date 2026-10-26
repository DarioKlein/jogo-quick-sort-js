"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

global.window = global;
global.performance = global.performance || { now: () => Date.now() };

require(path.join(__dirname, "..", "js", "constants.js"));
require(path.join(__dirname, "..", "js", "utils.js"));
require(path.join(__dirname, "..", "js", "quick-sort-engine.js"));

const { GameState, PivotStrategy, PhaseId, PHASES } = global.SortFactory.Constants;
const { QuickSortEngine } = global.SortFactory;

function completePhase(engine) {
  switch (engine.state) {
    case GameState.INSPECT_I:
      engine.inspect(engine.i);
      break;
    case GameState.INSPECT_J:
      engine.inspect(engine.j);
      break;
    case GameState.SWAP_I_J: {
      engine.selectForSwap(engine.i);
      const request = engine.selectForSwap(engine.j);
      assert.equal(request.type, "swap-requested");
      engine.completeSwap(request.a, request.b);
      break;
    }
    case GameState.PLACE_PIVOT: {
      const pivotTargetIndex = engine.getSnapshot().pivotTargetIndex;
      let request = engine.selectForSwap(engine.pivotIndex);
      if (request.type !== "swap-requested") {
        request = engine.selectForSwap(pivotTargetIndex);
      }
      assert.equal(request.type, "swap-requested");
      engine.completeSwap(request.a, request.b);
      break;
    }
    default:
      throw new Error(`Estado inesperado: ${engine.state}`);
  }
}

function testCompleteGame(pivotStrategy, initialValues = undefined) {
  const engine = new QuickSortEngine(initialValues, pivotStrategy);
  let actions = 0;

  while (engine.state !== GameState.VICTORY && actions < 100) {
    completePhase(engine);
    actions += 1;
  }

  assert.ok(actions < 100, "a partida deve terminar sem entrar em loop");
  assert.deepEqual(engine.values, [...engine.initialValues].sort((a, b) => a - b));
  assert.equal(engine.resolved.size, engine.values.length);
  assert.equal(engine.errors, 0);
  assert.ok(engine.score > 1000);
  return { actions, engine };
}

function testInvalidActionIsSafe() {
  const engine = new QuickSortEngine();
  const originalValues = [...engine.values];
  const originalScore = engine.score;
  const wrongIndex = engine.i + 1;
  const result = engine.inspect(wrongIndex);

  assert.equal(result.ok, false);
  assert.deepEqual(engine.values, originalValues);
  assert.equal(engine.errors, 1);
  assert.equal(engine.score, originalScore - 40);
  assert.equal(engine.state, GameState.INSPECT_I);
}

function testTwoElementSegment() {
  const engine = new QuickSortEngine([2, 1]);
  let actions = 0;

  while (engine.state !== GameState.VICTORY && actions < 20) {
    completePhase(engine);
    actions += 1;
  }

  assert.deepEqual(engine.values, [1, 2]);
  assert.equal(engine.resolved.size, 2);
}

function testPhaseConfiguration() {
  const engine = new QuickSortEngine();
  const bestPhase = PHASES.find((phase) => phase.id === PhaseId.BEST);
  engine.inspect(engine.i);
  engine.configure(bestPhase.values[PivotStrategy.LAST], PivotStrategy.LAST);

  assert.deepEqual(engine.values, [...bestPhase.values[PivotStrategy.LAST]]);
  assert.equal(engine.pivotStrategy, PivotStrategy.LAST);
  assert.equal(engine.score, 1000);
  assert.equal(engine.errors, 0);
  assert.equal(engine.state, GameState.INSPECT_I);
}

testCompleteGame(PivotStrategy.FIRST);
testCompleteGame(PivotStrategy.LAST);
for (const pivotStrategy of Object.values(PivotStrategy)) {
  const averagePhase = PHASES.find((phase) => phase.id === PhaseId.AVERAGE);
  const bestPhase = PHASES.find((phase) => phase.id === PhaseId.BEST);
  const worstPhase = PHASES.find((phase) => phase.id === PhaseId.WORST);
  const averageResult = testCompleteGame(pivotStrategy, averagePhase.values[pivotStrategy]);
  const bestResult = testCompleteGame(pivotStrategy, bestPhase.values[pivotStrategy]);
  const worstResult = testCompleteGame(pivotStrategy, worstPhase.values[pivotStrategy]);

  assert.ok(bestResult.actions < worstResult.actions, "o melhor caso deve exigir menos ações que o pior");
  assert.ok(averageResult.actions < worstResult.actions, "o caso médio deve superar o pior caso");
}
[
  [5, 4, 3, 2, 1],
  [1, 2, 3, 4, 5],
  [3, 1, 3, 2, 1],
  [0, -4, 7, -1, 7],
].forEach((values) => {
  testCompleteGame(PivotStrategy.FIRST, values);
  testCompleteGame(PivotStrategy.LAST, values);
});
testInvalidActionIsSafe();
testTwoElementSegment();
testPhaseConfiguration();

console.log("✓ QuickSortEngine: três fases, dois pivôs, ações inválidas e subarray de 2 elementos");
