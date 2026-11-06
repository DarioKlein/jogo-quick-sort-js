"use strict";

const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");

const DEFAULT_PORT = 3000;
const PLAYER_TIMEOUT_MS = 15_000;
const PLAYER_RECONNECT_TIMEOUT_MS = 120_000;
const ROSTER_THROTTLE_MS = 500;
const MAX_BODY_BYTES = 96 * 1024;
const PUBLIC_EXTENSIONS = new Set([".html", ".css", ".js", ".png", ".svg", ".ico"]);
const CONTENT_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon",
});

function normalizeName(value) {
  return String(value ?? "")
    .replace(/[<>\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24);
}

function normalizeNameKey(value) {
  return normalizeName(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

function toSafeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function clampInteger(value, minimum, maximum, fallback = minimum) {
  return Math.min(maximum, Math.max(minimum, toSafeInteger(value, fallback)));
}

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Corpo da requisição muito grande."), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(Object.assign(new Error("JSON inválido."), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function writeEvent(response, event, value) {
  if (response.destroyed) return false;
  try {
    response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

function createSortFactoryServer({
  root = __dirname,
  rankingFile = path.join(root, "data", "ranking.json"),
  resetRanking = true,
} = {}) {
  const players = new Map();
  const rankings = new Map();
  const rosterClients = new Set();
  const watchClients = new Map();
  const rosterTimers = new Map();

  function publicRanking(record) {
    return {
      id: record.id,
      name: record.name,
      bestScore: record.bestScore,
      bestTimeMs: record.bestTimeMs,
      bestErrors: record.bestErrors,
      lastScore: record.lastScore,
      lastTimeMs: record.lastTimeMs,
      attempts: record.attempts,
      online: [...players.values()].some((player) => player.rankingId === record.id),
      updatedAt: record.updatedAt,
    };
  }

  function orderedRankings() {
    return [...rankings.values()].sort((a, b) => (
      Number(b.bestScore !== null) - Number(a.bestScore !== null)
      || (b.bestScore ?? -1) - (a.bestScore ?? -1)
      || (a.bestTimeMs ?? Number.POSITIVE_INFINITY) - (b.bestTimeMs ?? Number.POSITIVE_INFINITY)
      || (a.bestErrors ?? Number.POSITIVE_INFINITY) - (b.bestErrors ?? Number.POSITIVE_INFINITY)
      || a.name.localeCompare(b.name, "pt-BR")
    ));
  }

  function serializeRanking() {
    return orderedRankings().map(publicRanking);
  }

  function saveRanking() {
    fs.mkdirSync(path.dirname(rankingFile), { recursive: true });
    fs.writeFileSync(
      rankingFile,
      `${JSON.stringify({ players: [...rankings.values()] }, null, 2)}\n`,
      "utf8",
    );
  }

  function initializeRanking() {
    if (!resetRanking && fs.existsSync(rankingFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(rankingFile, "utf8"));
        (Array.isArray(data.players) ? data.players : []).forEach((record) => {
          if (record?.id && record?.nameKey && record?.token) rankings.set(record.id, record);
        });
        return;
      } catch {
        rankings.clear();
      }
    }
    rankings.clear();
    saveRanking();
  }

  initializeRanking();

  function findResumableSession(token) {
    if (typeof token !== "string" || token.length < 16) return null;
    const ranking = [...rankings.values()].find((record) => record.token === token);
    if (!ranking) return null;
    const player = [...players.values()].find((candidate) => (
      candidate.rankingId === ranking.id
      && candidate.reconnectUntil > Date.now()
    ));
    return player ? { player, ranking } : null;
  }

  function summarize(player) {
    return {
      id: player.id,
      name: player.name,
      score: player.score,
      errors: player.errors,
      timeMs: player.timeMs,
      phaseId: player.phaseId,
      phaseNumber: player.phaseNumber,
      phaseTitle: player.phaseTitle,
      pivotStrategy: player.pivotStrategy,
      status: player.status,
      updatedAt: player.updatedAt,
      sequence: player.sequence,
      spectators: watchClients.get(player.id)?.size ?? 0,
    };
  }

  function serializePlayer(player) {
    return { ...summarize(player), gameState: player.gameState };
  }

  function emitToSet(clients, event, value) {
    clients.forEach((client) => {
      if (!writeEvent(client, event, value)) clients.delete(client);
    });
  }

  function broadcastRanking() {
    emitToSet(rosterClients, "ranking", serializeRanking());
  }

  function broadcastRosterPlayer(player) {
    player.lastRosterBroadcast = Date.now();
    emitToSet(rosterClients, "player", summarize(player));
  }

  function scheduleRosterPlayer(player) {
    if (rosterTimers.has(player.id)) return;
    const elapsed = Date.now() - player.lastRosterBroadcast;
    if (elapsed >= ROSTER_THROTTLE_MS) {
      broadcastRosterPlayer(player);
      return;
    }

    const timer = setTimeout(() => {
      rosterTimers.delete(player.id);
      const current = players.get(player.id);
      if (current) broadcastRosterPlayer(current);
    }, ROSTER_THROTTLE_MS - elapsed);
    timer.unref?.();
    rosterTimers.set(player.id, timer);
  }

  function broadcastPlayerState(player) {
    const clients = watchClients.get(player.id);
    if (clients) emitToSet(clients, "state", serializePlayer(player));
  }

  function removePlayer(playerId, reason = "left") {
    const player = players.get(playerId);
    if (!player) return;
    players.delete(playerId);
    const timer = rosterTimers.get(playerId);
    if (timer) clearTimeout(timer);
    rosterTimers.delete(playerId);
    emitToSet(rosterClients, "remove", { id: playerId, reason });
    const viewers = watchClients.get(playerId);
    if (viewers) {
      emitToSet(viewers, "offline", { id: playerId, reason });
      viewers.forEach((client) => client.end());
      watchClients.delete(playerId);
    }
    broadcastRanking();
  }

  function openEventStream(request, response, clients, initialEvent, initialValue) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    response.write("retry: 1500\n\n");
    clients.add(response);
    writeEvent(response, initialEvent, initialValue);
    request.on("close", () => clients.delete(response));
  }

  async function handleApi(request, response, url) {
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true, players: players.size, ranking: rankings.size });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/players") {
      sendJson(response, 200, [...players.values()].map(summarize));
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/ranking") {
      sendJson(response, 200, serializeRanking());
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/players/resume/check") {
      const body = await readJson(request);
      const resumable = findResumableSession(body.token);
      sendJson(response, 200, resumable
        ? { available: true, name: resumable.player.name }
        : { available: false });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/players/resume") {
      const body = await readJson(request);
      const resumable = findResumableSession(body.token);
      if (!resumable) {
        sendJson(response, 404, { error: "A sessão não está mais disponível para recuperação." });
        return true;
      }

      const { player, ranking } = resumable;
      const now = Date.now();
      player.reconnectUntil = null;
      player.statusBeforeSuspend = null;
      player.status = "menu";
      player.score = 0;
      player.errors = 0;
      player.timeMs = 0;
      player.phaseId = "AVERAGE";
      player.phaseNumber = 1;
      player.phaseTitle = "Caso médio";
      player.gameState = null;
      player.updatedAt = now;
      player.lastSeen = now;
      broadcastRosterPlayer(player);
      broadcastPlayerState(player);
      sendJson(response, 200, { id: player.id, name: player.name, token: ranking.token });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/players/resume/discard") {
      const body = await readJson(request);
      const resumable = findResumableSession(body.token);
      if (resumable) removePlayer(resumable.player.id, "resume-declined");
      sendJson(response, 200, { ok: true });
      return true;
    }

    const rankingMatch = url.pathname.match(/^\/api\/ranking\/([a-f0-9-]+)$/i);
    if (request.method === "DELETE" && rankingMatch) {
      const rankingId = rankingMatch[1];
      if (!rankings.has(rankingId)) {
        sendJson(response, 404, { error: "Jogador não encontrado no ranking." });
        return true;
      }
      const activeSession = [...players.values()].find((player) => player.rankingId === rankingId);
      if (activeSession) {
        sendJson(response, 409, { error: "Encerre a sessão do jogador antes de removê-lo do ranking." });
        return true;
      }
      rankings.delete(rankingId);
      saveRanking();
      broadcastRanking();
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (request.method === "GET" && url.pathname === "/api/events") {
      openEventStream(
        request,
        response,
        rosterClients,
        "roster",
        [...players.values()].map(summarize),
      );
      writeEvent(response, "ranking", serializeRanking());
      return true;
    }

    const watchMatch = url.pathname.match(/^\/api\/watch\/([a-f0-9-]+)\/events$/i);
    if (request.method === "GET" && watchMatch) {
      const player = players.get(watchMatch[1]);
      if (!player) {
        sendJson(response, 404, { error: "Jogador não encontrado ou desconectado." });
        return true;
      }
      const clients = watchClients.get(player.id) ?? new Set();
      watchClients.set(player.id, clients);
      openEventStream(request, response, clients, "state", serializePlayer(player));
      scheduleRosterPlayer(player);
      request.on("close", () => {
        if (clients.size === 0) watchClients.delete(player.id);
        const current = players.get(player.id);
        if (current) scheduleRosterPlayer(current);
      });
      return true;
    }

    if (request.method === "POST" && url.pathname === "/api/players/join") {
      const body = await readJson(request);
      const name = normalizeName(body.name);
      if (name.length < 2) {
        sendJson(response, 400, { error: "Informe um nome com pelo menos 2 caracteres." });
        return true;
      }

      const nameKey = normalizeNameKey(name);
      let ranking = [...rankings.values()].find((record) => record.nameKey === nameKey);
      const knownIdentity = Boolean(ranking);
      if (ranking && body.token !== ranking.token) {
        sendJson(response, 409, {
          error: "Esse nome já está sendo usado. Acrescente seu sobrenome ou uma inicial.",
        });
        return true;
      }

      const now = Date.now();
      if (!ranking) {
        ranking = {
          id: randomUUID(),
          token: randomUUID(),
          name,
          nameKey,
          bestScore: null,
          bestTimeMs: null,
          bestErrors: null,
          lastScore: null,
          lastTimeMs: null,
          attempts: 0,
          updatedAt: now,
        };
        rankings.set(ranking.id, ranking);
        saveRanking();
      }

      const activeSession = [...players.values()].find((player) => player.rankingId === ranking.id);
      if (activeSession) {
        removePlayer(activeSession.id, "reconnected");
      }

      const player = {
        id: randomUUID(),
        rankingId: ranking.id,
        name: ranking.name,
        score: 0,
        errors: 0,
        timeMs: 0,
        phaseId: "AVERAGE",
        phaseNumber: 1,
        phaseTitle: "Caso médio",
        pivotStrategy: "FIRST",
        status: "menu",
        gameState: null,
        updatedAt: now,
        lastSeen: now,
        sequence: 0,
        lastRosterBroadcast: 0,
        reconnectUntil: null,
        statusBeforeSuspend: null,
      };
      players.set(player.id, player);
      broadcastRosterPlayer(player);
      broadcastRanking();
      sendJson(response, knownIdentity ? 200 : 201, {
        id: player.id,
        name: player.name,
        token: ranking.token,
      });
      return true;
    }

    const playerMatch = url.pathname.match(/^\/api\/players\/([a-f0-9-]+)(?:\/(state|complete|leave|suspend))?$/i);
    if (!playerMatch) return false;

    const player = players.get(playerMatch[1]);
    if (!player) {
      sendJson(response, 404, { error: "Sessão expirada. Entre novamente no jogo." });
      return true;
    }

    if (request.method === "GET" && !playerMatch[2]) {
      sendJson(response, 200, serializePlayer(player));
      return true;
    }

    if (request.method === "POST" && playerMatch[2] === "leave") {
      removePlayer(player.id);
      sendJson(response, 200, { ok: true });
      return true;
    }

    if (request.method === "POST" && playerMatch[2] === "suspend") {
      const now = Date.now();
      if (player.status !== "reconectando") player.statusBeforeSuspend = player.status;
      player.status = "reconectando";
      player.reconnectUntil = now + PLAYER_RECONNECT_TIMEOUT_MS;
      player.updatedAt = now;
      player.lastSeen = now;
      broadcastRosterPlayer(player);
      broadcastPlayerState(player);
      sendJson(response, 200, { ok: true, reconnectUntil: player.reconnectUntil });
      return true;
    }

    if (request.method === "POST" && playerMatch[2] === "complete") {
      const body = await readJson(request);
      const ranking = rankings.get(player.rankingId);
      if (!ranking) {
        sendJson(response, 404, { error: "Jogador não encontrado no ranking." });
        return true;
      }

      const score = clampInteger(body.score, 0, 10_000_000);
      const timeMs = clampInteger(body.timeMs, 1_000, 86_400_000, 1_000);
      const errors = clampInteger(body.errors, 0, 100_000);
      const isBest = ranking.bestScore === null
        || score > ranking.bestScore
        || (score === ranking.bestScore && timeMs < ranking.bestTimeMs)
        || (score === ranking.bestScore && timeMs === ranking.bestTimeMs && errors < ranking.bestErrors);

      ranking.lastScore = score;
      ranking.lastTimeMs = timeMs;
      ranking.attempts += 1;
      ranking.updatedAt = Date.now();
      if (isBest) {
        ranking.bestScore = score;
        ranking.bestTimeMs = timeMs;
        ranking.bestErrors = errors;
      }

      player.score = score;
      player.timeMs = timeMs;
      player.errors = errors;
      player.status = "concluido";
      player.updatedAt = ranking.updatedAt;
      player.lastSeen = ranking.updatedAt;
      saveRanking();
      broadcastRanking();
      broadcastRosterPlayer(player);
      broadcastPlayerState(player);

      const ordered = orderedRankings();
      sendJson(response, 200, {
        ok: true,
        rank: ordered.findIndex((record) => record.id === player.rankingId) + 1,
        isBest,
        bestScore: ranking.bestScore,
        bestTimeMs: ranking.bestTimeMs,
        attempts: ranking.attempts,
      });
      return true;
    }

    if (request.method === "POST" && playerMatch[2] === "state") {
      const body = await readJson(request);
      const now = Date.now();
      const suspended = player.reconnectUntil > now;
      player.score = toSafeInteger(body.score, player.score);
      player.errors = Math.max(0, toSafeInteger(body.errors, player.errors));
      player.timeMs = Math.max(0, toSafeInteger(body.timeMs, player.timeMs));
      player.phaseId = String(body.phaseId ?? player.phaseId).slice(0, 24);
      player.phaseNumber = Math.max(1, toSafeInteger(body.phaseNumber, player.phaseNumber));
      player.phaseTitle = String(body.phaseTitle ?? player.phaseTitle).slice(0, 40);
      player.pivotStrategy = "FIRST";
      if (!suspended) {
        player.status = ["menu", "tutorial", "jogando", "pausado", "concluido"]
          .includes(body.status) ? body.status : player.status;
      }
      player.gameState = body.gameState && typeof body.gameState === "object"
        ? body.gameState
        : player.gameState;
      player.sequence += 1;
      player.updatedAt = now;
      player.lastSeen = now;
      scheduleRosterPlayer(player);
      broadcastPlayerState(player);
      sendJson(response, 200, { ok: true, spectators: watchClients.get(player.id)?.size ?? 0 });
      return true;
    }

    return false;
  }

  function serveStatic(response, pathname) {
    const routePath = pathname === "/" ? "/index.html" : pathname === "/dev" ? "/dev.html" : pathname;
    let decodedPath;
    try {
      decodedPath = decodeURIComponent(routePath);
    } catch {
      sendJson(response, 400, { error: "Caminho inválido." });
      return;
    }

    const extension = path.extname(decodedPath).toLowerCase();
    const absolutePath = path.resolve(root, `.${decodedPath}`);
    const insideRoot = absolutePath.startsWith(`${path.resolve(root)}${path.sep}`);
    if (!insideRoot || !PUBLIC_EXTENSIONS.has(extension)) {
      sendJson(response, 404, { error: "Arquivo não encontrado." });
      return;
    }

    fs.readFile(absolutePath, (error, contents) => {
      if (error) {
        sendJson(response, error.code === "ENOENT" ? 404 : 500, { error: "Arquivo não encontrado." });
        return;
      }
      response.writeHead(200, {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Content-Length": contents.length,
        "Cache-Control": "no-store",
      });
      response.end(contents);
    });
  }

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    try {
      if (url.pathname.startsWith("/api/")) {
        if (!(await handleApi(request, response, url))) {
          sendJson(response, 404, { error: "Rota não encontrada." });
        }
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        sendJson(response, 405, { error: "Método não permitido." });
        return;
      }
      serveStatic(response, url.pathname);
    } catch (error) {
      if (!response.headersSent) {
        sendJson(response, error.status ?? 500, { error: error.message || "Erro interno." });
      } else {
        response.end();
      }
    }
  });

  const cleanupInterval = setInterval(() => {
    const limit = Date.now() - PLAYER_TIMEOUT_MS;
    const now = Date.now();
    players.forEach((player) => {
      const reconnectExpired = player.reconnectUntil && player.reconnectUntil < now;
      const regularTimeout = !player.reconnectUntil && player.lastSeen < limit;
      if (reconnectExpired || regularTimeout) removePlayer(player.id, "timeout");
    });
  }, 3_000);
  cleanupInterval.unref?.();

  const heartbeatInterval = setInterval(() => {
    rosterClients.forEach((client) => client.write(": heartbeat\n\n"));
    watchClients.forEach((clients) => {
      clients.forEach((client) => client.write(": heartbeat\n\n"));
    });
  }, 10_000);
  heartbeatInterval.unref?.();

  server.on("close", () => {
    clearInterval(cleanupInterval);
    clearInterval(heartbeatInterval);
    rosterTimers.forEach(clearTimeout);
    rosterClients.forEach((client) => client.end());
    watchClients.forEach((clients) => clients.forEach((client) => client.end()));
  });

  server.sortFactoryState = { players, rankings, removePlayer, rankingFile };
  return server;
}

function getLocalAddresses(port) {
  const addresses = [];
  Object.entries(os.networkInterfaces()).forEach(([interfaceName, networks]) => {
    networks.forEach((network) => {
      if (network.family === "IPv4" && !network.internal) {
        addresses.push({ interfaceName, url: `http://${network.address}:${port}` });
      }
    });
  });
  return addresses;
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT, 10) || DEFAULT_PORT;
  const server = createSortFactoryServer();
  server.listen(port, "0.0.0.0", () => {
    console.log("\nSort Factory está pronto.");
    console.log(`Jogo local:   http://localhost:${port}`);
    console.log(`Painel dev:   http://localhost:${port}/dev`);
    getLocalAddresses(port).forEach(({ interfaceName, url }) => {
      console.log(`Rede (${interfaceName}): ${url}`);
    });
    console.log(`\nRanking temporário: ${server.sortFactoryState.rankingFile}`);
    console.log("O arquivo é recriado vazio a cada inicialização do servidor.\n");
  });
}

module.exports = { createSortFactoryServer, normalizeName, normalizeNameKey };
