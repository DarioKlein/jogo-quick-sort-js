"use strict";

const assert = require("node:assert/strict");
const { createSortFactoryServer, normalizeName } = require("../server.js");

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

async function run() {
  assert.equal(normalizeName("  Ana   Silva  "), "Ana Silva");
  assert.equal(normalizeName("<script>João</script>"), "scriptJoão/script");

  const server = createSortFactoryServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let rosterStream = null;
  let watchStream = null;

  try {
    const root = await fetch(baseUrl);
    assert.equal(root.status, 200);
    assert.match(await root.text(), /Sort Factory/);

    const dashboard = await fetch(`${baseUrl}/dev`);
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /SALA/);

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

    rosterStream = await openEventStream(`${baseUrl}/api/events`);
    const initialRoster = await rosterStream.nextEvent("roster");
    assert.equal(initialRoster[0].name, "Maria");

    const state = {
      score: 1270,
      errors: 2,
      phaseId: "BEST",
      phaseNumber: 2,
      phaseTitle: "Melhor caso",
      pivotStrategy: "LAST",
      status: "jogando",
      gameState: { robot: { x: 300, y: 580 }, snapshot: { resolved: [0] } },
    };
    const update = await requestJson(`${baseUrl}/api/players/${join.body.id}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    assert.equal(update.response.status, 200);

    watchStream = await openEventStream(`${baseUrl}/api/watch/${join.body.id}/events`);
    const liveState = await watchStream.nextEvent("state");
    assert.equal(liveState.gameState.robot.x, 300);
    assert.equal(liveState.score, 1270);
    assert.equal(liveState.sequence, 1);

    const roster = await requestJson(`${baseUrl}/api/players`);
    assert.equal(roster.body.length, 1);
    assert.equal(roster.body[0].score, 1270);
    assert.equal(roster.body[0].phaseTitle, "Melhor caso");

    const player = await requestJson(`${baseUrl}/api/players/${join.body.id}`);
    assert.equal(player.body.name, "Maria");
    assert.deepEqual(player.body.gameState.robot, { x: 300, y: 580 });

    const leave = await requestJson(`${baseUrl}/api/players/${join.body.id}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(leave.response.status, 200);

    const emptyRoster = await requestJson(`${baseUrl}/api/players`);
    assert.deepEqual(emptyRoster.body, []);
  } finally {
    rosterStream?.close();
    watchStream?.close();
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("✓ Servidor local: sessão temporária, estado ao vivo, painel e encerramento");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
