"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assertSelectorsExist(htmlFile, scriptFiles) {
  const html = read(htmlFile);
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
  const selectors = scriptFiles.flatMap((file) => (
    [...read(file).matchAll(/querySelector\(["']#([\w-]+)["']\)/g)].map((match) => ({
      file,
      id: match[1],
    }))
  ));

  selectors.forEach(({ file, id }) => {
    assert.ok(ids.has(id), `${file} espera o elemento #${id} em ${htmlFile}`);
  });
}

assertSelectorsExist("index.html", ["js/game.js", "js/ui-controller.js"]);
assertSelectorsExist("dev.html", ["js/dev-dashboard.js"]);

const gameHtml = read("index.html");
const gameScript = read("js/game.js");
assert.doesNotMatch(gameHtml, /data-pivot-strategy|data-phase-id/);
assert.match(gameHtml, /id="run-time"/);
assert.match(gameHtml, /id="victory-rank"/);
assert.match(gameHtml, /id="fullscreen-button"/);
assert.match(
  gameScript,
  /async _resumeSavedSession\(\)[\s\S]*?this\._beginRun\(false\)/,
  "recuperar uma sessão deve iniciar a run sem repetir o tutorial",
);
assert.match(gameHtml, /id="topbar-menu-panel" class="game-menu-panel"/);
assert.ok(
  gameHtml.indexOf('id="player-chip"') < gameHtml.indexOf('id="topbar-menu-panel"'),
  "identificação do operador deve permanecer fora do menu lateral",
);
assert.match(gameHtml, /<kbd>F<\/kbd> tela cheia/);
assert.match(gameHtml, /<kbd>P<\/kbd> pausar/);
assert.match(gameHtml, /<kbd>R<\/kbd> reiniciar/);
assert.doesNotMatch(gameHtml, /class="legend"/);
assert.ok(
  gameHtml.indexOf('class="controls-hint"') > gameHtml.indexOf('class="algorithm-strip"'),
  "dicas de teclado devem ficar na faixa inferior do jogo",
);
assert.ok(
  gameHtml.indexOf("js/live-session.js") < gameHtml.indexOf("js/game.js"),
  "live-session.js deve carregar antes de game.js",
);
assert.ok(
  gameHtml.indexOf("js/run-scoring.js") < gameHtml.indexOf("js/game.js"),
  "run-scoring.js deve carregar antes de game.js",
);

const devHtml = read("dev.html");
assert.ok(
  devHtml.indexOf("js/renderer.js") < devHtml.indexOf("js/dev-dashboard.js"),
  "renderer.js deve carregar antes do painel do espectador",
);
assert.ok(
  devHtml.indexOf("js/spectator-buffer.js") < devHtml.indexOf("js/dev-dashboard.js"),
  "spectator-buffer.js deve carregar antes do painel do espectador",
);
assert.match(gameHtml, /js\/renderer\.js\?v=/, "jogo deve invalidar o cache dos scripts");
assert.match(devHtml, /dev\.css\?v=/, "painel deve invalidar o cache do CSS");
assert.match(devHtml, /js\/dev-dashboard\.js\?v=/, "painel deve invalidar o cache dos scripts");

console.log("✓ DOM: contratos de elementos e ordem dos módulos");
