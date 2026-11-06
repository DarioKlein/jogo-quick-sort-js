(function initializeDevDashboard(namespace) {
  "use strict";

  const players = new Map();
  const rankings = new Map();
  const gameCards = new Map();
  const rankingItems = new Map();
  const pendingRemovals = new Set();
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
    spectatorSelect: document.querySelector("#spectator-player-select"),
    spectatorPhase: document.querySelector("#spectator-phase"),
    spectatorScore: document.querySelector("#spectator-score"),
    spectatorTime: document.querySelector("#spectator-time"),
    spectatorErrors: document.querySelector("#spectator-errors"),
    spectatorWaiting: document.querySelector("#spectator-waiting"),
    spectatorStatus: document.querySelector("#spectator-status"),
    closeSpectator: document.querySelector("#close-spectator"),
  };

  let rosterSource = null;
  let watchSource = null;
  let selectedPlayerId = null;
  let spectatorOptionsSignature = "";
  let watchLoading = false;

  function setWatchStatus(message, loading = false) {
    watchLoading = loading;
    elements.spectatorStatus.textContent = message;
    elements.spectatorStatus.classList.toggle("is-loading", loading);
    elements.spectator.setAttribute("aria-busy", String(loading));
  }

  // Preserve controls between network updates, including an in-progress click or focus.
  function reconcile(container, items) {
    const wanted = new Set(items);
    [...container.children].forEach((item) => {
      if (!wanted.has(item)) item.remove();
    });
    items.forEach((item, index) => {
      if (container.children[index] !== item) {
        container.insertBefore(item, container.children[index] ?? null);
      }
    });
  }

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
      reconectando: "Aguardando reconexão",
    }[status] ?? "Conectado";
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

  function updateSpectatorSelect(activePlayers) {
    const signature = activePlayers
      .map((player) => `${player.id}:${player.name}`)
      .join("|");
    if (signature !== spectatorOptionsSignature) {
      spectatorOptionsSignature = signature;
      elements.spectatorSelect.replaceChildren(...activePlayers.map((player) => {
        const option = document.createElement("option");
        option.value = player.id;
        option.textContent = player.name;
        return option;
      }));
    }
    elements.spectatorSelect.value = selectedPlayerId ?? "";
  }

  function render() {
    if (selectedPlayerId && !players.has(selectedPlayerId)) {
      closeSpectator("A partida não está mais disponível.");
      return;
    }

    const activePlayers = [...players.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const ranking = orderedRankings();
    const onlineCount = activePlayers.length;
    updateSpectatorSelect([...activePlayers].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    elements.playerCount.textContent = `${ranking.length} registrados · ${onlineCount} online`;
    elements.rankingEmpty.classList.toggle("is-hidden", ranking.length > 0);
    elements.gamesEmpty.classList.toggle("is-hidden", activePlayers.length > 0);
    for (const id of rankingItems.keys()) if (!rankings.has(id)) rankingItems.delete(id);
    reconcile(elements.rankingList, ranking.map((player, index) => {
      const item = rankingItems.get(player.id) ?? elements.rankingTemplate.content.firstElementChild.cloneNode(true);
      rankingItems.set(player.id, item);
      item.querySelector(".ranking-item__position").textContent = index + 1;
      const name = item.querySelector(".ranking-item__name");
      name.textContent = player.name;
      name.title = player.name;
      item.querySelector(".ranking-item__time").textContent = player.bestTimeMs === null
        ? "Sem run concluída"
        : formatDuration(player.bestTimeMs);
      item.querySelector(".ranking-item__attempts").textContent = `${player.attempts} ${player.attempts === 1 ? "tentativa" : "tentativas"}`;
      item.querySelector(".ranking-item__score").textContent = player.bestScore ?? "—";
      item.classList.toggle("is-online", player.online);

      const removeButton = item.querySelector(".ranking-item__remove");
      removeButton.hidden = player.online;
      removeButton.setAttribute("aria-label", `Remover ${player.name} do ranking`);
      removeButton.disabled = pendingRemovals.has(player.id);
      removeButton.textContent = pendingRemovals.has(player.id) ? "" : "×";
      removeButton.setAttribute("aria-busy", String(pendingRemovals.has(player.id)));
      if (pendingRemovals.has(player.id)) {
        removeButton.setAttribute("aria-label", `Removendo ${player.name} do ranking`);
      }
      removeButton.onclick = () => removeRankingEntry(player.id, player.name);
      return item;
    }));

    for (const id of gameCards.keys()) if (!players.has(id)) gameCards.delete(id);
    reconcile(elements.gamesGrid, activePlayers.map((player) => {
      const isWatched = player.id === selectedPlayerId;
      const card = gameCards.get(player.id) ?? elements.gameTemplate.content.firstElementChild.cloneNode(true);
      gameCards.set(player.id, card);
      card.classList.toggle("is-watched", isWatched);
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

      const watchButton = card.querySelector(".watch-button");
      watchButton.textContent = isWatched
        ? watchLoading ? "Conectando…" : "Assistindo agora"
        : selectedPlayerId ? "Trocar para esta partida" : "Assistir partida";
      // Keep the control enabled while its click is being completed. Disabling a
      // button synchronously from its own activation is handled inconsistently
      // by browsers and can make the first click look like it was ignored.
      watchButton.disabled = false;
      watchButton.setAttribute("aria-disabled", String(isWatched));
      watchButton.setAttribute("aria-busy", String(isWatched && watchLoading));
      watchButton.onclick = () => {
        if (player.id !== selectedPlayerId) watchPlayer(player.id);
      };
      return card;
    }));
  }

  function upsertPlayer(player) {
    const isNew = !players.has(player.id);
    players.set(player.id, { ...players.get(player.id), ...player });
    render();
    if (isNew) refreshRanking();
  }

  function replaceRanking(entries) {
    rankings.clear();
    entries.forEach((entry) => rankings.set(entry.id, entry));
    render();
  }

  async function refreshRanking() {
    try {
      const response = await fetch("/api/ranking", { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!response.ok) return;
      replaceRanking(await response.json());
    } catch {
      return;
    }
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
      const { id, reason } = JSON.parse(event.data);
      players.delete(id);
      if (selectedPlayerId === id) {
        const messages = {
          removed: "Sessão e histórico removidos pelo painel.",
          reconnected: "O jogador reconectou.",
          timeout: "A sessão expirou.",
        };
        closeSpectator(messages[reason] ?? "O jogador encerrou a partida.");
      }
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

  async function removeRankingEntry(rankingId, playerName) {
    if (pendingRemovals.has(rankingId)) return;
    const confirmed = window.confirm(
      `Remover ${playerName} do ranking? O nome e todo o histórico serão apagados.`,
    );
    if (!confirmed) return;

    pendingRemovals.add(rankingId);
    render();
    try {
      const response = await fetch(`/api/ranking/${encodeURIComponent(rankingId)}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Não foi possível remover o jogador do ranking.");
      }
      rankings.delete(rankingId);
      render();
      refreshRanking();
    } catch (error) {
      setServerState("offline", error.message);
    } finally {
      pendingRemovals.delete(rankingId);
      render();
    }
  }

  function watchPlayer(playerId) {
    if (!players.has(playerId) || (playerId === selectedPlayerId && watchSource)) return;
    const previousSource = watchSource;
    watchSource = null;
    previousSource?.close();
    const wasHidden = elements.spectator.classList.contains("spectator--hidden");
    selectedPlayerId = playerId;
    spectatorBuffer.reset();
    setWatchStatus("Conectando à partida…", true);
    const player = players.get(playerId);
    elements.spectator.classList.remove("spectator--hidden");
    elements.spectatorName.textContent = player?.name ?? "Jogador";
    elements.spectatorPhase.textContent = "—";
    elements.spectatorScore.textContent = "—";
    elements.spectatorTime.textContent = "—";
    elements.spectatorErrors.textContent = "—";
    elements.spectatorWaiting.textContent = "Conectando à partida…";
    elements.spectatorWaiting.classList.remove("is-hidden");

    // Establish the stream before rendering the selected state. This makes the
    // first click atomic: once the UI says it is connecting, a stream already
    // exists and repeated clicks are safely ignored by the guard above.
    const source = new EventSource(`/api/watch/${encodeURIComponent(playerId)}/events`);
    watchSource = source;
    render();
    if (wasHidden) elements.spectator.scrollIntoView({ behavior: "smooth", block: "start" });

    source.addEventListener("state", (event) => {
      if (watchSource !== source) return;
      const state = JSON.parse(event.data);
      setWatchStatus("Transmissão conectada");
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
    source.addEventListener("offline", () => {
      if (watchSource !== source) return;
      closeSpectator("O jogador se desconectou.");
    });
    source.addEventListener("error", () => {
      if (watchSource !== source) return;
      if (!players.has(playerId)) {
        closeSpectator("Partida encerrada.");
        return;
      }
      setWatchStatus("Reconectando à partida… Você pode escolher outro jogador.", true);
      spectatorBuffer.reset();
      elements.spectatorWaiting.textContent = "Reconectando à partida…";
      elements.spectatorWaiting.classList.remove("is-hidden");
      render();
    });
  }

  function closeSpectator(message = "") {
    watchSource?.close();
    watchSource = null;
    selectedPlayerId = null;
    setWatchStatus("");
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
    if (elements.refresh.disabled) return;
    elements.refresh.disabled = true;
    elements.refresh.textContent = "Atualizando…";
    elements.refresh.setAttribute("aria-busy", "true");
    try {
      const [playersResponse, rankingResponse] = await Promise.all([
        fetch("/api/players", { cache: "no-store", signal: AbortSignal.timeout(10000) }),
        fetch("/api/ranking", { cache: "no-store", signal: AbortSignal.timeout(10000) }),
      ]);
      if (!playersResponse.ok || !rankingResponse.ok) throw new Error("Falha ao atualizar");
      const roster = await playersResponse.json();
      const ranking = await rankingResponse.json();
      players.clear();
      roster.forEach((player) => players.set(player.id, player));
      replaceRanking(ranking);
      setServerState("online", "Painel atualizado");
    } catch {
      setServerState("offline", "Não foi possível atualizar. Tente novamente.");
    } finally {
      elements.refresh.disabled = false;
      elements.refresh.textContent = "Atualizar";
      elements.refresh.setAttribute("aria-busy", "false");
    }
  });
  elements.closeSpectator.addEventListener("click", () => closeSpectator());
  elements.spectatorSelect.addEventListener("change", () => {
    const playerId = elements.spectatorSelect.value;
    if (playerId && playerId !== selectedPlayerId) watchPlayer(playerId);
  });
  window.addEventListener("pagehide", () => {
    rosterSource?.close();
    watchSource?.close();
  });

  render();
  connectRoster();
  requestAnimationFrame(drawSpectator);
})(window.SortFactory || (window.SortFactory = {}));
