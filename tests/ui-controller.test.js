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
    this.hidden = false;
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
  click() { return this.listeners.click?.(); }
}

const elements = new Map();
const documentListeners = {};
const document = {
  fullscreenElement: null,
  documentElement: {
    async requestFullscreen() {
      document.fullscreenElement = document.documentElement;
      documentListeners.fullscreenchange?.();
    },
  },
  async exitFullscreen() {
    document.fullscreenElement = null;
    documentListeners.fullscreenchange?.();
  },
  querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, new Element());
    return elements.get(selector);
  },
  createElement: () => new Element(),
  addEventListener(name, callback) { documentListeners[name] = callback; },
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

let pauseRequested = 0;
const menuVisibilityChanges = [];
ui.onPauseToggle = () => { pauseRequested += 1; };
ui.onMenuVisibilityChange = (isOpen) => menuVisibilityChanges.push(isOpen);
const menuToggle = elements.get("#menu-toggle-button");
const topbarMenu = elements.get("#topbar-menu");
const menuPanel = elements.get("#topbar-menu-panel");
menuToggle.click();
assert.equal(topbarMenu.classList.contains("is-open"), true);
assert.equal(menuPanel.classList.contains("is-open"), true);
assert.equal(menuPanel.attributes["aria-hidden"], "false");
assert.equal(menuToggle.attributes["aria-expanded"], "true");
assert.equal(menuToggle.attributes["aria-label"], "Fechar menu");
ui.closeMenu();
assert.equal(menuPanel.classList.contains("is-open"), false);
menuToggle.click();
elements.get("#menu-pause-button").click();
assert.equal(topbarMenu.classList.contains("is-open"), false);
assert.equal(menuPanel.classList.contains("is-open"), false);
assert.equal(menuPanel.attributes["aria-hidden"], "true");
assert.equal(pauseRequested, 1);
assert.deepEqual(menuVisibilityChanges, [true, false, true, false]);
elements.get("#pause-button").click();
assert.equal(pauseRequested, 2);
ui.setPaused(true);
assert.equal(elements.get("#pause-button").attributes["aria-pressed"], "true");
assert.equal(elements.get("#menu-game-status").attributes["data-paused"], "true");
assert.match(elements.get("#pause-button").innerHTML, /Continuar/);
assert.match(elements.get("#menu-pause-button").innerHTML, /Continuar/);

async function testFullscreenToggle() {
  const fullscreenButton = elements.get("#fullscreen-button");
  assert.equal(fullscreenButton.hidden, false);
  assert.equal(fullscreenButton.attributes["aria-pressed"], "false");

  await fullscreenButton.click();
  assert.equal(document.fullscreenElement, document.documentElement);
  assert.equal(fullscreenButton.attributes["aria-pressed"], "true");
  assert.match(fullscreenButton.innerHTML, /Sair da tela cheia/);

  await fullscreenButton.click();
  assert.equal(document.fullscreenElement, null);
  assert.equal(fullscreenButton.attributes["aria-pressed"], "false");
  assert.match(fullscreenButton.innerHTML, /Tela cheia/);

  let shortcutPrevented = false;
  await documentListeners.keydown({
    code: "KeyF",
    repeat: false,
    target: { tagName: "BODY" },
    preventDefault() { shortcutPrevented = true; },
  });
  assert.equal(shortcutPrevented, true);
  assert.equal(document.fullscreenElement, document.documentElement);

  await documentListeners.keydown({
    code: "KeyF",
    repeat: false,
    target: { tagName: "BODY" },
    preventDefault() {},
  });
  assert.equal(document.fullscreenElement, null);

  await documentListeners.keydown({
    code: "KeyF",
    repeat: false,
    target: { tagName: "INPUT" },
    preventDefault() { throw new Error("atalho não deve capturar digitação em campos"); },
  });
  assert.equal(document.fullscreenElement, null);

  let pauseShortcutPrevented = false;
  await documentListeners.keydown({
    code: "KeyP",
    repeat: false,
    target: { tagName: "BODY" },
    preventDefault() { pauseShortcutPrevented = true; },
  });
  assert.equal(pauseShortcutPrevented, true);
  assert.equal(pauseRequested, 3);

  await documentListeners.keydown({
    code: "KeyP",
    repeat: false,
    target: { tagName: "INPUT" },
    preventDefault() { throw new Error("atalho de pausa não deve capturar digitação"); },
  });
  assert.equal(pauseRequested, 3);
}

testFullscreenToggle()
  .then(() => console.log("✓ UiController: tutorial, menu, pausa, recuperação e tela cheia"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
