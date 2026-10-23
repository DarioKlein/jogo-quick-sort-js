(function initializeInputController(namespace) {
  "use strict";

  class InputController {
    constructor() {
      this.keysDown = new Set();
      this.interactionQueued = false;
      this.enabled = true;

      this._onKeyDown = this._onKeyDown.bind(this);
      this._onKeyUp = this._onKeyUp.bind(this);
      this.clear = this.clear.bind(this);

      window.addEventListener("keydown", this._onKeyDown, { passive: false });
      window.addEventListener("keyup", this._onKeyUp, { passive: false });
      window.addEventListener("blur", this.clear);
    }

    getMovementVector() {
      if (!this.enabled) return { x: 0, y: 0 };

      const left = this._hasAny("KeyA", "ArrowLeft");
      const right = this._hasAny("KeyD", "ArrowRight");
      const up = this._hasAny("KeyW", "ArrowUp");
      const down = this._hasAny("KeyS", "ArrowDown");
      let x = Number(right) - Number(left);
      let y = Number(down) - Number(up);

      if (x !== 0 && y !== 0) {
        const diagonalScale = Math.SQRT1_2;
        x *= diagonalScale;
        y *= diagonalScale;
      }

      return { x, y };
    }

    consumeInteraction() {
      if (!this.enabled || !this.interactionQueued) return false;
      this.interactionQueued = false;
      return true;
    }

    clear() {
      this.keysDown.clear();
      this.interactionQueued = false;
    }

    destroy() {
      window.removeEventListener("keydown", this._onKeyDown);
      window.removeEventListener("keyup", this._onKeyUp);
      window.removeEventListener("blur", this.clear);
    }

    _hasAny(...codes) {
      return codes.some((code) => this.keysDown.has(code));
    }

    _onKeyDown(event) {
      const controlledKeys = [
        "KeyW",
        "KeyA",
        "KeyS",
        "KeyD",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "KeyE",
        "Space",
      ];

      if (controlledKeys.includes(event.code)) {
        event.preventDefault();
      }

      if (!this.enabled) return;

      if ((event.code === "KeyE" || event.code === "Space") && !event.repeat) {
        this.interactionQueued = true;
      }

      this.keysDown.add(event.code);
    }

    _onKeyUp(event) {
      if (event.code.startsWith("Arrow") || event.code === "Space") {
        event.preventDefault();
      }
      this.keysDown.delete(event.code);
    }
  }

  namespace.InputController = InputController;
})(window.SortFactory || (window.SortFactory = {}));
