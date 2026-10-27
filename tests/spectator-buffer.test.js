"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

global.window = global;
global.performance = global.performance || { now: () => Date.now() };

require(path.join(__dirname, "..", "js", "utils.js"));
require(path.join(__dirname, "..", "js", "spectator-buffer.js"));

const { SpectatorBuffer } = global.SortFactory;

function frame(x, phaseProgress = 0.2) {
  return {
    robot: { x, y: 580, facing: 1, moving: true },
    manualSwap: {
      a: 1,
      b: 4,
      phase: "handoff",
      phaseProgress,
    },
    snapshot: { values: [8, 3, 12, 5, 1, 10] },
  };
}

const buffer = new SpectatorBuffer({ delayMs: 100 });
assert.equal(buffer.push(frame(0, 0.2), { serverTime: 1000, sequence: 1, receivedAt: 5000 }), true);
assert.equal(buffer.push(frame(10, 0.6), { serverTime: 1100, sequence: 2, receivedAt: 5100 }), true);
assert.equal(buffer.push(frame(99), { serverTime: 1090, sequence: 2, receivedAt: 5200 }), false);

const interpolated = buffer.sample(5150);
assert.equal(interpolated.robot.x, 5, "o robô deve ficar entre os dois quadros reais");
assert.equal(interpolated.manualSwap.phaseProgress, 0.4);

const latest = buffer.sample(5300);
assert.equal(latest.robot.x, 10, "sem quadro futuro, deve manter o último estado conhecido");

const teleportBuffer = new SpectatorBuffer({ delayMs: 100 });
teleportBuffer.push(frame(0), { serverTime: 1000, sequence: 1, receivedAt: 5000 });
teleportBuffer.push(frame(300), { serverTime: 1100, sequence: 2, receivedAt: 5100 });
assert.equal(
  teleportBuffer.sample(5150).robot.x,
  0,
  "reinícios e mudanças de fase não devem fazer o robô atravessar a tela voando",
);

teleportBuffer.reset();
assert.equal(teleportBuffer.size, 0);
assert.equal(teleportBuffer.sample(6000), null);

console.log("✓ SpectatorBuffer: atraso fixo, interpolação, ordem e transições sem recuo");
