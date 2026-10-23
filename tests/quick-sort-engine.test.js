"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

global.window = global;
global.performance = global.performance || { now: () => Date.now() };

require(path.join(__dirname, "..", "js", "constants.js"));
require(path.join(__dirname, "..", "js", "utils.js"));
require(path.join(__dirname, "..", "js", "quick-sort-engine.js"));

const { GameState } = global.SortFactory.Constants;
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
      let request = engine.selectForSwap(engine.pivotIndex);
      if (request.type !== "swap-requested") {
        request = engine.selectForSwap(engine.j);
      }
      assert.equal(request.type, "swap-requested");
      engine.completeSwap(request.a, request.b);
      break;
    }
    default:
      throw new Error(`Estado inesperado: ${engine.state}`);
  }
}

function testCompleteGame() {
  const engine = new QuickSortEngine();
  let actions = 0;

  while (engine.state !== GameState.VICTORY && actions < 100) {
    completePhase(engine);
    actions += 1;
  }

  assert.ok(actions < 100, "a partida deve terminar sem entrar em loop");
  assert.deepEqual(engine.values, [1, 3, 5, 8, 10, 12]);
  assert.equal(engine.resolved.size, engine.values.length);
  assert.equal(engine.errors, 0);
  assert.ok(engine.score > 1000);
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

testCompleteGame();
testInvalidActionIsSafe();
testTwoElementSegment();

console.log("✓ QuickSortEngine: fluxo completo, ações inválidas e subarray de 2 elementos");
