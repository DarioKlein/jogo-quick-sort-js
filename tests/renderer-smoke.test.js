"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

global.window = global;
global.performance = global.performance || { now: () => Date.now() };

require(path.join(__dirname, "..", "js", "constants.js"));
require(path.join(__dirname, "..", "js", "utils.js"));
require(path.join(__dirname, "..", "js", "renderer.js"));

function createContextStub() {
  const noop = () => {};
  const assignments = [];
  return new Proxy({ assignments }, {
    get(target, property) {
      if (property === "assignments") return target.assignments;
      if (property === "createLinearGradient") return () => ({ addColorStop: noop });
      if (property === "measureText") return (text) => ({ width: String(text).length * 8 });
      return noop;
    },
    set(target, property, value) {
      target.assignments.push({ property, value });
      return true;
    },
  });
}

const context = createContextStub();
const canvas = { getContext: () => context };
const renderer = new global.SortFactory.Renderer(canvas);
const { GameState, PivotStrategy } = global.SortFactory.Constants;
const baseSnapshot = {
  values: [8, 3, 12, 5, 1, 10],
  resolved: new Set(),
  segment: { start: 0, end: 5 },
  pivotIndex: 0,
  pivotValue: 8,
  pivotStrategy: PivotStrategy.FIRST,
  pivotTargetIndex: null,
  i: 1,
  j: 5,
  state: GameState.INSPECT_I,
  selected: null,
  comparison: null,
};
const robot = { x: 403, y: 584, facing: 1, moving: false };

function draw(snapshot, manualSwap = null, time = 1000, frameRobot = robot) {
  renderer.draw({
    time,
    snapshot,
    robot: frameRobot,
    nearbyIndex: 1,
    manualSwap,
    paused: false,
    modalOpen: false,
    victory: false,
  });
}

assert.doesNotThrow(() => draw(baseSnapshot));
assert.doesNotThrow(() => draw({
  ...baseSnapshot,
  segment: { start: 0, end: 2 },
  pivotIndex: 0,
  i: 1,
  j: 2,
  resolved: new Set([3]),
}));
assert.doesNotThrow(() => draw({
  ...baseSnapshot,
  state: GameState.SWAP_I_J,
  selected: 1,
}, null, 1500));

[
  { phase: "handoff", phaseProgress: 0.2 },
  { phase: "handoff", phaseProgress: 0.8 },
  { phase: "carry-back", phaseProgress: 1 },
  { phase: "placing", phaseProgress: 0.35 },
  { phase: "placing", phaseProgress: 0.9 },
].forEach((manualSwap, index) => {
  assert.doesNotThrow(() => draw({
    ...baseSnapshot,
    state: GameState.SWAP_I_J,
    selected: null,
  }, { a: 1, b: 4, ...manualSwap }, 2000 + index * 100));
});

assert.doesNotThrow(() => draw({
  ...baseSnapshot,
  state: GameState.PLACE_PIVOT,
  selected: 0,
}, { a: 0, b: 0, phase: "placing", phaseProgress: 0.5 }, 3000));

assert.doesNotThrow(() => renderer.draw({
  time: 3500,
  snapshot: baseSnapshot,
  robot: { ...robot, moving: true, sprinting: true },
  nearbyIndex: null,
  manualSwap: null,
  paused: false,
  modalOpen: false,
  victory: false,
}));

renderer.victoryStartedAt = 4000;
assert.equal(renderer._getVictoryBoxOffset(4100, true), 0, "caixas aguardam a linha ser liberada");
const conveyorExitOffset = renderer._getVictoryBoxOffset(5000, true);
assert.ok(
  conveyorExitOffset > 0 && conveyorExitOffset < 1180,
  "caixas ordenadas devem avançar pela esteira antes de sair da fábrica",
);
assert.equal(renderer._getVictoryBoxOffset(6000, true), 1180, "lote deve terminar fora da linha");
renderer.victoryStartedAt = null;

assert.deepEqual(
  renderer._getBoxEntranceState(2, 6, null),
  { visible: true, x: renderer.boxX(2) },
  "sem entrada ativa as caixas ficam nas posições",
);
assert.deepEqual(
  renderer._getBoxEntranceState(4, 6, 0),
  { visible: false, x: 82 },
  "as caixas devem aguardar sua vez dentro do alimentador",
);
assert.deepEqual(
  renderer._getBoxEntranceState(5, 6, 0),
  { visible: true, x: 82 },
  "a caixa mais distante deve ser liberada primeiro pelo portal",
);
const enteringBox = renderer._getBoxEntranceState(4, 6, 0.25);
assert.ok(
  enteringBox.visible && enteringBox.x > 82 && enteringBox.x < renderer.boxX(0),
  "cada nova caixa deve emergir do portal até o primeiro espaço",
);
const shiftedBox = renderer._getBoxEntranceState(5, 6, 0.25);
assert.ok(
  shiftedBox.x > renderer.boxX(0) && shiftedBox.x < renderer.boxX(1),
  "a esteira deve avançar as caixas anteriores para abrir espaço",
);
for (let index = 0; index < baseSnapshot.values.length; index += 1) {
  assert.deepEqual(
    renderer._getBoxEntranceState(index, baseSnapshot.values.length, 1),
    { visible: true, x: renderer.boxX(index) },
    "todas as caixas devem terminar alinhadas em suas posições",
  );
}

const runningRobot = { ...robot, moving: true, sprinting: true };
const runningMotion = renderer._getRobotMotion(runningRobot, 3500);
const actionMotion = renderer._getRobotMotion(runningRobot, 3500, true);
const idleMotion = renderer._getRobotMotion(robot, 3500);
assert.equal(runningMotion.walking, true);
assert.notEqual(runningMotion.step, 0);
assert.equal(actionMotion.walking, false, "posicionar a caixa deve omitir a caminhada");
assert.equal(actionMotion.step, 0);
assert.equal(idleMotion.bob, 0, "idle deve manter os pés apoiados no chão");

renderer.pipeSmoke = [];
renderer.nextPipeSmokeAt = 2200;
assert.equal(renderer._getPipeGearRotation(1000), 0, "engrenagem deve aguardar parada");
const windingGear = renderer._getPipeGearRotation(1650);
assert.ok(
  windingGear > 0 && windingGear < Math.PI * 2,
  "engrenagem deve acelerar, manter o giro e desacelerar antes da emissão",
);
assert.ok(
  Math.abs(renderer._getPipeGearRotation(2200) - Math.PI * 2) < 0.001,
  "engrenagem deve completar uma volta ao liberar o vapor",
);
renderer.nextPipeSmokeAt = 100;
assert.doesNotThrow(() => renderer._drawPipeGear(134, 124, 0.5));
assert.doesNotThrow(() => renderer._drawPipeSmoke(100, 0.016));
assert.ok(
  renderer.pipeSmoke.length >= 3 && renderer.pipeSmoke.length <= 5,
  "o exaustor deve liberar poucos grupos de fumaça por vez",
);
assert.ok(renderer.nextPipeSmokeAt > 100, "a próxima emissão deve ocorrer em um intervalo aleatório");

const restingDetails = renderer._getRobotIdleMotion(0, true);
const raisedTorsoDetails = renderer._getRobotIdleMotion(1450, true);
const carryingIdleDetails = renderer._getRobotIdleMotion(1540, true, true);
const blinkingDetails = renderer._getRobotIdleMotion(3900, true);
const disabledIdleDetails = renderer._getRobotIdleMotion(3900, false);
assert.equal(restingDetails.eyeOpen, 1);
assert.ok(Math.abs(restingDetails.armShift) <= 1.8);
assert.ok(
  raisedTorsoDetails.torsoShift > 0.8 && raisedTorsoDetails.torsoShift <= 0.85,
  "torso deve oscilar menos de um pixel enquanto os pés ficam fixos",
);
assert.ok(
  carryingIdleDetails.torsoShift > 0.5 && carryingIdleDetails.torsoShift <= 0.55,
  "segurando a caixa o idle do torso deve ser ainda mais sutil",
);
assert.equal(carryingIdleDetails.armShift, 0, "a caixa deve estabilizar os braços no idle");
assert.equal(blinkingDetails.eyeOpen, 0.12, "robô parado deve piscar ocasionalmente");
assert.deepEqual(
  disabledIdleDetails,
  { eyeOpen: 1, armShift: 0, antennaGlow: 0, torsoShift: 0 },
  "detalhes de idle não devem interferir em outros estados",
);

renderer.robotPose = { side: 0, back: 0, lastTime: null };
const frontPose = renderer._getRobotPose(robot, 4000, "idle");
renderer._getRobotPose(runningRobot, 4016, "walk");
const sidePose = renderer._getRobotPose(runningRobot, 4200, "walk");
renderer._getRobotPose(runningRobot, 4216, "interact");
const backPose = renderer._getRobotPose(runningRobot, 4400, "interact");
renderer._getRobotPose(robot, 4416, "idle");
const returnedFrontPose = renderer._getRobotPose(robot, 4600, "idle");
assert.deepEqual(frontPose, { side: 0, back: 0 });
assert.equal(sidePose.side, 1, "robô em movimento deve assumir o perfil lateral");
assert.equal(sidePose.back, 0);
assert.equal(backPose.back, 1, "robô interagindo deve ficar de costas para olhar as caixas");
assert.equal(backPose.side, 0);
assert.deepEqual(returnedFrontPose, { side: 0, back: 0 });
renderer.robotPose = { side: 0, back: 0, lastTime: null };

assert.deepEqual(
  renderer._getRobotViewTarget("carry", robot, null),
  { side: 0, back: 0 },
  "retirada parada deve manter a pose frontal",
);
assert.deepEqual(
  renderer._getRobotViewTarget("carry", runningRobot, { x: 1, y: 0 }),
  { side: 1, back: 0 },
  "retirada andando na horizontal deve usar o perfil lateral",
);
assert.deepEqual(
  renderer._getRobotViewTarget("carry", runningRobot, { x: 0, y: -1 }),
  { side: 0, back: 1 },
  "retirada andando para cima deve olhar para as caixas",
);
assert.deepEqual(
  renderer._getRobotViewTarget("carry", runningRobot, { x: 0, y: 1 }),
  { side: 0, back: 0 },
  "retirada andando para baixo deve usar a pose frontal",
);
assert.deepEqual(
  renderer._getRobotViewTarget("carry", runningRobot, { x: 0.8, y: -0.2 }),
  { side: 1, back: 0 },
  "movimento diagonal deve priorizar o eixo dominante",
);
assert.deepEqual(
  renderer._getRobotViewTarget("place", runningRobot, { x: 1, y: 0 }),
  { side: 0, back: 1 },
  "posicionamento deve olhar para as caixas mesmo andando",
);
assert.deepEqual(
  renderer._getRobotViewTarget("interact", runningRobot, null),
  { side: 0, back: 1 },
  "handoff deve manter a pose de costas",
);

const actionOptions = [];
const actionGripPoses = [];
const drawRobot = renderer._drawRobot.bind(renderer);
renderer._drawRobot = (...args) => {
  actionOptions.push(args[2]);
  actionGripPoses.push(args[2].gripPose);
  return { side: 0, back: 0 };
};
draw({ ...baseSnapshot, state: GameState.SWAP_I_J }, {
  a: 1,
  b: 4,
  phase: "handoff",
  phaseProgress: 0.3,
}, 3600);
draw({ ...baseSnapshot, state: GameState.SWAP_I_J }, {
  a: 1,
  b: 4,
  phase: "placing",
  phaseProgress: 0.3,
}, 3700);
draw({ ...baseSnapshot, state: GameState.SWAP_I_J }, {
  a: 1,
  b: 4,
  phase: "carry-back",
  phaseProgress: 1,
}, 3800);
renderer._drawRobot = drawRobot;
assert.deepEqual(
  actionOptions.map(({ suppressWalking }) => suppressWalking),
  [true, true, false],
  "trocar e posicionar caixas devem congelar as pernas",
);
assert.deepEqual(
  actionOptions.map(({ animation }) => animation),
  ["interact", "place", "carry"],
  "cada fase deve usar o estado de animação correspondente",
);
assert.ok(
  actionGripPoses.every((pose) => pose && Number.isFinite(pose.x) && Number.isFinite(pose.y)),
  "braços devem acompanhar a caixa durante a troca e o posicionamento",
);

const carryingOptions = [];
renderer._drawRobot = (...args) => {
  carryingOptions.push(args[2]);
  return { side: 0, back: 0 };
};
const carryingSnapshot = { ...baseSnapshot, selected: 2 };
draw(carryingSnapshot, null, 5000, runningRobot);
draw(carryingSnapshot, null, 5400, runningRobot);
draw(carryingSnapshot, null, 5600, robot);
renderer._drawRobot = drawRobot;
assert.deepEqual(
  carryingOptions.map(({ carrying, animation, idleWhileCarrying }) => ({
    carrying,
    animation,
    idleWhileCarrying,
  })),
  [
    { carrying: false, animation: "carry", idleWhileCarrying: false },
    { carrying: true, animation: "carry", idleWhileCarrying: false },
    { carrying: true, animation: "carry", idleWhileCarrying: true },
  ],
  "a retirada deve seguir o estado de movimento sem pose temporizada",
);
assert.doesNotThrow(() => renderer._drawReachingArms(
  { ...robot, facing: -1 },
  robot.y,
  0,
  { x: robot.x - 20, y: robot.y - 124, reach: 1, grip: 1 },
  { side: 1 },
));
assert.equal(renderer._getFarArmAlpha(0), 1, "de frente os dois braços devem permanecer visíveis");
assert.ok(
  Math.abs(renderer._getFarArmAlpha(1) - 0.52) < 0.001,
  "carregando de lado o braço distante deve ficar apenas levemente visível",
);

context.assignments.length = 0;
renderer._drawRobot(runningRobot, 3500, {
  animation: "walk",
  canInteract: false,
});
assert.equal(
  context.assignments.some(({ property, value }) => property === "fillStyle" && value === "#71366f"),
  true,
  "robô correndo deve usar uma cor corporal diferente",
);

renderer.speedTrails = [];
renderer.lastRobotPosition = null;
renderer._updateSpeedTrails({ ...runningRobot, x: 300, y: 580 }, 4000);
renderer._updateSpeedTrails({ ...runningRobot, x: 314, y: 580 }, 4050);
assert.equal(renderer.speedTrails.length, 2, "corrida deve criar rastros temporários");
assert.ok(
  renderer.speedTrails.every((trail) => trail.x < 314 && trail.endX < trail.x),
  "rastros devem nascer atrás da direção do movimento e ficar no cenário",
);
assert.deepEqual(
  renderer.robotDirection,
  { x: 1, y: 0 },
  "a direção deve acompanhar o deslocamento do robô",
);
renderer._updateSpeedTrails({ ...runningRobot, x: 328, y: 580 }, 4100, true);
assert.equal(renderer.speedTrails.length, 2, "ações que bloqueiam a corrida não devem criar rastros");
assert.equal(renderer.robotDirection, null, "ações bloqueadas não devem atualizar a direção");
renderer._drawSpeedTrails(0.33);
assert.equal(renderer.speedTrails.length, 0, "rastros devem desaparecer rapidamente");

renderer.lastRobotPosition = null;
renderer._updateSpeedTrails({ ...robot, moving: true, sprinting: false, x: 300, y: 580 }, 4200);
renderer._updateSpeedTrails({ ...robot, moving: true, sprinting: false, x: 300, y: 566 }, 4250);
assert.deepEqual(
  renderer.robotDirection,
  { x: 0, y: -1 },
  "a direção deve ser rastreada também durante a caminhada sem corrida",
);
renderer._updateSpeedTrails({ ...robot, moving: false, sprinting: false, x: 300, y: 566 }, 4300);
assert.equal(renderer.robotDirection, null, "robô parado não deve manter direção");

assert.equal(
  context.assignments.some(({ property }) => property === "filter"),
  false,
  "caixas bloqueadas não devem usar filtros de Canvas custosos",
);

console.log("✓ Renderer: zonas ativas/bloqueadas, caixa carregada e troca manual");
