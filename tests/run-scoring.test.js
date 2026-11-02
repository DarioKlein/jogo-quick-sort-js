"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

global.window = global;
require(path.join(__dirname, "..", "js", "run-scoring.js"));

const { calculateRunStats } = global.SortFactory.RunScoring;

const duringRun = calculateRunStats({
  phaseCount: 3,
  initialPhaseScore: 1000,
  completedScoreDelta: 250,
  completedErrors: 1,
  currentPhaseScore: 1120,
  currentPhaseErrors: 2,
  phaseCommitted: false,
  timeMs: 60_900,
});
assert.deepEqual(duringRun, {
  score: 3190,
  rawScore: 3370,
  timePenalty: 180,
  timeMs: 60_900,
  errors: 3,
});

const finished = calculateRunStats({
  phaseCount: 3,
  initialPhaseScore: 1000,
  completedScoreDelta: 600,
  completedErrors: 4,
  currentPhaseScore: 1500,
  currentPhaseErrors: 3,
  phaseCommitted: true,
  timeMs: 120_000,
});
assert.equal(finished.score, 3240);
assert.equal(finished.errors, 4);

console.log("✓ RunScoring: acumulação das fases, erros e penalidade por tempo");
