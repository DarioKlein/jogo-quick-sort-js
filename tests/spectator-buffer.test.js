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

const adaptiveBuffer = new SpectatorBuffer({ delayMs: 100, maxDelayMs: 500 });
adaptiveBuffer.push(frame(0), { serverTime: 1000, sequence: 1, receivedAt: 5000 });
adaptiveBuffer.push(frame(5), { serverTime: 1050, sequence: 2, receivedAt: 5050 });
assert.equal(adaptiveBuffer.delayMs, 100, "uma conexão estável mantém o atraso mínimo");
adaptiveBuffer.push(frame(10), { serverTime: 1100, sequence: 3, receivedAt: 5300 });
assert.ok(adaptiveBuffer.delayMs > 100, "oscilações de chegada devem aumentar o buffer");

const beforeAdjustment = adaptiveBuffer.sample(5350).robot.x;
const afterAdjustment = adaptiveBuffer.sample(5367).robot.x;
assert.ok(
  afterAdjustment >= beforeAdjustment,
  "o relógio adaptativo nunca deve fazer a reprodução voltar no tempo",
);

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

console.log("✓ SpectatorBuffer: atraso adaptativo, interpolação, ordem e reprodução sem recuo");
