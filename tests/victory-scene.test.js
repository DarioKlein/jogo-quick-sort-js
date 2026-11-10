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
      contains: value => classes.has(value), toggle: () => {},
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
  scene.start(() => {});
  assert.equal(scene.state, "enter");
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
  assert.equal(scene.continue.hidden, false);

  window.matchMedia = () => ({ matches: true });
  const before = playCount;
  scene.start(() => {});
  assert.equal(playCount - before, 1, "movimento reduzido deve iniciar áudio uma só vez");
  await Promise.resolve();

  let rejectPlayback;
  play = () => new Promise((resolve, reject) => { rejectPlayback = reject; });
  scene.start(() => {});
  scene.skipSpeech();
  rejectPlayback(new Error("interrompido"));
  await Promise.resolve();
  assert.equal(scene.state, "cheer");
  assert.equal(scene.fallbackAt, null, "tentativa antiga não pode reabrir fallback após pular");

  let completed = 0;
  scene.onComplete = () => { completed += 1; };
  scene.finish();
  scene.cancel();
  for (const callback of scheduled.values()) callback();
  assert.equal(completed, 0, "cancelar deve impedir resultados atrasados após fim da sessão");

  for (const file of ["cena-vitoria/cena-vitoria.js", "cena-vitoria/cena-vitoria.css"]) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    for (const match of text.matchAll(/\/assets\/[\w/.-]+/g)) {
      assert.ok(fs.existsSync(path.join(root, match[0])), `asset ausente: ${match[0]}`);
    }
  }
  console.log("✓ Cena de vitória: sequência final, áudio único, cancelamento e assets");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
