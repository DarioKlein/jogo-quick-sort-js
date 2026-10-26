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
    GameState,
    PHASES,
  } = namespace.Constants;
  const { clamp } = namespace.Utils;

  class SortFactoryGame {
    constructor() {
      this.canvas = document.querySelector("#game-canvas");
      this.engine = new namespace.QuickSortEngine();
      this.input = new namespace.InputController();
      this.ui = new namespace.UiController();
      this.renderer = new namespace.Renderer(this.canvas);
      this.currentPhase = PHASES[0];

      this.robot = this._createRobot();
      this.nearbyIndex = null;
      this.manualSwap = null;
      this.paused = false;
      this.modalOpen = true;
      this.victoryShown = false;
      this.lastFrameTime = performance.now();
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

      this._bindEvents();
      this.engine.subscribe((snapshot) => this._handleStateChange(snapshot));
      this.ui.setPhase(this.currentPhase);
      this.ui.update(this.engine.getSnapshot());
      this.input.enabled = false;
      this.canvas.setAttribute("aria-describedby", "objective");

      this._frame = this._frame.bind(this);
      requestAnimationFrame(this._frame);
    }

    restart() {
      this.manualSwap = null;
      this.renderer.resetEffects();
      this.robot = this._createRobot();
      this.nearbyIndex = null;
      this.paused = false;
      this.victoryShown = false;
      this.ui.hideVictory();
      this.engine.reset();
      this.input.clear();
      this.input.enabled = !this.modalOpen;
      this.ui.showStatus("Linha reiniciada. O vetor voltou ao estado inicial.");
      this.canvas.focus();
    }

    _bindEvents() {
      this.ui.onTutorialVisibilityChange = (isOpen) => {
        this.modalOpen = isOpen;
        this.input.enabled = !isOpen && !this.victoryShown;
        this.input.clear();
        if (!isOpen) this.canvas.focus();
      };
      this.ui.onRestart = () => this.restart();
      this.ui.onStart = (pivotStrategy, phaseId) => this._startPhase(phaseId, pivotStrategy, true);
      this.ui.onPlayAgain = () => this._returnToStartMenu();
      this.ui.onNextPhase = () => {
        const nextPhase = this._getNextPhase();
        if (nextPhase) this._startPhase(nextPhase.id, this.engine.pivotStrategy, false);
      };

      window.addEventListener("blur", () => {
        if (!this.modalOpen && !this.victoryShown) this.paused = true;
      });
      this.canvas.addEventListener("pointerdown", () => {
        if (!this.modalOpen && !this.victoryShown) {
          this.paused = false;
          this.canvas.focus();
        }
      });
      this.canvas.addEventListener("keydown", () => {
        if (!this.modalOpen && !this.victoryShown) this.paused = false;
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden && !this.modalOpen && !this.victoryShown) this.paused = true;
      });
    }

    _handleStateChange(snapshot) {
      this.ui.update(snapshot);
      if (snapshot.state === GameState.VICTORY && !this.victoryShown) {
        this.victoryShown = true;
        this.input.enabled = false;
        this.renderer.celebrate();
        const nextPhase = this._getNextPhase();
        window.setTimeout(() => this.ui.showVictory(snapshot, this.currentPhase, nextPhase), 900);
      }
    }

    _frame(time) {
      const delta = Math.min((time - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = time;

      if (!this.paused && !this.modalOpen && !this.victoryShown) {
        this._update(delta, time);
      }

      const snapshot = this.engine.getSnapshot();
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
        victory: snapshot.state === GameState.VICTORY,
      });

      requestAnimationFrame(this._frame);
    }

    _update(delta, time) {
      if (this.manualSwap && this.manualSwap.phase !== "carry-back") {
        const duration = this._getManualPhaseDuration(this.manualSwap.phase);
        const progress = (time - this.manualSwap.startedAt) / duration;
        if (progress >= 1) this._advanceManualSwap(time);
        return;
      }

      this._updateRobot(delta);
      this.nearbyIndex = this._findNearbyBox();

      if (this.input.consumeInteraction()) {
        if (this.manualSwap?.phase === "carry-back") {
          this._placeDisplacedBox();
        } else {
          this._interact();
        }
      }
    }

    _updateRobot(delta) {
      const movement = this.input.getMovementVector();
      const speed = 260;
      this.robot.x = clamp(this.robot.x + movement.x * speed * delta, 90, WIDTH - 90);
      this.robot.y = clamp(this.robot.y + movement.y * speed * delta, 500, HEIGHT - 77);
      this.robot.moving = movement.x !== 0 || movement.y !== 0;
      if (movement.x !== 0) this.robot.facing = movement.x > 0 ? 1 : -1;
    }

    _findNearbyBox() {
      let nearest = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      const values = this.engine.values;

      values.forEach((_, index) => {
        const x = BOX_START_X + BOX_GAP * index;
        const dx = this.robot.x - x;
        const dy = this.robot.y - INTERACTION_Y;
        const distance = Math.hypot(dx, dy * 0.7);
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

      if (result.type === "inspection" || result.type === "selected" || result.type === "deselected") {
        this.ui.showStatus(this.engine.message);
      }

      if (result.type === "swap-requested") {
        this._beginManualSwap(result);
      }
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
        this.engine.rejectInteraction(message, 40);
        this.ui.setObjective(message);
        this.ui.showStatus(message, true);
        return;
      }

      this.manualSwap.phase = "placing";
      this.manualSwap.startedAt = performance.now();
      this.ui.setObjective(`Colocando a caixa na posição ${destinationIndex + 1}…`);
    }

    _getManualPhaseDuration(phase) {
      const duration = phase === "handoff" ? HANDOFF_DURATION : PLACE_DURATION;
      return this.reducedMotion.matches ? Math.min(duration, 180) : duration;
    }

    _createRobot() {
      return { x: BOX_START_X, y: 584, facing: 1, moving: false };
    }

    _startPhase(phaseId, pivotStrategy, showTutorial) {
      const phase = PHASES.find((candidate) => candidate.id === phaseId) ?? PHASES[0];
      this.currentPhase = phase;
      this.manualSwap = null;
      this.renderer.resetEffects();
      this.robot = this._createRobot();
      this.nearbyIndex = null;
      this.paused = false;
      this.victoryShown = false;
      this.ui.hideVictory();
      this.ui.setPhase(phase);
      this.engine.configure(phase.values[pivotStrategy], pivotStrategy);
      this.input.clear();

      if (showTutorial) {
        this.ui.openTutorial(true);
      } else {
        this.modalOpen = false;
        this.input.enabled = true;
        this.canvas.focus();
        this.ui.showStatus(`Fase ${phase.number}: ${phase.title}. ${phase.description}`);
      }
    }

    _getNextPhase() {
      const currentIndex = PHASES.findIndex((phase) => phase.id === this.currentPhase.id);
      return PHASES[currentIndex + 1] ?? null;
    }

    _returnToStartMenu() {
      this.manualSwap = null;
      this.renderer.resetEffects();
      this.robot = this._createRobot();
      this.nearbyIndex = null;
      this.paused = false;
      this.victoryShown = false;
      this.input.enabled = false;
      this.input.clear();
      this.ui.hideVictory();
      this.ui.showStartMenu(this.engine.pivotStrategy, this.currentPhase.id);
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    window.sortFactoryGame = new SortFactoryGame();
  });
})(window.SortFactory || (window.SortFactory = {}));
