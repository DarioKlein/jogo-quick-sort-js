(function initializeGame(namespace) {
  "use strict";

  const {
    WIDTH,
    HEIGHT,
    BOX_START_X,
    BOX_GAP,
    INTERACTION_Y,
    INTERACTION_DISTANCE,
    SWAP_DURATION,
    GameState,
  } = namespace.Constants;
  const { clamp } = namespace.Utils;

  class SortFactoryGame {
    constructor() {
      this.canvas = document.querySelector("#game-canvas");
      this.engine = new namespace.QuickSortEngine();
      this.input = new namespace.InputController();
      this.ui = new namespace.UiController();
      this.renderer = new namespace.Renderer(this.canvas);

      this.robot = this._createRobot();
      this.nearbyIndex = null;
      this.swapAnimation = null;
      this.paused = false;
      this.modalOpen = true;
      this.victoryShown = false;
      this.lastFrameTime = performance.now();
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

      this._bindEvents();
      this.engine.subscribe((snapshot) => this._handleStateChange(snapshot));
      this.ui.update(this.engine.getSnapshot());
      this.input.enabled = false;
      this.canvas.setAttribute("aria-describedby", "objective");

      this._frame = this._frame.bind(this);
      requestAnimationFrame(this._frame);
    }

    restart() {
      this.swapAnimation = null;
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
        window.setTimeout(() => this.ui.showVictory(snapshot), 900);
      }
    }

    _frame(time) {
      const delta = Math.min((time - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = time;

      if (!this.paused && !this.modalOpen && !this.victoryShown) {
        this._update(delta, time);
      }

      const snapshot = this.engine.getSnapshot();
      const animationForFrame = this.swapAnimation
        ? {
            ...this.swapAnimation,
            progress: clamp((time - this.swapAnimation.startedAt) / this.swapAnimation.duration, 0, 1),
          }
        : null;

      this.renderer.draw({
        time,
        snapshot,
        robot: this.robot,
        nearbyIndex: this.nearbyIndex,
        swapAnimation: animationForFrame,
        paused: this.paused,
        modalOpen: this.modalOpen || this.victoryShown,
        victory: snapshot.state === GameState.VICTORY,
      });

      requestAnimationFrame(this._frame);
    }

    _update(delta, time) {
      if (this.swapAnimation) {
        const progress = (time - this.swapAnimation.startedAt) / this.swapAnimation.duration;
        if (progress >= 1) {
          const { a, b, pivot } = this.swapAnimation;
          this.swapAnimation = null;
          this.engine.completeSwap(a, b);
          this.ui.showStatus(
            pivot ? "Pivô colocado em sua posição definitiva." : "Caixas trocadas corretamente.",
          );
        }
        return;
      }

      this._updateRobot(delta);
      this.nearbyIndex = this._findNearbyBox();

      if (this.input.consumeInteraction()) {
        this._interact();
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
        this._beginSwap(result);
      }
    }

    _beginSwap({ a, b, pivot }) {
      const duration = this.reducedMotion.matches || a === b ? 180 : SWAP_DURATION;
      this.swapAnimation = {
        a,
        b,
        pivot,
        startedAt: performance.now(),
        duration,
      };
    }

    _createRobot() {
      return { x: BOX_START_X, y: 584, facing: 1, moving: false };
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    window.sortFactoryGame = new SortFactoryGame();
  });
})(window.SortFactory || (window.SortFactory = {}));
