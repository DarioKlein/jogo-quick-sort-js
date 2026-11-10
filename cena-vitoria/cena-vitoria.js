(function initializeVictoryScene(namespace) {
  "use strict";

  const SPEECH = "Muito bom, mas dá pra melhorar";
  const WORDS = SPEECH.split(" ");
  const FALLBACK_DURATION = 2780;
  const SPRITES = {
    engineer: "/assets/victory/sprites/portrait-talk.png?v=20261110-5",
  };
  const audio = new Audio(
    namespace.VICTORY_AUDIO_SOURCE || "/assets/muito_bom_mas_da_pra_melhorar.ogg",
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
            <h2>Uma palavra do engenheiro</h2>
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
            <p class="engineer-scene__notice" role="status"></p>
            <div class="engineer-scene__controls">
              <button type="button" data-action="listen" hidden>Ouvir fala</button>
              <button type="button" data-action="mute" aria-pressed="false">Silenciar</button>
              <button type="button" data-action="skip">Pular fala</button>
              <button type="button" data-action="continue" hidden>Continuar</button>
            </div>
          </div>
        </div>`;
      document.body.append(this.root);

      this.sprite = this.root.querySelector(".engineer-scene__sprite-layer");
      this.dialog = this.root.querySelector(".engineer-dialog");
      this.words = this.root.querySelector(".engineer-dialog__text");
      this.notice = this.root.querySelector(".engineer-scene__notice");
      this.listen = this.root.querySelector('[data-action="listen"]');
      this.skip = this.root.querySelector('[data-action="skip"]');
      this.continue = this.root.querySelector('[data-action="continue"]');
      this.mute = this.root.querySelector('[data-action="mute"]');
      this.wordNodes = WORDS.map((word, index) => {
        const span = document.createElement("span");
        span.textContent = `${word}${index < WORDS.length - 1 ? " " : ""}`;
        if (word.toLocaleLowerCase("pt-BR") === "melhorar") span.className = "is-emphasis";
        this.words.append(span);
        return span;
      });

      this.sprite.style.backgroundImage = `url("${SPRITES.engineer}")`;
      Object.values(SPRITES).forEach(src => {
        const image = new Image();
        image.decoding = "async";
        image.src = src;
      });

      this.listen.onclick = () => this.playSpeech(true);
      this.skip.onclick = () => this.skipSpeech();
      this.continue.onclick = () => this.finish();
      this.mute.onclick = () => {
        this.audio.muted = !this.audio.muted;
        this.mute.setAttribute("aria-pressed", String(this.audio.muted));
        this.mute.textContent = this.audio.muted ? "Ativar som" : "Silenciar";
      };
      this.root.addEventListener("keydown", event => this.handleKeydown(event));
      this.audio.addEventListener("ended", () => {
        if (this.active && this.state === "talk") this.completeSpeech();
      });
      this.audio.addEventListener("error", () => {
        if (this.active && this.state === "talk") this.fallback();
      });
    }

    start(onComplete) {
      this.cancel();
      this.active = true;
      this.onComplete = onComplete;
      this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.root.hidden = false;
      this.root.classList.remove("is-leaving");
      this.root.dataset.reduced = String(this.reduced);
      this.root.dataset.bubble = "closed";
      this.notice.textContent = "";
      this.listen.hidden = true;
      this.continue.hidden = true;
      this.skip.hidden = false;
      this.skip.textContent = "Pular fala";
      this.fallbackAt = null;
      this.speechCompleteAt = null;
      this.lastAudioTime = 0;
      this.lastProgressAt = performance.now();
      this.showWords(this.reduced ? WORDS.length : 0);
      this.setState("enter");
      this.skip.focus();
      this.tick();
    }

    setState(state) {
      this.state = state;
      this.stateAt = performance.now();
      this.root.dataset.state = state;
    }

    async playSpeech(forceReplay = false) {
      if (!this.active || (!forceReplay && (this.state === "cheer" || this.state === "final"))) return;
      const generation = ++this.generation;
      if (forceReplay) {
        this.showWords(this.reduced ? WORDS.length : 0);
      }
      this.setState("talk");
      this.root.dataset.bubble = this.reduced ? "talking" : "opening";
      this.continue.hidden = true;
      this.skip.hidden = false;
      this.fallbackAt = null;
      this.speechCompleteAt = null;
      this.audio.currentTime = 0;
      this.lastAudioTime = 0;
      this.lastProgressAt = performance.now();
      try {
        this.audio.load();
        await this.audio.play();
        if (!this.active || generation !== this.generation) return;
        this.listen.hidden = true;
        this.notice.textContent = "";
      } catch (error) {
        if (this.active && generation === this.generation && this.state === "talk") this.fallback(error);
      }
    }

    fallback(error) {
      this.audio.pause();
      this.fallbackAt ??= performance.now();
      this.listen.hidden = false;
      this.notice.textContent = error?.name === "NotAllowedError"
        ? "O navegador bloqueou o som. Use “Ouvir fala”; a legenda continua normalmente."
        : "Não foi possível reproduzir o áudio. Use “Ouvir fala” para tentar novamente; a legenda continua.";
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
      this.root.dataset.bubble = "closing";
      this.listen.hidden = this.fallbackAt === null;
      this.skip.hidden = true;
      this.setState("cheer");
      this.mute.focus();
    }

    skipSpeech() {
      if (!this.active) return;
      if (this.state === "cheer") {
        this.showFinal();
        return;
      }
      this.celebrate();
    }

    showFinal() {
      this.setState("final");
      this.root.dataset.bubble = "closed";
      this.continue.hidden = false;
      this.skip.hidden = true;
      this.continue.focus();
    }

    showWords(count) {
      this.wordNodes.forEach((word, index) => word.classList.toggle("is-visible", index < count));
    }

    tick = () => {
      if (!this.active) return;
      const now = performance.now();
      const elapsed = now - this.stateAt;

      if (this.state === "enter" && elapsed >= (this.reduced ? 0 : 600)) {
        this.playSpeech();
      } else if (this.state === "talk") {
        if (!this.reduced && elapsed >= 220 && this.root.dataset.bubble === "opening") {
          this.root.dataset.bubble = "talking";
        }
        if (this.audio.currentTime !== this.lastAudioTime) {
          this.lastAudioTime = this.audio.currentTime;
          this.lastProgressAt = now;
        }
        if (this.fallbackAt === null && this.speechCompleteAt === null && now - this.lastProgressAt > 4000) {
          this.fallback();
        }
        if (this.speechCompleteAt === null) {
          const ratio = this.fallbackAt !== null
            ? (now - this.fallbackAt) / FALLBACK_DURATION
            : this.audio.currentTime / (this.audio.duration || Infinity);
          this.showWords(this.reduced ? WORDS.length : Math.ceil(WORDS.length * Math.max(0, ratio)));
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
      if (event.key === "Escape") {
        event.preventDefault();
        this.finish();
      }
      if (event.key !== "Tab") return;
      const buttons = [...this.root.querySelectorAll("button")].filter(button => !button.hidden);
      const first = buttons[0];
      const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    finish() {
      if (!this.active || this.root.classList.contains("is-leaving")) return;
      this.generation += 1;
      const done = this.onComplete;
      this.active = false;
      cancelAnimationFrame(this.frame);
      this.audio.pause();
      this.root.classList.add("is-leaving");
      this.exitTimer = window.setTimeout(() => {
        this.root.hidden = true;
        this.root.classList.remove("is-leaving");
        this.onComplete = null;
        done?.();
      }, this.reduced ? 0 : 220);
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
