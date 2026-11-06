"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor() {
    this.children = [];
    this.listeners = {};
    this.attributes = {};
    this.textContent = "";
    this.value = "";
    this.disabled = false;
    this.readOnly = false;
    this.offsetWidth = 100;
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    };
    this.style = { setProperty() {} };
  }

  addEventListener(name, callback) { this.listeners[name] = callback; }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() {}
  click() { this.listeners.click?.(); }
}

const elements = new Map();
const document = {
  querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  },
  createElement: () => new Element(),
  addEventListener() {},
};
const context = {
  document,
  window: {
    SortFactory: {},
    setTimeout(callback) { callback(); },
    clearTimeout() {},
  },
};
context.window.window = context.window;
context.window.document = document;

const root = path.join(__dirname, "..");
for (const file of ["js/constants.js", "js/utils.js", "js/ui-controller.js"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context);
}

const ui = new context.window.SortFactory.UiController();
const dots = elements.get("#tutorial-dots");
const initialDots = [...dots.children];
assert.ok(initialDots.length > 1);
assert.equal(initialDots[0].classList.contains("is-active"), true);

let resumeRequested = 0;
let resumeDeclined = 0;
ui.onResume = () => { resumeRequested += 1; };
ui.onResumeDecline = () => { resumeDeclined += 1; };
ui.showResumePrompt("Maria");
assert.equal(elements.get("#resume-player-name").textContent, "Maria");
assert.equal(elements.get("#resume-modal").classList.contains("modal--hidden"), false);
assert.equal(elements.get("#start-modal").classList.contains("modal--hidden"), true);
elements.get("#resume-session").click();
elements.get("#resume-new-session").click();
assert.equal(resumeRequested, 1);
assert.equal(resumeDeclined, 1);
ui.hideResumePrompt({ showStart: true });
assert.equal(elements.get("#start-modal").classList.contains("modal--hidden"), false);

elements.get("#tutorial-next").click();
assert.deepEqual(dots.children, initialDots, "avanço deve reaproveitar os pontos existentes");
assert.equal(dots.classList.contains("tutorial-dots--forward"), true);
assert.equal(dots.children[1].classList.contains("is-active"), true);

elements.get("#tutorial-back").click();
assert.deepEqual(dots.children, initialDots, "retorno deve reaproveitar os pontos existentes");
assert.equal(dots.classList.contains("tutorial-dots--back"), true);
assert.equal(dots.children[0].classList.contains("is-active"), true);

console.log("✓ UiController: indicador do tutorial e diálogo de recuperação");
