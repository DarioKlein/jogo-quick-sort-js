(function initializeUiController(namespace) {
  "use strict";

  const { GameState, TUTORIAL_PAGES } = namespace.Constants;

  class UiController {
    constructor() {
      this.elements = {
        objective: document.querySelector("#objective"),
        pivot: document.querySelector("#pivot-value"),
        range: document.querySelector("#active-range"),
        score: document.querySelector("#score"),
        errors: document.querySelector("#errors"),
        array: document.querySelector("#array-readout"),
        status: document.querySelector("#status-message"),
        help: document.querySelector("#help-button"),
        restart: document.querySelector("#restart-button"),
        tutorial: document.querySelector("#tutorial-modal"),
        tutorialTitle: document.querySelector("#tutorial-title"),
        tutorialText: document.querySelector("#tutorial-text"),
        tutorialArt: document.querySelector("#tutorial-illustration"),
        tutorialDots: document.querySelector("#tutorial-dots"),
        tutorialBack: document.querySelector("#tutorial-back"),
        tutorialNext: document.querySelector("#tutorial-next"),
        tutorialSkip: document.querySelector("#tutorial-skip"),
        victory: document.querySelector("#victory-modal"),
        victoryArray: document.querySelector("#victory-array"),
        victoryScore: document.querySelector("#victory-score"),
        victoryErrors: document.querySelector("#victory-errors"),
        playAgain: document.querySelector("#play-again-button"),
      };

      this.tutorialIndex = 0;
      this.statusTimer = null;
      this.onTutorialVisibilityChange = () => {};
      this.onRestart = () => {};

      this._bindEvents();
      this._renderTutorialPage();
    }

    update(snapshot) {
      const { elements } = this;
      elements.objective.textContent = snapshot.objective;
      elements.pivot.textContent = snapshot.pivotValue ?? "—";
      elements.range.textContent = snapshot.segment
        ? `${snapshot.segment.start + 1}–${snapshot.segment.end + 1}`
        : "—";
      elements.score.textContent = snapshot.score;
      elements.errors.textContent = snapshot.errors;
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

    showStatus(message, isError = false, duration = 2600) {
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

    closeTutorial() {
      this.elements.tutorial.classList.add("modal--hidden");
      this.onTutorialVisibilityChange(false);
      this.elements.help.focus();
    }

    isTutorialOpen() {
      return !this.elements.tutorial.classList.contains("modal--hidden");
    }

    showVictory(snapshot) {
      this.elements.victoryArray.textContent = `[${snapshot.values.join(", ")}]`;
      this.elements.victoryScore.textContent = snapshot.score;
      this.elements.victoryErrors.textContent = snapshot.errors;
      this.elements.victory.classList.remove("modal--hidden");
      window.setTimeout(() => this.elements.playAgain.focus(), 0);
    }

    hideVictory() {
      this.elements.victory.classList.add("modal--hidden");
    }

    _bindEvents() {
      this.elements.help.addEventListener("click", () => this.openTutorial(true));
      this.elements.restart.addEventListener("click", () => this.onRestart());
      this.elements.playAgain.addEventListener("click", () => this.onRestart());
      this.elements.tutorialSkip.addEventListener("click", () => this.closeTutorial());
      this.elements.tutorialBack.addEventListener("click", () => {
        this.tutorialIndex = Math.max(0, this.tutorialIndex - 1);
        this._renderTutorialPage();
      });
      this.elements.tutorialNext.addEventListener("click", () => {
        if (this.tutorialIndex === TUTORIAL_PAGES.length - 1) {
          this.closeTutorial();
          return;
        }
        this.tutorialIndex += 1;
        this._renderTutorialPage();
      });

      document.addEventListener("keydown", (event) => {
        if (event.code === "Escape" && this.isTutorialOpen()) {
          event.preventDefault();
          this.closeTutorial();
        }
      });
    }

    _renderTutorialPage() {
      const page = TUTORIAL_PAGES[this.tutorialIndex];
      this.elements.tutorialTitle.textContent = page.title;
      this.elements.tutorialText.textContent = page.text;
      this.elements.tutorialArt.style.setProperty("--tutorial-art", page.art);
      this.elements.tutorialBack.disabled = this.tutorialIndex === 0;
      this.elements.tutorialNext.textContent = this.tutorialIndex === TUTORIAL_PAGES.length - 1
        ? "Iniciar missão"
        : "Avançar";
      this.elements.tutorialDots.replaceChildren(
        ...TUTORIAL_PAGES.map((_, index) => {
          const dot = document.createElement("i");
          dot.classList.toggle("is-active", index === this.tutorialIndex);
          return dot;
        }),
      );
    }
  }

  namespace.UiController = UiController;
})(window.SortFactory || (window.SortFactory = {}));
