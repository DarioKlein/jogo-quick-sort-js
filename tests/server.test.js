"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createSortFactoryServer, normalizeName, normalizeNameKey } = require("../server.js");

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

async function openEventStream(url) {
  const controller = new AbortController();
  const response = await fetch(url, { signal: controller.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return {
    async nextEvent(expectedName) {
      while (true) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = block.match(/^event: (.+)$/m)?.[1];
          const data = block.match(/^data: (.+)$/m)?.[1];
          if (event === expectedName && data) return JSON.parse(data);
          continue;
        }
        const chunk = await reader.read();
        if (chunk.done) throw new Error(`Stream encerrado antes do evento ${expectedName}.`);
        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
      }
    },
    close() {
      controller.abort();
    },
  };
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  await new Promise((resolve) => server.close(resolve));
}

async function run() {
  assert.equal(normalizeName("  Ana   Silva  "), "Ana Silva");
  assert.equal(normalizeNameKey("  JOÃO "), "joao");

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sort-factory-test-"));
  const rankingFile = path.join(tempDirectory, "ranking.json");
  const server = createSortFactoryServer({ rankingFile });
  const baseUrl = await listen(server);
  let rosterStream = null;
  let watchStream = null;

  try {
    assert.equal((await fetch(baseUrl)).status, 200);
    assert.equal((await fetch(`${baseUrl}/dev`)).status, 200);

    const invalidJoin = await requestJson(`${baseUrl}/api/players/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "A" }),
    });
    assert.equal(invalidJoin.response.status, 400);

    const join = await requestJson(`${baseUrl}/api/players/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "  Maria  " }),
    });
    assert.equal(join.response.status, 201);
    assert.equal(join.body.name, "Maria");
    assert.match(join.body.id, /^[a-f0-9-]+$/);
    assert.match(join.body.token, /^[a-f0-9-]+$/);

    const duplicate = await requestJson(`${baseUrl}/api/players/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "MÁRIA" }),
    });
    assert.equal(duplicate.response.status, 409);

    const reconnect = await requestJson(`${baseUrl}/api/players/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Maria", token: join.body.token }),
    });
    assert.equal(reconnect.response.status, 200);
    assert.notEqual(reconnect.body.id, join.body.id);
    const playerId = reconnect.body.id;

    rosterStream = await openEventStream(`${baseUrl}/api/events`);
    const initialRoster = await rosterStream.nextEvent("roster");
    assert.equal(initialRoster[0].name, "Maria");
    const initialRanking = await rosterStream.nextEvent("ranking");
    assert.equal(initialRanking[0].bestScore, null);

    const state = {
      score: 3200,
      errors: 2,
      timeMs: 45_000,
      phaseId: "BEST",
      phaseNumber: 2,
      phaseTitle: "Melhor caso",
      pivotStrategy: "LAST",
      status: "jogando",
      gameState: { robot: { x: 300, y: 580 }, snapshot: { resolved: [0] } },
    };
    const update = await requestJson(`${baseUrl}/api/players/${playerId}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    assert.equal(update.response.status, 200);

    watchStream = await openEventStream(`${baseUrl}/api/watch/${playerId}/events`);
    const liveState = await watchStream.nextEvent("state");
    assert.equal(liveState.gameState.robot.x, 300);
    assert.equal(liveState.timeMs, 45_000);
    assert.equal(liveState.pivotStrategy, "FIRST");

    const completion = await requestJson(`${baseUrl}/api/players/${playerId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: 4380, timeMs: 123_456, errors: 2 }),
    });
    assert.equal(completion.response.status, 200);
    assert.equal(completion.body.rank, 1);
    assert.equal(completion.body.bestScore, 4380);

    const ranking = await requestJson(`${baseUrl}/api/ranking`);
    assert.equal(ranking.body.length, 1);
    assert.equal(ranking.body[0].attempts, 1);
    assert.equal(ranking.body[0].bestTimeMs, 123_456);

    await requestJson(`${baseUrl}/api/players/${playerId}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.deepEqual((await requestJson(`${baseUrl}/api/players`)).body, []);
    assert.equal((await requestJson(`${baseUrl}/api/ranking`)).body[0].online, false);
    assert.equal(JSON.parse(fs.readFileSync(rankingFile, "utf8")).players.length, 1);
  } finally {
    rosterStream?.close();
    watchStream?.close();
    await close(server);
  }

  const restartedServer = createSortFactoryServer({ rankingFile });
  const restartedUrl = await listen(restartedServer);
  try {
    assert.deepEqual((await requestJson(`${restartedUrl}/api/ranking`)).body, []);
    assert.equal(JSON.parse(fs.readFileSync(rankingFile, "utf8")).players.length, 0);
  } finally {
    await close(restartedServer);
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }

  console.log("✓ Servidor local: nomes únicos, ranking temporário, conclusão e reinício limpo");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
