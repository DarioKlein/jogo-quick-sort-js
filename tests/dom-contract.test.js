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
assert.doesNotMatch(gameHtml, /data-pivot-strategy|data-phase-id/);
assert.match(gameHtml, /id="run-time"/);
assert.match(gameHtml, /id="victory-rank"/);
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

console.log("✓ DOM: contratos de elementos e ordem dos módulos");
