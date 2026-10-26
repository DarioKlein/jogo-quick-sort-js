(function initializeUiController(namespace) {
  "use strict";

  const { PivotStrategy, PhaseId, PHASES, TUTORIAL_PAGES } = namespace.Constants;

  class UiController {
    constructor() {
      this.elements = {
        objective: document.querySelector("#objective"),
        phaseName: document.querySelector("#phase-name"),
        pivot: document.querySelector("#pivot-value"),
        pivotStrategy: document.querySelector("#pivot-strategy"),
        range: document.querySelector("#active-range"),
        score: document.querySelector("#score"),
        errors: document.querySelector("#errors"),
        array: document.querySelector("#array-readout"),
        status: document.querySelector("#status-message"),
        help: document.querySelector("#help-button"),
        restart: document.querySelector("#restart-button"),
        start: document.querySelector("#start-modal"),
        startMission: document.querySelector("#start-mission-button"),
        pivotOptions: [...document.querySelectorAll("[data-pivot-strategy]")],
        phaseOptions: [...document.querySelectorAll("[data-phase-id]")],
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
        victoryPhase: document.querySelector("#victory-phase"),
        victoryLesson: document.querySelector("#victory-lesson"),
        victoryScore: document.querySelector("#victory-score"),
        victoryErrors: document.querySelector("#victory-errors"),
        nextPhase: document.querySelector("#next-phase-button"),
        playAgain: document.querySelector("#play-again-button"),
      };

      this.tutorialIndex = 0;
      this.selectedPivotStrategy = PivotStrategy.FIRST;
      this.selectedPhaseId = PhaseId.AVERAGE;
      this.currentPhase = PHASES[0];
      this.statusTimer = null;
      this.onTutorialVisibilityChange = () => {};
      this.onRestart = () => {};
      this.onStart = () => {};
      this.onPlayAgain = () => {};
      this.onNextPhase = () => {};

      this._bindEvents();
      this._renderTutorialPage();
    }

    update(snapshot) {
      const { elements } = this;
      elements.objective.textContent = snapshot.objective;
      elements.pivot.textContent = snapshot.pivotValue ?? "—";
      elements.pivotStrategy.textContent = snapshot.pivotStrategy === PivotStrategy.LAST
        ? "FINAL"
        : "INÍCIO";
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

    setObjective(message) {
      this.elements.objective.textContent = message;
    }

    setPhase(phase) {
      this.currentPhase = phase;
      this.selectedPhaseId = phase.id;
      this.elements.phaseName.textContent = `${phase.number} · ${phase.shortTitle}`;
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

    showStartMenu(pivotStrategy = PivotStrategy.FIRST, phaseId = PhaseId.AVERAGE) {
      this.selectPivotStrategy(pivotStrategy);
      this.selectPhase(phaseId);
      this.elements.victory.classList.add("modal--hidden");
      this.elements.tutorial.classList.add("modal--hidden");
      this.elements.start.classList.remove("modal--hidden");
      this.onTutorialVisibilityChange(true);
      window.setTimeout(() => this.elements.pivotOptions[0].focus(), 0);
    }

    hideStartMenu() {
      this.elements.start.classList.add("modal--hidden");
    }

    selectPivotStrategy(pivotStrategy) {
      this.selectedPivotStrategy = pivotStrategy;
      this.elements.pivotOptions.forEach((option) => {
        const selected = option.dataset.pivotStrategy === pivotStrategy;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
    }

    selectPhase(phaseId) {
      this.selectedPhaseId = phaseId;
      this.elements.phaseOptions.forEach((option) => {
        const selected = option.dataset.phaseId === phaseId;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
    }

    closeTutorial() {
      this.elements.tutorial.classList.add("modal--hidden");
      this.onTutorialVisibilityChange(false);
      this.elements.help.focus();
    }

    isTutorialOpen() {
      return !this.elements.tutorial.classList.contains("modal--hidden");
    }

    showVictory(snapshot, phase, nextPhase) {
      this.elements.victoryArray.textContent = `[${snapshot.values.join(", ")}]`;
      this.elements.victoryPhase.textContent = `FASE ${phase.number} — ${phase.title.toUpperCase()} • ${phase.complexity}`;
      this.elements.victoryLesson.textContent = phase.lesson;
      this.elements.victoryScore.textContent = snapshot.score;
      this.elements.victoryErrors.textContent = snapshot.errors;
      this.elements.nextPhase.classList.toggle("modal--hidden", !nextPhase);
      if (nextPhase) {
        this.elements.nextPhase.textContent = `Próxima fase: ${nextPhase.title}`;
      }
      this.elements.victory.classList.remove("modal--hidden");
      window.setTimeout(
        () => (nextPhase ? this.elements.nextPhase : this.elements.playAgain).focus(),
        0,
      );
    }

    hideVictory() {
      this.elements.victory.classList.add("modal--hidden");
    }

    _bindEvents() {
      this.elements.help.addEventListener("click", () => this.openTutorial(true));
      this.elements.restart.addEventListener("click", () => this.onRestart());
      this.elements.playAgain.addEventListener("click", () => this.onPlayAgain());
      this.elements.nextPhase.addEventListener("click", () => this.onNextPhase());
      this.elements.pivotOptions.forEach((option) => {
        option.addEventListener("click", () => this.selectPivotStrategy(option.dataset.pivotStrategy));
      });
      this.elements.phaseOptions.forEach((option) => {
        option.addEventListener("click", () => this.selectPhase(option.dataset.phaseId));
      });
      this.elements.startMission.addEventListener("click", () => {
        this.hideStartMenu();
        this.onStart(this.selectedPivotStrategy, this.selectedPhaseId);
      });
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
      const selectedPhase = PHASES.find((phase) => phase.id === this.selectedPhaseId) ?? PHASES[0];
      this.elements.tutorialTitle.textContent = page.title;
      const pivotText = this.selectedPivotStrategy === PivotStrategy.LAST
        ? "Você escolheu o pivô no final: a última caixa de cada trecho será a referência da partição."
        : "Você escolheu o pivô no início: a primeira caixa de cada trecho será a referência da partição.";
      const phaseText = `Fase ${selectedPhase.number} — ${selectedPhase.title}: ${selectedPhase.description}`;
      this.elements.tutorialText.textContent = this.tutorialIndex === 0
        ? phaseText
        : this.tutorialIndex === 2
          ? pivotText
          : page.text;
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
