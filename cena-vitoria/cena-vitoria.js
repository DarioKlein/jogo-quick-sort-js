(function initializeVictoryScene(namespace) {
  "use strict";

  const SPEECH = "Muito bom, mas dá pra melhorar!";
  const WORDS = SPEECH.split(" ");
  const FALLBACK_DURATION = 2780;
  const SPRITES = {
    engineer: "/assets/victory/sprites/portrait-talk.png?v=20261110-6"
  };
  const audio = new Audio(
    namespace.VICTORY_AUDIO_SOURCE ||
      "/assets/muito_bom_mas_da_pra_melhorar.ogg"
  );
  audio.preload = "auto";
  audio.volume = 0.8;

  class VictoryScene {
    constructor() {
      this.audio = audio;
      this.active = false;
      this.frame = null;
      this.exitTimer = null;
      this.root = document.createElement("section");
      this.root.className = "engineer-scene";
      this.root.hidden = true;
      this.root.setAttribute("role", "dialog");
      this.root.setAttribute("aria-modal", "true");
      this.root.setAttribute("aria-label", "Mensagem do Engenheiro Sábio");
      this.root.innerHTML = `
        <div class="engineer-scene__stage">
          <span class="engineer-scene__accent" aria-hidden="true"></span>
          <figure class="engineer-scene__character">
            <div class="engineer-scene__sprite" role="img" aria-label="Engenheiro Sábio segurando um cajado com lâmpada">
              <span class="engineer-scene__sprite-layer" aria-hidden="true"></span>
              <i class="engineer-scene__lamp-glow" aria-hidden="true"></i>
            </div>
          </figure>
          <div class="engineer-scene__message">
            <p class="engineer-scene__eyebrow"><span></span> LINHA RESTAURADA · MISSÃO CUMPRIDA</p>
            <h2 class="engineer-scene__title">Uma palavra do engenheiro</h2>
            <div class="engineer-dialog" aria-label="${SPEECH}">
              <i class="engineer-dialog__screw engineer-dialog__screw--tl" aria-hidden="true"></i>
              <i class="engineer-dialog__screw engineer-dialog__screw--tr" aria-hidden="true"></i>
              <i class="engineer-dialog__screw engineer-dialog__screw--bl" aria-hidden="true"></i>
              <i class="engineer-dialog__screw engineer-dialog__screw--br" aria-hidden="true"></i>
              <div class="engineer-dialog__inner">
                <div class="engineer-dialog__portrait" aria-hidden="true"></div>
                <div class="engineer-dialog__copy">
                  <strong class="engineer-dialog__name">ENGENHEIRO SÁBIO</strong>
                  <p class="engineer-dialog__text" aria-hidden="true"></p>
                </div>
                <span class="engineer-dialog__gear" aria-hidden="true">⚙</span>
                <span class="engineer-dialog__continue" aria-hidden="true">◆</span>
              </div>
            </div>
            <section class="engineer-scene__result" data-result-panel hidden aria-label="Resultados da run">
              <p class="victory-phase" data-result="phase"></p>
              <div class="victory-stats engineer-scene__result-stats">
                <span>Pontuação <strong data-result="score">0</strong></span>
                <span>Tempo <strong data-result="time">00:00</strong></span>
                <span>Erros <strong data-result="errors">0</strong></span>
                <span>Posição <strong data-result="rank">—</strong></span>
              </div>
              <p class="victory-lesson engineer-scene__result-lesson" data-result="lesson"></p>
            </section>
            <p class="engineer-scene__notice" role="status"></p>
            <div class="engineer-scene__controls">
              <button type="button" data-action="continue" hidden>Continuar</button>
            </div>
          </div>
        </div>`;
      document.body.append(this.root);
      this.root.tabIndex = -1;

      this.sprite = this.root.querySelector(".engineer-scene__sprite-layer");
      this.dialog = this.root.querySelector(".engineer-dialog");
      this.words = this.root.querySelector(".engineer-dialog__text");
      this.title = this.root.querySelector(".engineer-scene__title");
      this.notice = this.root.querySelector(".engineer-scene__notice");
      this.resultPanel = this.root.querySelector("[data-result-panel]");
      this.resultNodes = {
        phase: this.root.querySelector('[data-result="phase"]'),
        score: this.root.querySelector('[data-result="score"]'),
        time: this.root.querySelector('[data-result="time"]'),
        errors: this.root.querySelector('[data-result="errors"]'),
        rank: this.root.querySelector('[data-result="rank"]'),
        lesson: this.root.querySelector('[data-result="lesson"]'),
      };
      this.continue = this.root.querySelector('[data-action="continue"]');
      this.wordNodes = WORDS.map((word, index) => {
        const span = document.createElement("span");
        span.textContent = `${word}${index < WORDS.length - 1 ? " " : ""}`;
        if (word.toLocaleLowerCase("pt-BR").replace(/[^\p{L}]/gu, "") === "melhorar")
          span.className = "is-emphasis";
        this.words.append(span);
        return span;
      });

      this.sprite.style.backgroundImage = `url("${SPRITES.engineer}")`;
      Object.values(SPRITES).forEach((src) => {
        const image = new Image();
        image.decoding = "async";
        image.src = src;
      });

      this.continue.onclick = () => this.finish();
      this.root.addEventListener("keydown", (event) =>
        this.handleKeydown(event)
      );
      this.audio.addEventListener("ended", () => {
        if (this.active && this.state === "talk") this.completeSpeech();
      });
      this.audio.addEventListener("error", () => {
        if (this.active && this.state === "talk") this.fallback();
      });
    }

    start(result, onComplete) {
      this.cancel();
      this.active = true;
      this.onComplete = onComplete;
      const hasResults = Boolean(result);
      this.reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      this.root.hidden = false;
      this.root.classList.remove("is-leaving");
      this.root.classList.toggle("engineer-scene--with-results", hasResults);
      this.root.dataset.reduced = String(this.reduced);
      this.root.dataset.bubble = "closed";
      this.root.setAttribute(
        "aria-label",
        hasResults
          ? "Resultado final e mensagem do Engenheiro Sábio"
          : "Mensagem do Engenheiro Sábio"
      );
      this.title.textContent = hasResults
        ? "Run concluída!"
        : "Uma palavra do engenheiro";
      this.resultPanel.hidden = !hasResults;
      this.continue.textContent = hasResults ? "Jogar novamente" : "Continuar";
      if (hasResults) {
        this.resultNodes.phase.textContent = result.phaseLabel;
        this.resultNodes.score.textContent = result.score;
        this.resultNodes.time.textContent = result.time;
        this.resultNodes.errors.textContent = result.errors;
        this.resultNodes.rank.textContent = result.rank;
        this.resultNodes.lesson.textContent = result.lesson;
      }
      this.notice.textContent = "";
      this.continue.hidden = true;
      this.fallbackAt = null;
      this.speechCompleteAt = null;
      this.lastAudioTime = 0;
      this.lastProgressAt = performance.now();
      this.showWords(this.reduced ? WORDS.length : 0);
      this.setState("enter");
      this.root.focus();
      this.tick();
    }

    setState(state) {
      this.state = state;
      this.stateAt = performance.now();
      this.root.dataset.state = state;
    }

    async playSpeech() {
      if (!this.active || this.state === "cheer" || this.state === "final")
        return;
      const generation = ++this.generation;
      this.setState("talk");
      this.root.dataset.bubble = this.reduced ? "talking" : "opening";
      this.continue.hidden = true;
      this.fallbackAt = null;
      this.speechCompleteAt = null;
      this.audio.currentTime = 0;
      this.lastAudioTime = 0;
      this.lastProgressAt = performance.now();
      try {
        this.audio.load();
        await this.audio.play();
        if (!this.active || generation !== this.generation) return;
        this.notice.textContent = "";
      } catch (error) {
        if (
          this.active &&
          generation === this.generation &&
          this.state === "talk"
        )
          this.fallback(error);
      }
    }

    fallback(error) {
      this.audio.pause();
      this.fallbackAt ??= performance.now();
      this.notice.textContent =
        error?.name === "NotAllowedError"
          ? "O navegador bloqueou o som. A legenda continuará automaticamente."
          : "Não foi possível reproduzir o áudio. A legenda continuará automaticamente.";
    }

    completeSpeech() {
      if (this.speechCompleteAt !== null) return;
      this.audio.pause();
      this.showWords(WORDS.length);
      this.root.dataset.bubble = "completed";
      this.speechCompleteAt = performance.now();
    }

    celebrate() {
      this.generation += 1;
      this.audio.pause();
      this.showWords(WORDS.length);
      this.setState("cheer");
    }

    showFinal() {
      this.setState("final");
      this.root.dataset.bubble = "completed";
      this.continue.hidden = false;
      this.continue.focus();
    }

    showWords(count) {
      this.wordNodes.forEach((word, index) =>
        word.classList.toggle("is-visible", index < count)
      );
    }

    tick = () => {
      if (!this.active) return;
      const now = performance.now();
      const elapsed = now - this.stateAt;

      if (this.state === "enter" && elapsed >= (this.reduced ? 0 : 600)) {
        this.playSpeech();
      } else if (this.state === "talk") {
        if (
          !this.reduced &&
          elapsed >= 220 &&
          this.root.dataset.bubble === "opening"
        ) {
          this.root.dataset.bubble = "talking";
        }
        if (this.audio.currentTime !== this.lastAudioTime) {
          this.lastAudioTime = this.audio.currentTime;
          this.lastProgressAt = now;
        }
        if (
          this.fallbackAt === null &&
          this.speechCompleteAt === null &&
          now - this.lastProgressAt > 4000
        ) {
          this.fallback();
        }
        if (this.speechCompleteAt === null) {
          const ratio =
            this.fallbackAt !== null
              ? (now - this.fallbackAt) / FALLBACK_DURATION
              : this.audio.currentTime / (this.audio.duration || Infinity);
          this.showWords(
            this.reduced
              ? WORDS.length
              : Math.ceil(WORDS.length * Math.max(0, ratio))
          );
          if (ratio >= 1) this.completeSpeech();
        } else if (now - this.speechCompleteAt >= 1000) {
          this.celebrate();
        }
      } else if (this.state === "cheer") {
        if (elapsed >= (this.reduced ? 0 : 1180)) this.showFinal();
      }
      this.frame = requestAnimationFrame(this.tick);
    };

    handleKeydown(event) {
      event.stopPropagation();
      if (this.state !== "final") {
        event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;
      event.preventDefault();
      this.continue.focus();
    }

    finish() {
      if (
        !this.active ||
        this.state !== "final" ||
        this.root.classList.contains("is-leaving")
      )
        return;
      this.generation += 1;
      const done = this.onComplete;
      this.active = false;
      cancelAnimationFrame(this.frame);
      this.audio.pause();
      this.root.classList.add("is-leaving");
      this.exitTimer = window.setTimeout(
        () => {
          this.root.hidden = true;
          this.root.classList.remove("is-leaving");
          this.onComplete = null;
          done?.();
        },
        this.reduced ? 0 : 220
      );
    }

    cancel() {
      this.generation = (this.generation || 0) + 1;
      this.active = false;
      cancelAnimationFrame(this.frame);
      window.clearTimeout(this.exitTimer);
      this.audio.pause();
      this.root.hidden = true;
      this.root.classList.remove("is-leaving");
      this.onComplete = null;
    }
  }

  namespace.VictoryScene = VictoryScene;
})(window.SortFactory || (window.SortFactory = {}));
