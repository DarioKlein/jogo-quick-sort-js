"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

class Element {
  constructor() {
    this.children = [];
    this.fields = new Map();
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.textContent = "";
    this.value = "";
    this.disabled = false;
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
    };
  }
  querySelector(selector) {
    if (!this.fields.has(selector)) this.fields.set(selector, new Element());
    return this.fields.get(selector);
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  cloneNode() { return new Element(); }
  replaceChildren(...children) { this.children = children; }
  insertBefore(child, reference) {
    child.remove();
    const index = reference ? this.children.indexOf(reference) : this.children.length;
    this.children.splice(index, 0, child);
    child.parent = this;
  }
  remove() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  scrollIntoView() {}
}
const document = new Element();
document.createElement = () => new Element();
for (const id of ["#ranking-item-template", "#game-card-template"]) {
  document.querySelector(id).content = { firstElementChild: new Element() };
}
const sources = [];
class EventSource {
  constructor(url) { this.url = url; this.listeners = {}; sources.push(this); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  close() { this.closed = true; }
  emit(name, data) { this.listeners[name]?.({ data: JSON.stringify(data) }); }
}
const pendingFetches = [];
let fetchCount = 0;
const context = {
  document, EventSource, AbortSignal, performance: { now: () => 0 }, requestAnimationFrame() {},
  fetch: () => { fetchCount++; return new Promise((resolve) => { pendingFetches.push(resolve); }); },
  window: { addEventListener() {}, confirm: () => true, SortFactory: {
    Utils: { formatDuration: String },
    Renderer: class { draw() {} },
    SpectatorBuffer: class {
      reset() { this.size = 0; }
      push() { this.size = 1; }
      sample() { return null; }
    },
  } },
};
vm.runInNewContext(fs.readFileSync(require.resolve("../js/dev-dashboard.js"), "utf8"), context);
const element = (id) => document.querySelector(id);
const player = (id, name, score = 0) => ({
  id, name, score, timeMs: 0, errors: 0, phaseNumber: 1, phaseTitle: "Caso médio",
});
const roster = sources[0];
const ana = player("a", "Ana");
const bia = player("b", "Bia");
roster.emit("roster", [ana, bia]);
const grid = element("#games-grid");
const firstCard = grid.children[0];
const firstButton = firstCard.querySelector(".watch-button");
const secondCard = grid.children[1];
const secondButton = secondCard.querySelector(".watch-button");
firstButton.onclick();
const firstWatch = sources[1];
assert.match(firstWatch.url, /watch\/a/);
assert.match(firstButton.textContent, /Conectando/);
assert.equal(firstButton.disabled, false, "o primeiro clique não deve desabilitar sua própria ativação");
assert.equal(firstButton.attributes["aria-disabled"], "true");
firstButton.onclick();
assert.equal(sources.length, 2, "clique repetido durante a conexão não deve abrir outro stream");
roster.emit("player", { ...ana, score: 500 });
assert.equal(grid.children[0], firstCard, "atualização deve preservar o card durante o clique");
assert.equal(firstCard.querySelector(".watch-button"), firstButton);
assert.equal(secondCard.querySelector(".watch-button"), secondButton);
const select = element("#spectator-player-select");
const options = select.children;
roster.emit("player", { ...bia, score: 1000 });
assert.equal(select.children, options, "pontuação não deve recriar as opções do select");
assert.equal(select.value, "a");

// Switching through the card must finish with one click and exactly one stream.
assert.match(secondButton.textContent, /Trocar/);
secondButton.onclick();
const secondWatch = sources[2];
assert.equal(firstWatch.closed, true);
assert.match(secondWatch.url, /watch\/b/);
assert.equal(sources.length, 3);
assert.equal(select.value, "b");
assert.match(secondButton.textContent, /Conectando/);
firstWatch.emit("offline");
assert.equal(select.value, "b", "eventos antigos não devem fechar a partida atual");
firstWatch.emit("state", { ...ana, updatedAt: 1, sequence: 1 });
assert.equal(element("#spectator-name").textContent, "Bia");

secondWatch.emit("state", { ...bia, updatedAt: 1, sequence: 1 });
assert.equal(element("#spectator").attributes["aria-busy"], "false");
assert.match(element("#spectator-waiting").textContent, /Aguardando/);
secondWatch.emit("error");
assert.match(element("#spectator-status").textContent, /Reconectando/);
assert.equal(select.disabled, false);
assert.equal(element("#spectator-waiting").classList.contains("is-hidden"), false);

// The select uses the same single-switch path in the opposite direction.
select.value = "a";
select.listeners.change();
const thirdWatch = sources[3];
assert.equal(secondWatch.closed, true);
assert.match(thirdWatch.url, /watch\/a/);
assert.equal(sources.length, 4);
element("#close-spectator").listeners.click();
assert.equal(sources.at(-1).closed, true);
assert.equal(element("#spectator").classList.contains("spectator--hidden"), true);

async function testRequests() {
  const refresh = element("#refresh-button");
  const request = refresh.listeners.click();
  assert.equal(refresh.disabled, true);
  assert.equal(refresh.textContent, "Atualizando…");
  const count = fetchCount;
  await refresh.listeners.click();
  assert.equal(fetchCount, count, "atualização duplicada deve ser bloqueada");
  pendingFetches.shift()({ ok: true, json: async () => [ana, bia] });
  pendingFetches.shift()({ ok: true, json: async () => [] });
  await request;
  assert.equal(refresh.disabled, false);
  assert.equal(refresh.textContent, "Atualizar");

  const failed = refresh.listeners.click();
  pendingFetches.shift()({ ok: false });
  pendingFetches.shift()({ ok: true });
  await failed;
  assert.equal(refresh.disabled, false, "falha deve permitir tentar novamente");
  assert.match(element("#server-state").querySelector("span").textContent, /Tente novamente/);

  roster.emit("ranking", [{
    id: "rank-a", name: "Ana", online: false, bestScore: null, bestTimeMs: null, attempts: 0,
  }]);
  const remove = element("#ranking-list").children[0].querySelector(".ranking-item__remove");
  const removal = remove.onclick();
  assert.equal(remove.disabled, true);
  assert.equal(remove.textContent, "");
  assert.equal(remove.attributes["aria-busy"], "true");
  roster.emit("player", ana);
  assert.equal(element("#ranking-list").children[0].querySelector(".ranking-item__remove"), remove);
  assert.equal(remove.disabled, true, "atualização ao vivo deve preservar operação pendente");
  pendingFetches.shift()({ ok: false, json: async () => ({ error: "Falha ao remover" }) });
  await removal;
  assert.equal(remove.disabled, false);
  assert.equal(remove.textContent, "×");
  assert.equal(remove.attributes["aria-busy"], "false");
}
testRequests().then(() => console.log("✓ Painel: controles estáveis, select, troca rápida, eventos antigos e loading")).catch((error) => { console.error(error); process.exitCode = 1; });
