"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let now = 0;
let playCount = 0;
let play = () => Promise.resolve();
const scheduled = new Map();
let timerId = 0;
class Element {
  constructor() {
    this.hidden = false;
    this.dataset = {};
    this.style = {};
    this.nodes = new Map();
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value), remove: value => classes.delete(value),
      contains: value => classes.has(value),
      toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value),
    };
  }
  querySelector(selector) {
    if (!this.nodes.has(selector)) this.nodes.set(selector, new Element());
    return this.nodes.get(selector);
  }
  setAttribute() {}
  append() {}
  addEventListener() {}
  focus() {}
}
class Audio {
  constructor() { this.currentTime = 0; this.duration = 2.78; }
  addEventListener() {}
  load() {}
  pause() {}
  play() { playCount += 1; return play(); }
}
const window = {
  SortFactory: {}, matchMedia: () => ({ matches: false }),
  setTimeout: callback => { scheduled.set(++timerId, callback); return timerId; },
  clearTimeout: id => scheduled.delete(id),
};
const context = {
  window, Audio, Image: class {}, performance: { now: () => now },
  requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  document: { body: new Element(), createElement: () => new Element() },
};
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "cena-vitoria/cena-vitoria.js"), "utf8");
vm.runInNewContext(source, context);

async function run() {
  const scene = new window.SortFactory.VictoryScene();
  const result = {
    phaseLabel: "3 FASES FINALIZADAS",
    score: "3240",
    time: "02:00",
    errors: "4",
    rank: "#1",
    lesson: "Penalidade por tempo: −120 pontos.",
  };
  let completed = 0;
  scene.start(result, () => { completed += 1; });
  assert.equal(scene.state, "enter");
  assert.equal(scene.resultPanel.hidden, false);
  assert.equal(scene.resultNodes.score.textContent, "3240");
  assert.equal(scene.resultNodes.time.textContent, "02:00");
  assert.equal(scene.resultNodes.errors.textContent, "4");
  assert.equal(scene.resultNodes.rank.textContent, "#1");
  assert.equal(scene.title.textContent, "Run concluída!");
  assert.equal(scene.continue.textContent, "Jogar novamente");
  assert.equal(scene.continue.hidden, true);
  assert.ok(
    scene.wordNodes.some((word) => word.textContent.trim() === "melhorar!" && word.className === "is-emphasis"),
    "a palavra melhorar deve receber destaque mesmo com pontuação",
  );

  let interactionPrevented = false;
  scene.handleKeydown({
    key: "Escape",
    preventDefault() { interactionPrevented = true; },
    stopPropagation() {},
  });
  assert.equal(interactionPrevented, true, "Escape não pode interagir durante a fala");
  scene.finish();
  assert.equal(completed, 0, "resultado não pode ser concluído antes da fala");
  assert.equal("skip" in scene, false, "não deve existir atalho para pular a fala");

  now = 600;
  scene.tick();
  await Promise.resolve();
  assert.equal(scene.state, "talk");
  scene.completeSpeech();
  now = 1599;
  scene.tick();
  assert.equal(scene.state, "talk", "deve aguardar a leitura antes do brilho");
  now = 1600;
  scene.tick();
  assert.equal(scene.state, "cheer");
  now = 2780;
  scene.tick();
  assert.equal(scene.state, "final");
  assert.equal(scene.root.dataset.bubble, "completed", "a mensagem deve permanecer visível");
  assert.equal(scene.continue.hidden, false);

  scene.handleKeydown({
    key: "Escape",
    preventDefault() { throw new Error("Escape não deve fechar o resultado"); },
    stopPropagation() {},
  });
  assert.equal(completed, 0);

  scheduled.clear();
  scene.finish();
  for (const callback of [...scheduled.values()]) callback();
  scheduled.clear();
  assert.equal(completed, 1);

  window.matchMedia = () => ({ matches: true });
  const before = playCount;
  scene.start(null, () => {});
  assert.equal(scene.resultPanel.hidden, true);
  assert.equal(scene.title.textContent, "Uma palavra do engenheiro");
  assert.equal(scene.continue.textContent, "Continuar");
  assert.equal(playCount - before, 1, "movimento reduzido deve iniciar áudio uma só vez");
  await Promise.resolve();

  let rejectPlayback;
  play = () => new Promise((resolve, reject) => { rejectPlayback = reject; });
  window.matchMedia = () => ({ matches: false });
  scene.start(null, () => {});
  now = 3600;
  scene.tick();
  await Promise.resolve();
  rejectPlayback(new Error("interrompido"));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(scene.state, "talk");
  assert.ok(scene.fallbackAt !== null, "falha de áudio deve ativar a legenda automática");
  assert.match(scene.notice.textContent, /legenda continuará automaticamente/);

  let lateCompleted = 0;
  scene.cancel();
  scene.start(null, () => { lateCompleted += 1; });
  now = 4200;
  scene.tick();
  await Promise.resolve();
  scene.completeSpeech();
  now = 5200;
  scene.tick();
  now = 6380;
  scene.tick();
  assert.equal(scene.state, "final");
  scheduled.clear();
  scene.finish();
  scene.cancel();
  for (const callback of [...scheduled.values()]) callback();
  assert.equal(lateCompleted, 0, "cancelar deve impedir resultados atrasados após fim da sessão");

  for (const file of ["cena-vitoria/cena-vitoria.js", "cena-vitoria/cena-vitoria.css"]) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    for (const match of text.matchAll(/\/assets\/[\w/.-]+/g)) {
      assert.ok(fs.existsSync(path.join(root, match[0])), `asset ausente: ${match[0]}`);
    }
  }
  const victoryCss = fs.readFileSync(path.join(root, "cena-vitoria/cena-vitoria.css"), "utf8");
  assert.match(victoryCss, /engineer-word-warm 1\.8s linear infinite/);
  assert.match(victoryCss, /background-image: linear-gradient\(90deg, #ffe066, #ffc845, #ff8f3d, #ffe066\)/);
  assert.match(
    victoryCss,
    /\.engineer-scene--with-results \.engineer-scene__controls \{ margin-top: 10px; \}/,
  );
  console.log("✓ Cena de vitória: resultados combinados, bloqueio da fala, cancelamento e assets");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
