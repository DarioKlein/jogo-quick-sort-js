(function initializeLiveSession(namespace) {
  "use strict";

  // Aproximadamente 20 atualizações por segundo somente para a partida assistida.
  const SPECTATED_INTERVAL_MS = 50;
  const BACKGROUND_INTERVAL_MS = 500;
  const HEARTBEAT_INTERVAL_MS = 4_000;
  const IDENTITY_STORAGE_KEY = "sort-factory-player";

  function identityKey(name) {
    return String(name ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("pt-BR");
  }

  class LiveSession {
    constructor() {
      this.playerId = null;
      this.playerName = "";
      this.latestPayload = null;
      this.sendTimer = null;
      this.heartbeatTimer = null;
      this.lastSentAt = 0;
      this.lastCollectedAt = Number.NEGATIVE_INFINITY;
      this.sending = false;
      this.hasSpectators = false;
      this.connectionState = "offline";
      this.onConnectionChange = () => {};
      this.onSessionEnded = () => {};

      window.addEventListener("pagehide", () => this.suspend());
    }

    async join(name) {
      if (this.playerId) return { id: this.playerId, name: this.playerName };
      this._setConnectionState("connecting");
      const savedIdentity = this._readIdentity();
      const token = identityKey(savedIdentity?.name) === identityKey(name)
        ? savedIdentity.token
        : null;
      const response = await fetch("/api/players/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, token }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        this._setConnectionState("error");
        throw new Error(result.error || "Não foi possível entrar na sessão da sala.");
      }

      this._activate(result);
      return result;
    }

    getSavedIdentity() {
      const identity = this._readIdentity();
      if (typeof identity?.name !== "string" || typeof identity?.token !== "string") return null;
      return { name: identity.name, token: identity.token };
    }

    async checkResumableSession() {
      const identity = this.getSavedIdentity();
      if (!identity) return null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const response = await fetch("/api/players/resume/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: identity.token }),
        });
        if (!response.ok) return null;
        const result = await response.json().catch(() => ({}));
        if (result.available) return { name: result.name || identity.name };
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 150));
        }
      }
      return null;
    }

    async resume() {
      const identity = this.getSavedIdentity();
      if (!identity) throw new Error("Identidade salva não encontrada.");
      this._setConnectionState("connecting");
      const response = await fetch("/api/players/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: identity.token }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        this._setConnectionState("error");
        throw new Error(result.error || "Não foi possível recuperar a sessão.");
      }
      this._activate(result);
      return result;
    }

    async discardResumableSession() {
      const identity = this.getSavedIdentity();
      if (!identity) return;
      await fetch("/api/players/resume/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: identity.token }),
      }).catch(() => {});
    }

    async completeRun(run) {
      if (!this.playerId) throw new Error("Jogador não conectado.");
      const response = await fetch(`/api/players/${this.playerId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(run),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 404) {
        this._endSession();
        this._setConnectionState("error");
        this.onSessionEnded();
      }
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a run.");
      return result;
    }

    shouldCollectFrame(now = performance.now()) {
      if (!this.playerId) return false;
      const interval = this.hasSpectators ? SPECTATED_INTERVAL_MS : BACKGROUND_INTERVAL_MS;
      if (now - this.lastCollectedAt < interval) return false;
      this.lastCollectedAt = now;
      return true;
    }

    publish(payload, force = false) {
      if (!this.playerId) return;
      this.latestPayload = payload;
      if (this.sending) return;

      const interval = this.hasSpectators ? SPECTATED_INTERVAL_MS : BACKGROUND_INTERVAL_MS;
      const wait = force ? 0 : Math.max(0, interval - (performance.now() - this.lastSentAt));
      window.clearTimeout(this.sendTimer);
      this.sendTimer = window.setTimeout(() => this._flush(), wait);
    }

    leave() {
      if (!this.playerId) return;
      window.clearTimeout(this.sendTimer);
      window.clearInterval(this.heartbeatTimer);
      navigator.sendBeacon?.(`/api/players/${this.playerId}/leave`, new Blob(["{}"], {
        type: "application/json",
      }));
      this.playerId = null;
    }

    suspend() {
      if (!this.playerId) return;
      window.clearTimeout(this.sendTimer);
      window.clearInterval(this.heartbeatTimer);
      navigator.sendBeacon?.(`/api/players/${this.playerId}/suspend`, new Blob(["{}"], {
        type: "application/json",
      }));
      this.playerId = null;
    }

    async _flush() {
      if (!this.playerId || !this.latestPayload || this.sending) return;
      this.sending = true;
      const payload = this.latestPayload;
      try {
        const response = await fetch(`/api/players/${this.playerId}/state`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        if (response.status === 404) {
          if (!this.playerId) return;
          this._endSession();
          this._setConnectionState("error");
          this.onSessionEnded();
          return;
        }
        if (!response.ok) throw new Error("Sessão indisponível.");
        const result = await response.json();
        this.hasSpectators = result.spectators > 0;
        this.lastSentAt = performance.now();
        this._setConnectionState("online");
      } catch {
        this._setConnectionState("error");
      } finally {
        this.sending = false;
        if (payload !== this.latestPayload) this.publish(this.latestPayload);
      }
    }

    _endSession() {
      window.clearTimeout(this.sendTimer);
      window.clearInterval(this.heartbeatTimer);
      this.playerId = null;
      this.playerName = "";
      this.latestPayload = null;
      this.hasSpectators = false;
    }

    _activate(result) {
      window.clearInterval(this.heartbeatTimer);
      this.playerId = result.id;
      this.playerName = result.name;
      this.latestPayload = null;
      this.hasSpectators = false;
      this._saveIdentity({ name: result.name, token: result.token });
      this._setConnectionState("online");
      this.heartbeatTimer = window.setInterval(() => {
        if (this.latestPayload) this.publish(this.latestPayload, true);
      }, HEARTBEAT_INTERVAL_MS);
    }

    _setConnectionState(state) {
      if (this.connectionState === state) return;
      this.connectionState = state;
      this.onConnectionChange(state);
    }

    _readIdentity() {
      try {
        return JSON.parse(window.localStorage?.getItem(IDENTITY_STORAGE_KEY) ?? "null");
      } catch {
        return null;
      }
    }

    _saveIdentity(identity) {
      try {
        window.localStorage?.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
      } catch {
        // O jogo continua funcionando mesmo quando o navegador bloqueia o armazenamento local.
      }
    }
  }

  namespace.LiveSession = LiveSession;
})(window.SortFactory || (window.SortFactory = {}));
