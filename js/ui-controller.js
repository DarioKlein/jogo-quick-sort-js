(function initializeUiController(namespace) {
  "use strict";

  const { PHASES, TUTORIAL_PAGES } = namespace.Constants;
  const { formatDuration } = namespace.Utils;

  class UiController {
    constructor() {
      this.elements = {
        objective: document.querySelector("#objective"),
        phaseName: document.querySelector("#phase-name"),
        pivot: document.querySelector("#pivot-value"),
        runTime: document.querySelector("#run-time"),
        range: document.querySelector("#active-range"),
        score: document.querySelector("#score"),
        errors: document.querySelector("#errors"),
        array: document.querySelector("#array-readout"),
        status: document.querySelector("#status-message"),
        help: document.querySelector("#help-button"),
        restart: document.querySelector("#restart-button"),
        playerChip: document.querySelector("#player-chip"),
        playerDisplay: document.querySelector("#player-display"),
        playerName: document.querySelector("#player-name"),
        playerNameError: document.querySelector("#player-name-error"),
        start: document.querySelector("#start-modal"),
        startMission: document.querySelector("#start-mission-button"),
        resume: document.querySelector("#resume-modal"),
        resumePlayerName: document.querySelector("#resume-player-name"),
        resumeError: document.querySelector("#resume-error"),
        resumeSession: document.querySelector("#resume-session"),
        resumeNewSession: document.querySelector("#resume-new-session"),
        tutorial: document.querySelector("#tutorial-modal"),
        tutorialTitle: document.querySelector("#tutorial-title"),
        tutorialText: document.querySelector("#tutorial-text"),
        tutorialArt: document.querySelector("#tutorial-illustration"),
        tutorialDots: document.querySelector("#tutorial-dots"),
        tutorialBack: document.querySelector("#tutorial-back"),
        tutorialNext: document.querySelector("#tutorial-next"),
        tutorialSkip: document.querySelector("#tutorial-skip"),
        victory: document.querySelector("#victory-modal"),
        victoryLesson: document.querySelector("#victory-lesson"),
        victoryScore: document.querySelector("#victory-score"),
        victoryTime: document.querySelector("#victory-time"),
        victoryErrors: document.querySelector("#victory-errors"),
        victoryRank: document.querySelector("#victory-rank"),
        playAgain: document.querySelector("#play-again-button"),
      };

      this.tutorialIndex = 0;
      this.currentPhase = PHASES[0];
      this.playerName = "";
      this.statusTimer = null;
      this.onTutorialVisibilityChange = () => {};
      this.onRestart = () => {};
      this.onStart = () => {};
      this.onResume = () => {};
      this.onResumeDecline = () => {};
      this.onPlayAgain = () => {};

      this._bindEvents();
      this._renderTutorialPage();
    }

    update(snapshot, run = {}) {
      const { elements } = this;
      elements.objective.textContent = snapshot.objective;
      elements.pivot.textContent = snapshot.pivotValue ?? "—";
      elements.range.textContent = snapshot.segment
        ? `${snapshot.segment.start + 1}–${snapshot.segment.end + 1}`
        : "—";
      this.updateRunStats({
        score: run.score ?? snapshot.score,
        errors: run.errors ?? snapshot.errors,
        timeMs: run.timeMs ?? 0,
      });
      elements.array.replaceChildren(
        ...snapshot.values.map((value, index) => {
          const item = document.createElement("span");
          item.textContent = value;
          const inActiveSegment = snapshot.segment
            && index >= snapshot.segment.start
            && index <= snapshot.segment.end;
          item.classList.toggle("is-active", Boolean(inActiveSegment));
          item.classList.toggle("is-pivot", snapshot.pivotIndex === index);
          item.classList.toggle("is-done", snapshot.resolved.has(index));
          return item;
        }),
      );
    }

    updateRunStats(run) {
      this.elements.score.textContent = run.score;
      this.elements.errors.textContent = run.errors;
      this.elements.runTime.textContent = formatDuration(run.timeMs);
    }

    setObjective(message) {
      this.elements.objective.textContent = message;
    }

    setPhase(phase) {
      this.currentPhase = phase;
      this.elements.phaseName.textContent = `${phase.number} · ${phase.shortTitle}`;
    }

    setPlayerName(name) {
      this.playerName = name;
      this.elements.playerDisplay.textContent = name.toUpperCase();
      this.elements.playerName.value = name;
      this.elements.playerName.readOnly = true;
    }

    setConnectionState(state) {
      this.elements.playerChip.dataset.connection = state;
      const labels = {
        connecting: "CONECTANDO",
        error: "SEM CONEXÃO",
        offline: "AGUARDANDO",
      };
      this.elements.playerDisplay.textContent = state === "online" && this.playerName
        ? this.playerName.toUpperCase()
        : labels[state] ?? "ONLINE";
    }

    setStartPending(isPending, pendingLabel = "Entrando na sala…") {
      this.elements.startMission.disabled = isPending;
      this.elements.startMission.textContent = isPending ? pendingLabel : "Iniciar desafio";
    }

    showResumePrompt(name) {
      this.elements.start.classList.add("modal--hidden");
      this.elements.resumePlayerName.textContent = name;
      this.elements.resumeError.textContent = "";
      this.elements.resume.classList.remove("modal--hidden");
      this.onTutorialVisibilityChange(true);
      window.setTimeout(() => this.elements.resumeSession.focus(), 0);
    }

    hideResumePrompt({ showStart = false } = {}) {
      this.elements.resume.classList.add("modal--hidden");
      if (showStart) {
        this.elements.start.classList.remove("modal--hidden");
        window.setTimeout(() => this.elements.playerName.focus(), 0);
      }
    }

    setResumePending(isPending) {
      this.elements.resumeSession.disabled = isPending;
      this.elements.resumeNewSession.disabled = isPending;
      this.elements.resumeSession.textContent = isPending ? "Recuperando…" : "Continuar sessão";
    }

    showResumeError(message) {
      this.elements.resumeError.textContent = message;
    }

    showStartError(message) {
      this.elements.playerNameError.textContent = message;
      if (message) this.elements.playerName.focus();
    }

    showStatus(message, isError = false, duration = 4200) {
      window.clearTimeout(this.statusTimer);
      this.elements.status.textContent = message;
      this.elements.status.classList.toggle("status-message--error", isError);
      this.elements.status.classList.add("status-message--visible");
      this.statusTimer = window.setTimeout(() => {
        this.elements.status.classList.remove("status-message--visible");
      }, duration);
    }

    openTutorial(startAtBeginning = true) {
      if (startAtBeginning) this.tutorialIndex = 0;
      this._renderTutorialPage();
      this.elements.tutorial.classList.remove("modal--hidden");
      this.onTutorialVisibilityChange(true);
      window.setTimeout(() => this.elements.tutorialNext.focus(), 0);
    }

    showStartMenu({ resetPlayerName = false, message = "" } = {}) {
      this.elements.victory.classList.add("modal--hidden");
      this.elements.tutorial.classList.add("modal--hidden");
      this.elements.resume.classList.add("modal--hidden");
      this.elements.start.classList.remove("modal--hidden");
      if (resetPlayerName) {
        this.playerName = "";
        this.elements.playerName.value = "";
        this.elements.playerName.readOnly = false;
        this.setConnectionState("offline");
      }
      this.showStartError(message);
      this.onTutorialVisibilityChange(true);
      window.setTimeout(() => this.elements.playerName.focus(), 0);
    }

    hideStartMenu() {
      this.elements.start.classList.add("modal--hidden");
    }

    closeTutorial() {
      this.elements.tutorial.classList.add("modal--hidden");
      this.onTutorialVisibilityChange(false);
      this.elements.help.focus();
    }

    isTutorialOpen() {
      return !this.elements.tutorial.classList.contains("modal--hidden");
    }

    showRunComplete(result) {
      this.elements.victoryLesson.textContent = `Penalidade por tempo: −${result.timePenalty} pontos. Melhor resultado: ${result.bestScore} pontos em ${formatDuration(result.bestTimeMs)}.`;
      this.elements.victoryScore.textContent = result.score;
      this.elements.victoryTime.textContent = formatDuration(result.timeMs);
      this.elements.victoryErrors.textContent = result.errors;
      this.elements.victoryRank.textContent = result.rank ? `#${result.rank}` : "—";
      this.elements.victory.classList.remove("modal--hidden");
      window.setTimeout(() => this.elements.playAgain.focus(), 0);
    }

    hideVictory() {
      this.elements.victory.classList.add("modal--hidden");
    }

    _bindEvents() {
      this.elements.help.addEventListener("click", () => this.openTutorial(true));
      this.elements.restart.addEventListener("click", () => this.onRestart());
      this.elements.playAgain.addEventListener("click", () => this.onPlayAgain());
      this.elements.startMission.addEventListener("click", () => {
        const playerName = this.elements.playerName.value.trim();
        if (playerName.length < 2) {
          this.showStartError("Informe um nome com pelo menos 2 caracteres.");
          return;
        }
        this.showStartError("");
        this.onStart(playerName);
      });
      this.elements.resumeSession.addEventListener("click", () => this.onResume());
      this.elements.resumeNewSession.addEventListener("click", () => this.onResumeDecline());
      this.elements.playerName.addEventListener("input", () => this.showStartError(""));
      this.elements.playerName.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this.elements.startMission.click();
        }
      });
      this.elements.tutorialSkip.addEventListener("click", () => this.closeTutorial());
      this.elements.tutorialBack.addEventListener("click", () => {
        this._changeTutorialPage(-1);
      });
      this.elements.tutorialNext.addEventListener("click", () => {
        if (this.tutorialIndex === TUTORIAL_PAGES.length - 1) {
          this.closeTutorial();
          return;
        }
        this._changeTutorialPage(1);
      });

      document.addEventListener("keydown", (event) => {
        if (event.code === "Escape" && this.isTutorialOpen()) {
          event.preventDefault();
          this.closeTutorial();
        }
      });
    }

    _changeTutorialPage(offset) {
      const nextIndex = Math.max(0, Math.min(TUTORIAL_PAGES.length - 1, this.tutorialIndex + offset));
      if (nextIndex === this.tutorialIndex) return;
      this.tutorialIndex = nextIndex;
      this._renderTutorialPage(offset > 0 ? "forward" : "back");
    }

    _renderTutorialPage(direction = null) {
      const page = TUTORIAL_PAGES[this.tutorialIndex];
      this.elements.tutorialTitle.textContent = page.title;
      this.elements.tutorialText.textContent = this.tutorialIndex === 0
        ? "Complete em sequência o caso médio, o melhor caso e o pior caso. O cronômetro começa ao iniciar a missão."
        : this.tutorialIndex === 2
          ? "O pivô será sempre a primeira caixa de cada trecho, que servirá como referência da partição."
          : page.text;
      this.elements.tutorialArt.style.setProperty("--tutorial-art", page.art);
      this.elements.tutorialBack.disabled = this.tutorialIndex === 0;
      this.elements.tutorialNext.textContent = this.tutorialIndex === TUTORIAL_PAGES.length - 1
        ? "Iniciar run"
        : "Avançar";
      if (this.elements.tutorialDots.children.length !== TUTORIAL_PAGES.length) {
        this.elements.tutorialDots.replaceChildren(
          ...TUTORIAL_PAGES.map(() => {
          const dot = document.createElement("i");
          dot.setAttribute("aria-hidden", "true");
          return dot;
          }),
        );
      }
      [...this.elements.tutorialDots.children].forEach((dot, index) => {
        dot.classList.toggle("is-active", index === this.tutorialIndex);
      });
      this.elements.tutorialDots.classList.remove(
        "tutorial-dots--forward",
        "tutorial-dots--back",
      );
      if (direction) {
        // Force a fresh animation even when the same direction is used twice in a row.
        void this.elements.tutorialDots.offsetWidth;
        this.elements.tutorialDots.classList.add(`tutorial-dots--${direction}`);
      }
    }
  }

  namespace.UiController = UiController;
})(window.SortFactory || (window.SortFactory = {}));
