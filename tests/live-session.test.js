"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

global.window = global;
global.window.addEventListener = () => {};
global.performance = global.performance || { now: () => 0 };

require(path.join(__dirname, "..", "js", "live-session.js"));

const session = new global.SortFactory.LiveSession();
session.playerId = "player-test";

assert.equal(session.shouldCollectFrame(0), true);
assert.equal(session.shouldCollectFrame(499), false, "sem espectador, coleta no máximo a cada 500 ms");
assert.equal(session.shouldCollectFrame(500), true);

session.hasSpectators = true;
assert.equal(session.shouldCollectFrame(549), false, "com espectador, respeita o intervalo de 50 ms");
assert.equal(session.shouldCollectFrame(550), true);

console.log("✓ LiveSession: o estado só é montado na frequência real da transmissão");
