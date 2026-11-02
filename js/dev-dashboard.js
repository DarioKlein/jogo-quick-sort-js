(function initializeDevDashboard(namespace) {
  "use strict";

  const players = new Map();
  const rankings = new Map();
  const { formatDuration } = namespace.Utils;
  const renderer = new namespace.Renderer(document.querySelector("#spectator-canvas"));
  const spectatorBuffer = new namespace.SpectatorBuffer({
    delayMs: 320,
    maxDelayMs: 700,
    maxFrames: 48,
  });
  const elements = {
    serverState: document.querySelector("#server-state"),
    playerCount: document.querySelector("#player-count"),
    rankingList: document.querySelector("#ranking-list"),
    rankingEmpty: document.querySelector("#ranking-empty"),
    gamesGrid: document.querySelector("#games-grid"),
    gamesEmpty: document.querySelector("#games-empty"),
    rankingTemplate: document.querySelector("#ranking-item-template"),
    gameTemplate: document.querySelector("#game-card-template"),
    refresh: document.querySelector("#refresh-button"),
    spectator: document.querySelector("#spectator"),
    spectatorName: document.querySelector("#spectator-name"),
    spectatorPhase: document.querySelector("#spectator-phase"),
    spectatorScore: document.querySelector("#spectator-score"),
    spectatorTime: document.querySelector("#spectator-time"),
    spectatorErrors: document.querySelector("#spectator-errors"),
    spectatorWaiting: document.querySelector("#spectator-waiting"),
    closeSpectator: document.querySelector("#close-spectator"),
  };

  let rosterSource = null;
  let watchSource = null;
  let selectedPlayerId = null;

  function setServerState(state, message) {
    elements.serverState.dataset.state = state;
    elements.serverState.querySelector("span").textContent = message;
  }

  function statusLabel(status) {
    return {
      menu: "No menu",
      tutorial: "No tutorial",
      jogando: "Jogando",
      pausado: "Pausado",
      concluido: "Concluído",
    }[status] ?? "Conectado";
  }

  function orderedPlayers() {
    return [...players.values()].sort((a, b) => (
      b.score - a.score
      || a.timeMs - b.timeMs
      || a.errors - b.errors
      || a.name.localeCompare(b.name, "pt-BR")
    ));
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

  function render() {
    const activePlayers = orderedPlayers();
    const ranking = orderedRankings();
    const onlineCount = activePlayers.length;
    elements.playerCount.textContent = `${ranking.length} registrados · ${onlineCount} online`;
    elements.rankingEmpty.classList.toggle("is-hidden", ranking.length > 0);
    elements.gamesEmpty.classList.toggle("is-hidden", activePlayers.length > 0);
    elements.rankingList.replaceChildren(...ranking.map((player, index) => {
      const item = elements.rankingTemplate.content.firstElementChild.cloneNode(true);
      item.querySelector(".ranking-item__position").textContent = index + 1;
      item.querySelector(".ranking-item__name").textContent = player.name;
      item.querySelector(".ranking-item__time").textContent = player.bestTimeMs === null
        ? "Sem run concluída"
        : formatDuration(player.bestTimeMs);
      item.querySelector(".ranking-item__attempts").textContent = `${player.attempts} ${player.attempts === 1 ? "tentativa" : "tentativas"}`;
      item.querySelector(".ranking-item__score").textContent = player.bestScore ?? "—";
      item.classList.toggle("is-online", player.online);
      return item;
    }));

    elements.gamesGrid.replaceChildren(...activePlayers.map((player) => {
      const card = elements.gameTemplate.content.firstElementChild.cloneNode(true);
      card.classList.toggle("is-watched", player.id === selectedPlayerId);
      const status = card.querySelector(".game-card__status");
      status.dataset.status = player.status;
      status.textContent = statusLabel(player.status);
      card.querySelector(".game-card__spectators").textContent = player.spectators
        ? `${player.spectators} assistindo`
        : "Sem espectadores";
      card.querySelector(".game-card__name").textContent = player.name;
      card.querySelector(".game-card__phase").textContent = `Fase ${player.phaseNumber} · ${player.phaseTitle}`;
      card.querySelector(".game-card__score").textContent = player.score;
      card.querySelector(".game-card__time").textContent = formatDuration(player.timeMs);
      card.querySelector(".game-card__errors").textContent = player.errors;
      card.querySelector(".watch-button").addEventListener("click", () => watchPlayer(player.id));
      return card;
    }));
  }

  function upsertPlayer(player) {
    players.set(player.id, { ...players.get(player.id), ...player });
    render();
  }

  function replaceRanking(entries) {
    rankings.clear();
    entries.forEach((entry) => rankings.set(entry.id, entry));
    render();
  }

  function connectRoster() {
    rosterSource?.close();
    setServerState("connecting", "Conectando ao servidor…");
    rosterSource = new EventSource("/api/events");
    rosterSource.addEventListener("open", () => setServerState("online", "Servidor local conectado"));
    rosterSource.addEventListener("roster", (event) => {
      players.clear();
      JSON.parse(event.data).forEach((player) => players.set(player.id, player));
      render();
    });
    rosterSource.addEventListener("ranking", (event) => replaceRanking(JSON.parse(event.data)));
    rosterSource.addEventListener("player", (event) => upsertPlayer(JSON.parse(event.data)));
    rosterSource.addEventListener("remove", (event) => {
      const { id } = JSON.parse(event.data);
      players.delete(id);
      if (selectedPlayerId === id) closeSpectator("O jogador encerrou a partida.");
      render();
    });
    rosterSource.addEventListener("error", () => {
      setServerState("offline", "Reconectando…");
    });
  }

  function hydrateFrame(gameState) {
    if (!gameState?.snapshot || !gameState.robot) return null;
    const snapshot = {
      ...gameState.snapshot,
      resolved: new Set(gameState.snapshot.resolved ?? []),
    };
    if (snapshot.comparison) {
      snapshot.comparison = {
        ...snapshot.comparison,
        timestamp: performance.now() - Math.max(0, snapshot.comparison.age ?? 0),
      };
    }
    return { ...gameState, snapshot };
  }

  function watchPlayer(playerId) {
    watchSource?.close();
    selectedPlayerId = playerId;
    spectatorBuffer.reset();
    const player = players.get(playerId);
    elements.spectator.classList.remove("spectator--hidden");
    elements.spectatorName.textContent = player?.name ?? "Jogador";
    elements.spectatorWaiting.textContent = "Conectando à partida…";
    elements.spectatorWaiting.classList.remove("is-hidden");
    render();
    elements.spectator.scrollIntoView({ behavior: "smooth", block: "start" });

    watchSource = new EventSource(`/api/watch/${encodeURIComponent(playerId)}/events`);
    watchSource.addEventListener("state", (event) => {
      const state = JSON.parse(event.data);
      upsertPlayer(state);
      elements.spectatorName.textContent = state.name;
      elements.spectatorPhase.textContent = `${state.phaseNumber} · ${state.phaseTitle}`;
      elements.spectatorScore.textContent = state.score;
      elements.spectatorTime.textContent = formatDuration(state.timeMs);
      elements.spectatorErrors.textContent = state.errors;
      const frame = hydrateFrame(state.gameState);
      if (frame) {
        spectatorBuffer.push(frame, {
          serverTime: state.updatedAt,
          sequence: state.sequence,
        });
      }
      elements.spectatorWaiting.classList.toggle("is-hidden", spectatorBuffer.size > 0);
      if (!frame) elements.spectatorWaiting.textContent = "Aguardando o jogador iniciar a missão…";
    });
    watchSource.addEventListener("offline", () => closeSpectator("O jogador se desconectou."));
    watchSource.addEventListener("error", () => {
      if (selectedPlayerId === playerId && !players.has(playerId)) closeSpectator("Partida encerrada.");
    });
  }

  function closeSpectator(message = "") {
    watchSource?.close();
    watchSource = null;
    selectedPlayerId = null;
    spectatorBuffer.reset();
    elements.spectator.classList.add("spectator--hidden");
    if (message) setServerState("online", message);
    render();
  }

  function drawSpectator(time) {
    const frame = spectatorBuffer.sample(time);
    if (frame) renderer.draw({ ...frame, time });
    requestAnimationFrame(drawSpectator);
  }

  elements.refresh.addEventListener("click", async () => {
    try {
      const [playersResponse, rankingResponse] = await Promise.all([
        fetch("/api/players", { cache: "no-store" }),
        fetch("/api/ranking", { cache: "no-store" }),
      ]);
      const roster = await playersResponse.json();
      const ranking = await rankingResponse.json();
      players.clear();
      roster.forEach((player) => players.set(player.id, player));
      replaceRanking(ranking);
    } catch {
      setServerState("offline", "Servidor local indisponível");
    }
  });
  elements.closeSpectator.addEventListener("click", () => closeSpectator());
  window.addEventListener("pagehide", () => {
    rosterSource?.close();
    watchSource?.close();
  });

  render();
  connectRoster();
  requestAnimationFrame(drawSpectator);
})(window.SortFactory || (window.SortFactory = {}));
