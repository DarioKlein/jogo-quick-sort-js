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

async function runRemovedSessionTest() {
  const removedSession = new global.SortFactory.LiveSession();
  removedSession.playerId = "removed-player";
  removedSession.latestPayload = { score: 10 };
  removedSession.heartbeatTimer = setInterval(() => {}, 1_000);
  removedSession.heartbeatTimer.unref?.();
  let ended = 0;
  removedSession.onSessionEnded = () => {
    ended += 1;
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => ({}),
  });

  try {
    await removedSession._flush();
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(removedSession.playerId, null, "sessão removida deve ser limpa no cliente");
  assert.equal(removedSession.latestPayload, null, "não deve restar estado para reenviar");
  assert.equal(ended, 1, "o jogo deve ser avisado uma única vez");
  assert.equal(removedSession.hasSpectators, false);
}

async function runRemovedCompletionTest() {
  const completedSession = new global.SortFactory.LiveSession();
  completedSession.playerId = "removed-player";
  completedSession.heartbeatTimer = setInterval(() => {}, 1_000);
  completedSession.heartbeatTimer.unref?.();
  let ended = 0;
  completedSession.onSessionEnded = () => {
    ended += 1;
  };

  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 404,
    json: async () => ({ error: "Sessão expirada." }),
  });

  try {
    await assert.rejects(
      () => completedSession.completeRun({ score: 1000, timeMs: 1000, errors: 0 }),
      /Sessão expirada/,
    );
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(completedSession.playerId, null, "a sessão deve ser limpa ao concluir uma run expirada");
  assert.equal(ended, 1, "o retorno ao início deve ser solicitado uma única vez");
}

async function runResumeTest() {
  const storage = new Map([
    ["sort-factory-player", JSON.stringify({ name: "Maria", token: "token-recuperacao-123" })],
  ]);
  global.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  const requested = [];
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    requested.push(url);
    if (url.endsWith("/check")) {
      return { ok: true, json: async () => ({ available: true, name: "Maria" }) };
    }
    return {
      ok: true,
      json: async () => ({ id: "same-player", name: "Maria", token: "token-recuperacao-123" }),
    };
  };

  const resumedSession = new global.SortFactory.LiveSession();
  try {
    assert.deepEqual(await resumedSession.checkResumableSession(), { name: "Maria" });
    const resumed = await resumedSession.resume();
    assert.equal(resumed.id, "same-player");
    assert.equal(resumedSession.playerId, "same-player");
    assert.deepEqual(requested, ["/api/players/resume/check", "/api/players/resume"]);
  } finally {
    resumedSession._endSession();
    global.fetch = originalFetch;
    delete global.localStorage;
  }
}

runRemovedSessionTest()
  .then(runRemovedCompletionTest)
  .then(runResumeTest)
  .then(() => {
    console.log("✓ LiveSession: transmissão, sessão removida e recuperação no mesmo jogador");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
