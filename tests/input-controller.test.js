"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

global.window = {
  SortFactory: {},
  addEventListener() {},
  removeEventListener() {},
};

require(path.join(__dirname, "..", "js", "input-controller.js"));

const input = new global.window.SortFactory.InputController();

function keyboardEvent(code, target = { tagName: "CANVAS" }) {
  return {
    code,
    target,
    repeat: false,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

const nameFieldEvent = keyboardEvent("KeyW", { tagName: "INPUT", isContentEditable: false });
input._onKeyDown(nameFieldEvent);
assert.equal(nameFieldEvent.defaultPrevented, false, "W deve continuar digitável em inputs");
assert.equal(input.keysDown.has("KeyW"), false, "digitar no input não deve mover o robô");

const editableEvent = keyboardEvent("KeyA", { tagName: "DIV", isContentEditable: true });
input._onKeyDown(editableEvent);
assert.equal(editableEvent.defaultPrevented, false, "conteúdo editável não deve ser interceptado");

input.enabled = false;
const disabledEvent = keyboardEvent("KeyS");
input._onKeyDown(disabledEvent);
assert.equal(disabledEvent.defaultPrevented, false, "controles pausados não devem bloquear teclas");

input.enabled = true;
const canvasEvent = keyboardEvent("KeyD");
input._onKeyDown(canvasEvent);
assert.equal(canvasEvent.defaultPrevented, true, "o controle ativo deve interceptar D");
assert.equal(input.keysDown.has("KeyD"), true, "D deve mover o robô no canvas");

const releaseInInput = keyboardEvent("KeyD", { tagName: "INPUT", isContentEditable: false });
input._onKeyUp(releaseInInput);
assert.equal(releaseInInput.defaultPrevented, false);
assert.equal(input.keysDown.has("KeyD"), false, "soltar a tecla sempre deve limpar o movimento");

console.log("✓ InputController: digitação livre em campos e WASD ativo no jogo");
