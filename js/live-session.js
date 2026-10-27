(function initializeLiveSession(namespace) {
  "use strict";

  // Aproximadamente 20 atualizações por segundo somente para a partida assistida.
  const SPECTATED_INTERVAL_MS = 50;
  const BACKGROUND_INTERVAL_MS = 500;
  const HEARTBEAT_INTERVAL_MS = 4_000;

  class LiveSession {
    constructor() {
      this.playerId = null;
      this.playerName = "";
      this.latestPayload = null;
      this.sendTimer = null;
      this.heartbeatTimer = null;
      this.lastSentAt = 0;
      this.sending = false;
      this.hasSpectators = false;
      this.connectionState = "offline";
      this.onConnectionChange = () => {};

      window.addEventListener("pagehide", () => this.leave());
    }

    async join(name) {
      if (this.playerId) return { id: this.playerId, name: this.playerName };
      this._setConnectionState("connecting");
      const response = await fetch("/api/players/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        this._setConnectionState("error");
        throw new Error(result.error || "Não foi possível entrar na sessão da sala.");
      }

      this.playerId = result.id;
      this.playerName = result.name;
      this._setConnectionState("online");
      this.heartbeatTimer = window.setInterval(() => {
        if (this.latestPayload) this.publish(this.latestPayload, true);
      }, HEARTBEAT_INTERVAL_MS);
      return result;
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

    _setConnectionState(state) {
      if (this.connectionState === state) return;
      this.connectionState = state;
      this.onConnectionChange(state);
    }
  }

  namespace.LiveSession = LiveSession;
})(window.SortFactory || (window.SortFactory = {}));
