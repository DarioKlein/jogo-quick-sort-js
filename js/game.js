(function initializeGame(namespace) {
  "use strict";

  const {
    WIDTH,
    HEIGHT,
    BOX_START_X,
    BOX_GAP,
    INTERACTION_Y,
    INTERACTION_DISTANCE,
    HANDOFF_DURATION,
    PLACE_DURATION,
    INITIAL_SCORE,
    WALK_SPEED,
    SPRINT_MULTIPLIER,
    GameState,
    PivotStrategy,
    PHASES,
  } = namespace.Constants;
  const { clamp } = namespace.Utils;
  const { calculatePlayableTime, calculateRunStats } = namespace.RunScoring;

  const PHASE_TRANSITION_MS = 1900;
  const PHASE_ENTRANCE_MS = 1800;

  class SortFactoryGame {
    constructor() {
      this.canvas = document.querySelector("#game-canvas");
      this.engine = new namespace.QuickSortEngine();
      this.input = new namespace.InputController();
      this.ui = new namespace.UiController();
      this.renderer = new namespace.Renderer(this.canvas);
      this.liveSession = new namespace.LiveSession();
      this.currentPhase = PHASES[0];

      this.robot = this._createRobot();
      this.nearbyIndex = null;
      this.manualSwap = null;
      this.paused = false;
      this.manualPaused = false;
      this.menuOpen = false;
      this.menuPausedGame = false;
      this.pauseStartedAt = null;
      this.accumulatedPauseMs = 0;
      this.modalOpen = true;
      this.victoryShown = false;
      this.phaseCommitted = false;
      this.runCompleted = false;
      this.runStartedAt = null;
      this.runFinishedAt = null;
      this.completedScoreDelta = 0;
      this.completedErrors = 0;
      this.runSerial = 0;
      this.phaseTransitionTimer = null;
      this.phaseEntranceStartedAt = null;
      this.phaseEntranceEndsAt = null;
      this.phaseEntrancePending = false;
      this.phaseDowntimeStartedAt = null;
      this.lastFrameTime = performance.now();
      this.lastHudUpdate = Number.NEGATIVE_INFINITY;
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

      this._bindEvents();
      this.liveSession.onConnectionChange = (state) => this.ui.setConnectionState(state);
      this.liveSession.onSessionEnded = () => this._handleSessionEnded();
      this.engine.subscribe((snapshot) => this._handleStateChange(snapshot));
      this.ui.setPhase(this.currentPhase);
      this.ui.update(this.engine.getSnapshot(), this._getRunStats(this.engine.getSnapshot()));
      this.input.enabled = false;
      this.canvas.setAttribute("aria-describedby", "objective");

      this._frame = this._frame.bind(this);
      requestAnimationFrame(this._frame);
      this._checkForResumableSession();
    }

    restart() {
      if (!this.liveSession.playerId) return;
      this._beginRun(false);
      this.ui.showStatus("Nova run iniciada. Pontuação, tempo e erros foram reiniciados.");
    }

    togglePause() {
      if (
        !this.liveSession.playerId
        || this.modalOpen
        || this.victoryShown
        || this.phaseEntranceEndsAt !== null
      ) return;
      if (this.paused) {
        this._resumePause(true);
        return;
      }

      this._beginPause(true);
    }

    _beginPause(manual = false) {
      if (
        !this.paused
        && this.runStartedAt !== null
        && this.phaseDowntimeStartedAt === null
        && this.phaseEntranceEndsAt === null
      ) {
        this.pauseStartedAt = performance.now();
      }
      this.paused = true;
      this.manualPaused = this.manualPaused || manual;
      if (!manual) this.input.clear();
      this._stopRobotMotion();
      this.ui.setPaused(true);
    }

    _resumePause(focusCanvas = false) {
      if (this.pauseStartedAt !== null) {
        this.accumulatedPauseMs += Math.max(0, performance.now() - this.pauseStartedAt);
        this.pauseStartedAt = null;
      }
      this.paused = false;
      this.manualPaused = false;
      this.input.enabled = !this.modalOpen
        && !this.victoryShown
        && this.phaseEntranceEndsAt === null;
      this.lastFrameTime = performance.now();
      this.ui.setPaused(false);
      if (focusCanvas) this.canvas.focus();
    }

    _bindEvents() {
      this.ui.onTutorialVisibilityChange = (isOpen) => {
        this.modalOpen = isOpen;
        this.input.enabled = !isOpen
          && !this.victoryShown
          && !this.paused
          && this.phaseEntranceEndsAt === null
          && !this.phaseEntrancePending;
        this.input.clear();
        if (!isOpen && !this.paused) {
          if (this.phaseEntrancePending) {
            this._beginPhaseEntrance();
          } else {
            this._ensureRunStarted();
            this.canvas.focus();
          }
        }
      };
      this.ui.onMenuVisibilityChange = (isOpen) => {
        this.menuOpen = isOpen;
        if (isOpen) {
          this.menuPausedGame = !this.modalOpen && !this.victoryShown && !this.paused;
          if (this.menuPausedGame) this._beginPause(true);
          return;
        }
        if (this.menuPausedGame) {
          this.menuPausedGame = false;
          if (this.paused) this._resumePause(true);
        }
      };
      this.ui.onPauseToggle = () => this.togglePause();
      this.ui.onRestart = () => this.restart();
      this.ui.onStart = (playerName) => this._joinAndStart(playerName);
      this.ui.onResume = () => this._resumeSavedSession();
      this.ui.onResumeDecline = () => this._declineSavedSession();
      this.ui.onPlayAgain = () => this._beginRun(false);

      window.addEventListener("blur", () => {
        if (!this.modalOpen && !this.victoryShown && this.phaseEntranceEndsAt === null) {
          this._beginPause(false);
        }
      });
      this.canvas.addEventListener("pointerdown", () => {
        if (this.modalOpen || this.victoryShown) return;
        if (this.menuOpen) this.ui.closeMenu();
        if (this.paused) this._resumePause(true);
        else this.canvas.focus();
      });
      this.canvas.addEventListener("keydown", (event) => {
        if (event.code !== "KeyP" && !this.modalOpen && !this.victoryShown && !this.manualPaused) {
          this._resumePause(false);
        }
      });
      document.addEventListener("visibilitychange", () => {
        if (
          document.hidden
          && !this.modalOpen
          && !this.victoryShown
          && this.phaseEntranceEndsAt === null
        ) {
          this._beginPause(false);
        }
      });
    }

    _handleStateChange(snapshot) {
      this.ui.update(snapshot, this._getRunStats(snapshot));
      if (snapshot.state !== GameState.VICTORY || this.victoryShown) return;

      this.victoryShown = true;
      this.input.enabled = false;
      this.phaseCommitted = true;
      this.completedScoreDelta += snapshot.score - INITIAL_SCORE;
      this.completedErrors += snapshot.errors;
      this.renderer.celebrate();

      const nextPhase = this._getNextPhase();
      if (nextPhase) {
        this.phaseDowntimeStartedAt = performance.now();
        this.ui.showStatus(
          `Fase ${this.currentPhase.number} concluída! Preparando ${nextPhase.title.toLowerCase()}…`,
          false,
          PHASE_TRANSITION_MS,
        );
        this.phaseTransitionTimer = window.setTimeout(() => {
          this._startPhase(nextPhase.id, false);
        }, PHASE_TRANSITION_MS);
        return;
      }

      this.runFinishedAt = performance.now();
      this.runCompleted = true;
      this.modalOpen = true;
      this._finishRun(snapshot, this.runSerial);
    }

    _frame(time) {
      const delta = Math.min((time - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = time;
      this._completePhaseEntrance(time);

      if (
        !this.paused
        && !this.modalOpen
        && !this.victoryShown
        && this.phaseEntranceEndsAt === null
      ) {
        this._update(delta, time);
      }

      const snapshot = this.engine.getSnapshot();
      const run = this._getRunStats(snapshot, time);
      if (time - this.lastHudUpdate >= 200) {
        this.lastHudUpdate = time;
        this.ui.updateRunStats(run);
      }

      const manualSwapForFrame = this.manualSwap
        ? {
            ...this.manualSwap,
            phaseProgress: this.manualSwap.phase === "carry-back"
              ? 1
              : clamp(
                  (time - this.manualSwap.startedAt) / this._getManualPhaseDuration(this.manualSwap.phase),
                  0,
                  1,
                ),
          }
        : null;

      this.renderer.draw({
        time,
        snapshot,
        robot: this.robot,
        nearbyIndex: this.nearbyIndex,
        manualSwap: manualSwapForFrame,
        paused: this.paused,
        modalOpen: this.modalOpen || this.victoryShown,
        manualPaused: this.manualPaused,
        menuOpen: this.menuOpen,
        victory: snapshot.state === GameState.VICTORY,
        boxEntranceProgress: this._getPhaseEntranceProgress(time),
      });

      this._publishLiveState(time, snapshot, manualSwapForFrame, run);
      requestAnimationFrame(this._frame);
    }

    _update(delta, time) {
      if (this.manualSwap && this.manualSwap.phase !== "carry-back") {
        this._stopRobotMotion();
        const duration = this._getManualPhaseDuration(this.manualSwap.phase);
        const progress = (time - this.manualSwap.startedAt) / duration;
        if (progress >= 1) this._advanceManualSwap(time);
        return;
      }

      this._updateRobot(delta);
      this.nearbyIndex = this._findNearbyBox();

      if (this.input.consumeInteraction()) {
        if (this.manualSwap?.phase === "carry-back") this._placeDisplacedBox();
        else this._interact();
      }
    }

    _updateRobot(delta) {
      const movement = this._updateRobotMotion();
      const speed = WALK_SPEED * (this.robot.sprinting ? SPRINT_MULTIPLIER : 1);
      this.robot.x = clamp(this.robot.x + movement.x * speed * delta, 90, WIDTH - 90);
      this.robot.y = clamp(this.robot.y + movement.y * speed * delta, 500, HEIGHT - 77);
    }

    _updateRobotMotion() {
      const movement = this.input.getMovementVector();
      const sprinting = this.input.isSprinting();
      this.robot.moving = movement.x !== 0 || movement.y !== 0;
      this.robot.sprinting = sprinting && this.robot.moving;
      if (movement.x !== 0) this.robot.facing = movement.x > 0 ? 1 : -1;
      return movement;
    }

    _findNearbyBox() {
      let nearest = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      this.engine.values.forEach((_, index) => {
        const x = BOX_START_X + BOX_GAP * index;
        const distance = Math.hypot(this.robot.x - x, (this.robot.y - INTERACTION_Y) * 0.7);
        if (distance < INTERACTION_DISTANCE && distance < nearestDistance) {
          nearest = index;
          nearestDistance = distance;
        }
      });
      return nearest;
    }

    _interact() {
      if (this.nearbyIndex === null) {
        this.ui.showStatus("Aproxime-se de uma caixa para interagir.", true);
        return;
      }

      const snapshot = this.engine.getSnapshot();
      const inspectionState = snapshot.state === GameState.INSPECT_I
        || snapshot.state === GameState.INSPECT_J;
      const result = inspectionState
        ? this.engine.inspect(this.nearbyIndex)
        : this.engine.selectForSwap(this.nearbyIndex);

      if (!result.ok) {
        this.ui.showStatus(result.message, true);
        return;
      }
      if (["inspection", "selected", "deselected"].includes(result.type)) {
        this.ui.showStatus(this.engine.message);
      }
      if (result.type === "swap-requested") this._beginManualSwap(result);
    }

    _beginManualSwap({ a, b, pivot }) {
      this.manualSwap = {
        a,
        b,
        pivot,
        phase: a === b ? "placing" : "handoff",
        startedAt: performance.now(),
      };
      this.ui.setObjective(
        a === b
          ? "Confirme o encaixe do pivô."
          : "Apoiando a primeira caixa e transferindo a outra para as mãos do robô…",
      );
    }

    _advanceManualSwap(time) {
      if (this.manualSwap.phase === "handoff") {
        this.manualSwap.phase = "carry-back";
        this.manualSwap.startedAt = time;
        const displacedValue = this.engine.values[this.manualSwap.b];
        const destination = this.manualSwap.a + 1;
        const message = `Caixa ${displacedValue} nas mãos. Leve-a até a posição ${destination} e pressione E.`;
        this.ui.setObjective(message);
        this.ui.showStatus(message);
        return;
      }

      if (this.manualSwap.phase === "placing") {
        const { a, b, pivot } = this.manualSwap;
        this.manualSwap = null;
        this.engine.completeSwap(a, b);
        this.ui.showStatus(
          pivot ? "Pivô colocado em sua posição definitiva." : "Troca manual concluída corretamente.",
        );
      }
    }

    _placeDisplacedBox() {
      const destinationIndex = this.manualSwap.a;
      if (this.nearbyIndex !== destinationIndex) {
        const message = `A caixa deve ser levada até a posição ${destinationIndex + 1}, que ficou vazia.`;
        this.engine.rejectInteraction(message);
        this.ui.setObjective(message);
        this.ui.showStatus(message, true);
        return;
      }

      this.manualSwap.phase = "placing";
      this.manualSwap.startedAt = performance.now();
      this._stopRobotMotion();
      this.ui.setObjective(`Colocando a caixa na posição ${destinationIndex + 1}…`);
    }

    _stopRobotMotion() {
      this.robot.moving = false;
      this.robot.sprinting = false;
    }

    _getManualPhaseDuration(phase) {
      const duration = phase === "handoff" ? HANDOFF_DURATION : PLACE_DURATION;
      return this.reducedMotion.matches ? Math.min(duration, 180) : duration;
    }

    _createRobot() {
      return { x: BOX_START_X, y: 584, facing: 1, moving: false, sprinting: false };
    }

    async _joinAndStart(playerName) {
      this.ui.setStartPending(true);
      this.ui.showStartError("");
      try {
        const player = await this.liveSession.join(playerName);
        this.ui.setPlayerName(player.name);
        this.ui.hideStartMenu();
        this._beginRun(true);
      } catch (error) {
        this.ui.showStartError(error.message || "Não foi possível conectar ao servidor local da sala.");
      } finally {
        this.ui.setStartPending(false);
      }
    }

    async _checkForResumableSession() {
      if (!this.liveSession.getSavedIdentity()) return;
      this.ui.setStartPending(true, "Verificando sessão…");
      try {
        const resumable = await this.liveSession.checkResumableSession();
        if (resumable) this.ui.showResumePrompt(resumable.name);
      } catch {
        // Sem servidor disponível, o fluxo normal de entrada permanece acessível.
      } finally {
        this.ui.setStartPending(false);
      }
    }

    async _resumeSavedSession() {
      this.ui.setResumePending(true);
      this.ui.showResumeError("");
      try {
        const player = await this.liveSession.resume();
        this.ui.setPlayerName(player.name);
        this.ui.hideResumePrompt();
        this.ui.hideStartMenu();
        this._beginRun(false);
        this.ui.showStatus("Sessão recuperada. Uma nova run foi preparada.");
      } catch (error) {
        this.ui.showResumeError(error.message || "Não foi possível recuperar a sessão.");
      } finally {
        this.ui.setResumePending(false);
      }
    }

    async _declineSavedSession() {
      this.ui.setResumePending(true);
      await this.liveSession.discardResumableSession();
      this.ui.setResumePending(false);
      this.ui.hideResumePrompt({ showStart: true });
    }

    _handleSessionEnded() {
      window.clearTimeout(this.phaseTransitionTimer);
      this.runSerial += 1;
      this.runStartedAt = null;
      this.runFinishedAt = null;
      this.runCompleted = false;
      this.phaseCommitted = false;
      this.phaseEntranceStartedAt = null;
      this.phaseEntranceEndsAt = null;
      this.phaseEntrancePending = false;
      this.phaseDowntimeStartedAt = null;
      this.completedScoreDelta = 0;
      this.completedErrors = 0;
      this.manualSwap = null;
      this.paused = true;
      this.manualPaused = false;
      this.menuOpen = false;
      this.menuPausedGame = false;
      this.victoryShown = false;
      this.input.enabled = false;
      this.input.clear();
      this.ui.setPaused(false);
      this.engine.reset();
      this.renderer.resetEffects();
      this.ui.showStartMenu({
        resetPlayerName: true,
        message: "Sua sessão foi encerrada. Entre novamente para iniciar uma nova run.",
      });
      this.ui.showStatus("Sessão encerrada pelo painel. Você voltou ao início.", true, 8000);
    }

    _beginRun(showTutorial) {
      window.clearTimeout(this.phaseTransitionTimer);
      this.runSerial += 1;
      this.runStartedAt = null;
      this.runFinishedAt = null;
      this.pauseStartedAt = null;
      this.accumulatedPauseMs = 0;
      this.runCompleted = false;
      this.completedScoreDelta = 0;
      this.completedErrors = 0;
      this.phaseCommitted = false;
      this.phaseEntranceStartedAt = null;
      this.phaseEntranceEndsAt = null;
      this.phaseEntrancePending = false;
      this.phaseDowntimeStartedAt = null;
      this.modalOpen = showTutorial;
      this.ui.hideVictory();
      this._startPhase(PHASES[0].id, showTutorial);
    }

    _ensureRunStarted() {
      if (this.liveSession.playerId && !this.runCompleted && this.runStartedAt === null) {
        this.runStartedAt = performance.now();
      }
    }

    _beginPhaseEntrance(now = performance.now()) {
      this.phaseEntrancePending = false;
      this.phaseEntranceStartedAt = now;
      this.phaseEntranceEndsAt = now + PHASE_ENTRANCE_MS;
      this.input.enabled = false;
      this.input.clear();
      this._stopRobotMotion();
    }

    _completePhaseEntrance(now = performance.now()) {
      if (this.phaseEntranceEndsAt === null || now < this.phaseEntranceEndsAt) return;

      if (this.runStartedAt === null) {
        this.runStartedAt = now;
      } else if (this.phaseDowntimeStartedAt !== null) {
        this.accumulatedPauseMs += Math.max(0, now - this.phaseDowntimeStartedAt);
      }

      this.phaseEntranceStartedAt = null;
      this.phaseEntranceEndsAt = null;
      this.phaseDowntimeStartedAt = null;
      this.input.enabled = !this.modalOpen && !this.victoryShown && !this.paused;
      if (this.input.enabled) this.canvas.focus();
    }

    _getPhaseEntranceProgress(now = performance.now()) {
      if (this.phaseEntranceStartedAt === null || this.phaseEntranceEndsAt === null) return null;
      return clamp(
        (now - this.phaseEntranceStartedAt) / PHASE_ENTRANCE_MS,
        0,
        1,
      );
    }

    _getRunStats(snapshot, now = performance.now()) {
      const end = this.runFinishedAt ?? now;
      const activePauseMs = this.pauseStartedAt === null
        ? 0
        : Math.max(0, end - this.pauseStartedAt);
      const activePhaseDowntimeMs = this.phaseDowntimeStartedAt === null
        ? 0
        : Math.max(0, end - this.phaseDowntimeStartedAt);
      const timeMs = calculatePlayableTime({
        start: this.runStartedAt,
        end,
        pausedMs: this.accumulatedPauseMs,
        activePauseMs,
        phaseDowntimeMs: activePhaseDowntimeMs,
      });
      return calculateRunStats({
        phaseCount: PHASES.length,
        initialPhaseScore: INITIAL_SCORE,
        completedScoreDelta: this.completedScoreDelta,
        completedErrors: this.completedErrors,
        currentPhaseScore: snapshot.score,
        currentPhaseErrors: snapshot.errors,
        phaseCommitted: this.phaseCommitted,
        timeMs,
      });
    }

    async _finishRun(snapshot, runSerial) {
      const localResult = this._getRunStats(snapshot, this.runFinishedAt);
      const delay = new Promise((resolve) => window.setTimeout(resolve, 1800));
      let savedResult = {};
      try {
        [savedResult] = await Promise.all([
          this.liveSession.completeRun(localResult),
          delay,
        ]);
      } catch {
        await delay;
        if (runSerial !== this.runSerial) return;
        this.ui.showStatus("A run terminou, mas o ranking não pôde ser atualizado.", true);
      }

      if (runSerial !== this.runSerial) return;

      this.ui.showRunComplete({
        ...localResult,
        bestScore: savedResult.bestScore ?? localResult.score,
        bestTimeMs: savedResult.bestTimeMs ?? localResult.timeMs,
        rank: savedResult.rank ?? null,
      });
    }

    _publishLiveState(time, snapshot, manualSwap, run) {
      if (!this.liveSession.shouldCollectFrame(time)) return;
      let status = "jogando";
      if (this.runCompleted) status = "concluido";
      else if (this.ui.isTutorialOpen()) status = "tutorial";
      else if (this.modalOpen) status = "menu";
      else if (this.paused) status = "pausado";

      const comparison = snapshot.comparison
        ? {
            ...snapshot.comparison,
            timestamp: undefined,
            age: Math.max(0, time - snapshot.comparison.timestamp),
          }
        : null;
      this.liveSession.publish({
        score: run.score,
        errors: run.errors,
        timeMs: run.timeMs,
        phaseId: this.currentPhase.id,
        phaseNumber: this.currentPhase.number,
        phaseTitle: this.currentPhase.title,
        pivotStrategy: PivotStrategy.FIRST,
        status,
        gameState: {
          snapshot: { ...snapshot, resolved: [...snapshot.resolved], comparison },
          robot: { ...this.robot },
          nearbyIndex: this.nearbyIndex,
          manualSwap,
          paused: this.paused,
          manualPaused: this.manualPaused,
          modalOpen: this.modalOpen || this.victoryShown,
          victory: snapshot.state === GameState.VICTORY,
          boxEntranceProgress: this._getPhaseEntranceProgress(time),
        },
      });
    }

    _startPhase(phaseId, showTutorial) {
      const phase = PHASES.find((candidate) => candidate.id === phaseId) ?? PHASES[0];
      this.currentPhase = phase;
      this.manualSwap = null;
      this.renderer.resetEffects();
      this.robot = this._createRobot();
      this.nearbyIndex = null;
      this.paused = false;
      this.manualPaused = false;
      this.menuOpen = false;
      this.menuPausedGame = false;
      this.pauseStartedAt = null;
      this.victoryShown = false;
      this.phaseCommitted = false;
      this.phaseEntranceStartedAt = null;
      this.phaseEntranceEndsAt = null;
      this.phaseEntrancePending = showTutorial;
      this.ui.hideVictory();
      this.ui.setPaused(false);
      this.ui.setPhase(phase);
      this.engine.configure(phase.values[PivotStrategy.FIRST], PivotStrategy.FIRST);
      this.input.clear();

      if (showTutorial) {
        this.ui.openTutorial(true);
      } else {
        this.modalOpen = false;
        this._beginPhaseEntrance();
        this.ui.showStatus(`Fase ${phase.number}: ${phase.title}. ${phase.description}`);
      }
    }

    _getNextPhase() {
      const currentIndex = PHASES.findIndex((phase) => phase.id === this.currentPhase.id);
      return PHASES[currentIndex + 1] ?? null;
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    window.sortFactoryGame = new SortFactoryGame();
  });
})(window.SortFactory || (window.SortFactory = {}));
