(function initializeRenderer(namespace) {
  "use strict";

  const {
    WIDTH,
    HEIGHT,
    BOX_START_X,
    BOX_GAP,
    BOX_Y,
    BOX_SIZE,
    COMPARISON_DURATION,
    COLORS,
    GameState,
  } = namespace.Constants;
  const { clamp, easeInOutCubic, easeOutCubic, lerp, roundedRect } = namespace.Utils;

  const PICKUP_DURATION = 270;
  const POSE_TRANSITION_DURATION = 150;

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.context = canvas.getContext("2d", { alpha: false });
      this.pointerPositions = { i: BOX_START_X, j: BOX_START_X };
      this.particles = [];
      this.speedTrails = [];
      this.lastRobotPosition = null;
      this.lastSpeedTrailAt = Number.NEGATIVE_INFINITY;
      this.lastSelectedIndex = null;
      this.pickupStartedAt = 0;
      this.robotPose = { side: 0, back: 0, lastTime: null };
      this.lastTime = performance.now();
      this.lockedPattern = this._createLockedPattern();
    }

    boxX(index) {
      return BOX_START_X + BOX_GAP * index;
    }

    draw(frame) {
      const now = frame.time;
      const delta = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      const context = this.context;

      context.clearRect(0, 0, WIDTH, HEIGHT);
      this._drawBackground(now);
      const suppressSpeedTrail = frame.paused
        || frame.modalOpen
        || ["handoff", "placing"].includes(frame.manualSwap?.phase);
      this._updateSpeedTrails(frame.robot, now, suppressSpeedTrail);
      this._drawSegmentZones(frame.snapshot);
      this._drawConveyor(now, frame.victory);
      this._drawSpeedTrails(delta);
      this._drawBoxes(frame, now);
      this._drawPointers(frame.snapshot, delta, now);

      if (frame.manualSwap) {
        this._drawManualSwap(frame, now);
      } else {
        const carryingIndex = frame.snapshot.selected;
        const isCarrying = carryingIndex !== null;
        if (isCarrying) {
          if (this.lastSelectedIndex !== carryingIndex) {
            this.lastSelectedIndex = carryingIndex;
            this.pickupStartedAt = now;
          }
          const pickupProgress = clamp((now - this.pickupStartedAt) / PICKUP_DURATION, 0, 1);
          const reachProgress = easeOutCubic(clamp(pickupProgress / 0.34, 0, 1));
          const liftProgress = easeOutCubic(clamp((pickupProgress - 0.16) / 0.84, 0, 1));
          const gripProgress = easeOutCubic(clamp((pickupProgress - 0.18) / 0.32, 0, 1));
          const carriedX = lerp(this.boxX(carryingIndex), frame.robot.x, liftProgress);
          const carriedY = lerp(BOX_Y, frame.robot.y - 124, liftProgress)
            - Math.sin(liftProgress * Math.PI) * 18;
          const gripPose = {
            x: carriedX,
            y: carriedY,
            reach: reachProgress,
            grip: gripProgress,
          };
          this._drawRobot(
            frame.robot,
            now,
            this._isNearbyActionable(frame),
            gripProgress > 0.25,
            false,
            gripPose,
          );
          this._drawLooseBox({
            x: carriedX,
            y: carriedY,
            value: frame.snapshot.values[carryingIndex],
            index: carryingIndex,
            snapshot: frame.snapshot,
            now,
          });
          if (gripProgress > 0.04) this._drawGripHands(carriedX, carriedY, gripProgress);
        } else {
          this.lastSelectedIndex = null;
          this._drawRobot(frame.robot, now, this._isNearbyActionable(frame), false);
        }
      }

      this._drawComparison(frame.snapshot, now);
      this._drawParticles(delta);

      if (frame.paused && !frame.modalOpen) {
        this._drawPauseOverlay(Boolean(frame.manualPaused), Boolean(frame.menuOpen));
      }
    }

    celebrate() {
      for (let index = 0; index < 80; index += 1) {
        this.particles.push({
          x: WIDTH / 2 + (Math.random() - 0.5) * 480,
          y: 250 + Math.random() * 160,
          vx: (Math.random() - 0.5) * 250,
          vy: -100 - Math.random() * 230,
          gravity: 330,
          life: 1.3 + Math.random() * 1.2,
          color: [COLORS.cyan, COLORS.gold, COLORS.green, COLORS.magenta][index % 4],
          size: 3 + Math.random() * 5,
        });
      }
    }

    resetEffects() {
      this.particles = [];
      this.speedTrails = [];
      this.lastRobotPosition = null;
      this.lastSpeedTrailAt = Number.NEGATIVE_INFINITY;
      this.lastSelectedIndex = null;
      this.robotPose = { side: 0, back: 0, lastTime: null };
    }

    _createLockedPattern() {
      const documentRef = this.canvas.ownerDocument
        ?? (typeof document !== "undefined" ? document : null);
      if (!documentRef?.createElement || typeof this.context.createPattern !== "function") {
        return null;
      }

      const tile = documentRef.createElement("canvas");
      tile.width = 34;
      tile.height = 34;
      const tileContext = tile.getContext("2d");
      if (!tileContext) return null;

      tileContext.strokeStyle = "rgba(116,145,151,.16)";
      tileContext.lineWidth = 8;
      tileContext.beginPath();
      tileContext.moveTo(-8, 34);
      tileContext.lineTo(34, -8);
      tileContext.moveTo(26, 42);
      tileContext.lineTo(42, 26);
      tileContext.stroke();
      return this.context.createPattern(tile, "repeat");
    }

    _drawBackground(now) {
      const context = this.context;
      const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
      gradient.addColorStop(0, "#071c25");
      gradient.addColorStop(0.68, "#0d2a32");
      gradient.addColorStop(1, "#07171d");
      context.fillStyle = gradient;
      context.fillRect(0, 0, WIDTH, HEIGHT);

      context.save();
      context.globalAlpha = 0.22;
      context.strokeStyle = "#2d6670";
      context.lineWidth = 2;
      for (let x = -60; x < WIDTH + 80; x += 120) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x + 170, HEIGHT);
        context.stroke();
      }
      context.restore();

      this._drawPipes();
      this._drawFactoryMachines(now);

      context.fillStyle = "#0a2027";
      context.fillRect(0, 560, WIDTH, 160);
      context.strokeStyle = "#24444a";
      context.lineWidth = 2;
      for (let x = -40; x < WIDTH; x += 82) {
        context.beginPath();
        context.moveTo(x, 720);
        context.lineTo(x + 96, 560);
        context.stroke();
      }
      context.fillStyle = "rgba(48,230,242,.08)";
      context.fillRect(0, 560, WIDTH, 3);
    }

    _drawPipes() {
      const context = this.context;
      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#173e47";
      context.lineWidth = 25;
      context.beginPath();
      context.moveTo(0, 94);
      context.lineTo(154, 94);
      context.lineTo(154, 205);
      context.lineTo(230, 205);
      context.stroke();
      context.strokeStyle = "#2a5961";
      context.lineWidth = 5;
      context.stroke();

      context.strokeStyle = "#163943";
      context.lineWidth = 18;
      context.beginPath();
      context.moveTo(1010, 0);
      context.lineTo(1010, 110);
      context.lineTo(1280, 110);
      context.stroke();
      context.restore();
    }

    _drawFactoryMachines(now) {
      const context = this.context;
      const pulse = 0.55 + Math.sin(now / 430) * 0.2;
      context.fillStyle = "#0c2a33";
      context.strokeStyle = "#29515a";
      context.lineWidth = 3;
      roundedRect(context, 36, 238, 142, 226, 12);
      context.fill();
      context.stroke();
      context.fillStyle = `rgba(48,230,242,${pulse})`;
      context.fillRect(65, 275, 84, 6);
      context.fillStyle = "#173b43";
      for (let y = 315; y < 420; y += 28) context.fillRect(62, y, 90, 9);

      context.fillStyle = "#0a242d";
      context.strokeStyle = "#244b54";
      roundedRect(context, 1110, 210, 126, 250, 10);
      context.fill();
      context.stroke();
      context.fillStyle = `rgba(255,200,69,${pulse})`;
      context.beginPath();
      context.arc(1174, 262, 10, 0, Math.PI * 2);
      context.fill();
    }

    _drawSegmentZones(snapshot) {
      if (!snapshot.segment) return;
      this._drawLockedZones(snapshot);

      const context = this.context;
      const startX = this.boxX(snapshot.segment.start) - BOX_SIZE / 2 - 24;
      const endX = this.boxX(snapshot.segment.end) + BOX_SIZE / 2 + 24;
      context.save();
      const gradient = context.createLinearGradient(startX, 0, endX, 0);
      gradient.addColorStop(0, "rgba(48,230,242,.08)");
      gradient.addColorStop(0.5, "rgba(48,230,242,.2)");
      gradient.addColorStop(1, "rgba(48,230,242,.08)");
      context.fillStyle = gradient;
      roundedRect(context, startX, 188, endX - startX, 350, 12);
      context.fill();

      context.shadowColor = COLORS.cyan;
      context.shadowBlur = 15;
      context.strokeStyle = "rgba(48,230,242,.86)";
      context.lineWidth = 3;
      roundedRect(context, startX, 188, endX - startX, 350, 12);
      context.stroke();
      context.shadowBlur = 0;

      context.fillStyle = COLORS.cyan;
      context.fillRect(startX - 3, 226, 6, 264);
      context.fillRect(endX - 3, 226, 6, 264);
      this._drawZoneLabel(
        (startX + endX) / 2,
        207,
        `ZONA ATIVA  •  POSIÇÕES ${snapshot.segment.start + 1}–${snapshot.segment.end + 1}`,
        COLORS.cyan,
      );
      context.restore();
    }

    _drawLockedZones(snapshot) {
      const context = this.context;
      const groups = [];
      let currentGroup = null;

      snapshot.values.forEach((_, index) => {
        const inActiveSegment = index >= snapshot.segment.start && index <= snapshot.segment.end;
        const locked = !inActiveSegment && !snapshot.resolved.has(index);
        if (locked) {
          if (!currentGroup) currentGroup = { start: index, end: index };
          else currentGroup.end = index;
        } else if (currentGroup) {
          groups.push(currentGroup);
          currentGroup = null;
        }
      });
      if (currentGroup) groups.push(currentGroup);

      groups.forEach((group) => {
        const startX = this.boxX(group.start) - BOX_SIZE / 2 - 24;
        const endX = this.boxX(group.end) + BOX_SIZE / 2 + 24;
        const width = endX - startX;
        context.save();
        roundedRect(context, startX, 188, width, 350, 12);
        context.clip();
        context.fillStyle = "rgba(1,10,14,.68)";
        context.fillRect(startX, 188, width, 350);
        if (this.lockedPattern) {
          context.fillStyle = this.lockedPattern;
          context.fillRect(startX, 188, width, 350);
        }
        context.restore();

        context.save();
        context.strokeStyle = "rgba(116,145,151,.55)";
        context.lineWidth = 2;
        context.setLineDash([8, 7]);
        roundedRect(context, startX, 188, width, 350, 12);
        context.stroke();
        context.setLineDash([]);
        this._drawZoneLabel(
          (startX + endX) / 2,
          207,
          group.start === group.end ? "POSIÇÃO BLOQUEADA" : "ÁREA BLOQUEADA",
          "#78949a",
          true,
        );
        context.restore();
      });
    }

    _drawZoneLabel(x, y, text, color, locked = false) {
      const context = this.context;
      context.save();
      context.font = "900 12px Bahnschrift, Segoe UI";
      const iconSpace = locked ? 19 : 0;
      const width = context.measureText(text).width + 28 + iconSpace;
      context.fillStyle = locked ? "rgba(5,18,23,.96)" : "rgba(4,31,38,.96)";
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      roundedRect(context, x - width / 2, y - 14, width, 28, 6);
      context.fill();
      context.stroke();
      context.fillStyle = color;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, x + iconSpace / 2, y + 0.5);
      if (locked) this._drawPadlock(x - width / 2 + 17, y, color, 0.62);
      context.restore();
    }

    _drawConveyor(now, moving) {
      const context = this.context;
      context.fillStyle = "#091a1f";
      context.fillRect(184, 432, 914, 70);
      context.fillStyle = "#183a42";
      context.fillRect(184, 436, 914, 38);
      context.fillStyle = "#2c5c64";
      const offset = moving ? (now / 12) % 54 : 0;
      for (let x = 192 - offset; x < 1100; x += 54) {
        context.fillRect(x, 441, 33, 27);
      }
      context.fillStyle = "#0a171b";
      context.fillRect(164, 426, 24, 82);
      context.fillRect(1094, 426, 24, 82);
      context.strokeStyle = "#356872";
      context.strokeRect(184, 432, 914, 70);
      for (let x = 240; x < 1080; x += 190) {
        context.fillStyle = "#102a31";
        context.fillRect(x, 500, 18, 60);
      }
    }

    _drawBoxes(frame, now) {
      const snapshot = frame.snapshot;
      snapshot.values.forEach((value, index) => {
        const isInExchange = frame.manualSwap
          && (index === frame.manualSwap.a || index === frame.manualSwap.b);
        const isBeingCarried = !frame.manualSwap && snapshot.selected === index;
        if (isInExchange || isBeingCarried) return;

        this._drawBox({
          x: this.boxX(index),
          y: BOX_Y,
          value,
          index,
          snapshot,
          reachable: frame.nearbyIndex === index,
          swapping: false,
          now,
        });
      });
    }

    _drawManualSwap(frame, now) {
      const { snapshot, manualSwap } = frame;
      const { a, b, phase } = manualSwap;
      const rawProgress = manualSwap.phaseProgress;
      const xA = this.boxX(a);
      const xB = this.boxX(b);
      const heldY = frame.robot.y - 124;
      const robot = { ...frame.robot };
      const boxes = [];
      let carrying = false;
      let gripPose = null;

      if (a === b) {
        const lift = Math.sin(easeInOutCubic(rawProgress) * Math.PI);
        const pivotBox = {
          value: snapshot.values[a],
          index: a,
          x: lerp(xA, robot.x, lift),
          y: lerp(BOX_Y, heldY, lift) - Math.sin(rawProgress * Math.PI) * 8,
        };
        boxes.push(pivotBox);
        carrying = lift > 0.35;
        const reach = clamp(Math.sin(rawProgress * Math.PI) * 1.7, 0, 1);
        gripPose = { x: pivotBox.x, y: pivotBox.y, reach, grip: reach };
        this._drawPlacementTarget(xA, rawProgress);
      } else {
        const valueA = snapshot.values[a];
        const valueB = snapshot.values[b];

        if (phase === "handoff" && manualSwap.phaseProgress < 0.5) {
          const handoffProgress = easeOutCubic(manualSwap.phaseProgress / 0.5);
          const arcDirection = xB > WIDTH / 2 ? -1 : 1;
          boxes.push({
            value: valueA,
            index: a,
            x: lerp(robot.x, xB, handoffProgress)
              + Math.sin(handoffProgress * Math.PI) * 14 * arcDirection,
            y: lerp(heldY, BOX_Y, handoffProgress),
          });
          boxes.push({ value: valueB, index: b, x: xB, y: BOX_Y });
          carrying = true;
          const activeBox = boxes[0];
          const release = 1 - clamp((handoffProgress - 0.72) / 0.28, 0, 1);
          gripPose = { x: activeBox.x, y: activeBox.y, reach: release, grip: release };
        } else if (phase === "handoff") {
          const handoffProgress = easeOutCubic((manualSwap.phaseProgress - 0.5) / 0.5);
          const transferProgress = easeOutCubic(clamp((handoffProgress - 0.12) / 0.88, 0, 1));
          const arcDirection = xB > WIDTH / 2 ? 1 : -1;
          boxes.push({ value: valueA, index: a, x: xB, y: BOX_Y });
          boxes.push({
            value: valueB,
            index: b,
            x: lerp(xB, robot.x, transferProgress)
              + Math.sin(transferProgress * Math.PI) * 14 * arcDirection,
            y: lerp(BOX_Y, heldY, transferProgress),
          });
          carrying = true;
          const activeBox = boxes[1];
          const reach = easeOutCubic(clamp(handoffProgress / 0.3, 0, 1));
          const grip = easeOutCubic(clamp((handoffProgress - 0.1) / 0.3, 0, 1));
          gripPose = { x: activeBox.x, y: activeBox.y, reach, grip };
        } else if (phase === "carry-back") {
          boxes.push({ value: valueA, index: a, x: xB, y: BOX_Y });
          boxes.push({ value: valueB, index: b, x: robot.x, y: heldY });
          carrying = true;
          gripPose = { x: robot.x, y: heldY, reach: 1, grip: 1 };
        } else if (phase === "placing") {
          const placementProgress = easeOutCubic(clamp(rawProgress / 0.84, 0, 1));
          const contactBounce = rawProgress > 0.76
            ? Math.sin(((rawProgress - 0.76) / 0.24) * Math.PI) * 6
            : 0;
          boxes.push({ value: valueA, index: a, x: xB, y: BOX_Y });
          boxes.push({
            value: valueB,
            index: b,
            x: lerp(robot.x, xA, placementProgress),
            y: lerp(heldY, BOX_Y, placementProgress) - contactBounce,
          });
          const activeBox = boxes[1];
          const release = 1 - easeOutCubic(clamp((rawProgress - 0.68) / 0.32, 0, 1));
          carrying = release > 0.2;
          gripPose = { x: activeBox.x, y: activeBox.y, reach: release, grip: release };
          this._drawPlacementTarget(xA, rawProgress);
        }
      }

      this._drawRobot(
        robot,
        now,
        this._isNearbyActionable(frame),
        carrying,
        phase === "handoff" || phase === "placing",
        gripPose,
      );
      boxes.forEach((box) => this._drawLooseBox({ ...box, snapshot, now }));
      if (gripPose?.grip > 0.04) {
        const heldBox = boxes.find((box) => Math.abs(box.y - heldY) < 70 && Math.abs(box.x - robot.x) < 70);
        const grippedBox = heldBox ?? boxes.find((box) => box.x === gripPose.x && box.y === gripPose.y);
        if (grippedBox) this._drawGripHands(grippedBox.x, grippedBox.y, gripPose.grip);
      }
    }

    _drawPlacementTarget(x, progress) {
      const context = this.context;
      const pulse = Math.sin(progress * Math.PI);
      context.save();
      context.globalAlpha = 0.24 + pulse * 0.42;
      context.strokeStyle = COLORS.gold;
      context.lineWidth = 3;
      context.beginPath();
      context.ellipse(x, BOX_Y + BOX_SIZE / 2 + 8, 44 + pulse * 10, 11 + pulse * 3, 0, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }

    _drawLooseBox({ x, y, value, index, snapshot, now }) {
      this._drawBox({
        x,
        y,
        value,
        index,
        snapshot,
        reachable: false,
        swapping: true,
        now,
      });
    }

    _drawBox({ x, y, value, index, snapshot, reachable, swapping, now }) {
      const context = this.context;
      const half = BOX_SIZE / 2;
      const inSegment = snapshot.segment
        && index >= snapshot.segment.start
        && index <= snapshot.segment.end;
      const isPivot = snapshot.pivotIndex === index;
      const selected = snapshot.selected === index;
      const resolved = snapshot.resolved.has(index);
      const locked = !inSegment && !resolved && snapshot.state !== GameState.VICTORY;
      const bob = selected ? Math.sin(now / 115) * 4 - 10 : 0;
      y += bob;

      context.save();
      if (locked) {
        // CanvasRenderingContext2D.filter pode cair em software em GPUs integradas.
        // A paleta dessaturada mantém o efeito sem filtrar cada caixa a cada frame.
        context.globalAlpha = 0.48;
      }
      context.shadowBlur = 0;
      if (resolved) {
        context.shadowColor = COLORS.green;
        context.shadowBlur = 18;
      } else if (isPivot) {
        context.shadowColor = COLORS.gold;
        context.shadowBlur = 21 + Math.sin(now / 180) * 5;
      } else if (selected || swapping) {
        context.shadowColor = COLORS.ink;
        context.shadowBlur = 18;
      }

      const crateGradient = context.createLinearGradient(x - half, y - half, x + half, y + half);
      crateGradient.addColorStop(0, locked ? "#33474b" : resolved ? "#1c6146" : "#77541c");
      crateGradient.addColorStop(0.18, locked ? "#496065" : resolved ? "#267a59" : "#9b7129");
      crateGradient.addColorStop(1, locked ? "#24363a" : resolved ? "#133d31" : "#4a351a");
      context.fillStyle = crateGradient;
      context.strokeStyle = locked
        ? "#78949a"
        : resolved ? COLORS.green : isPivot ? COLORS.gold : "#c28d35";
      context.lineWidth = isPivot || resolved ? 4 : 2;
      roundedRect(context, x - half, y - half, BOX_SIZE, BOX_SIZE, 8);
      context.fill();
      context.stroke();

      context.strokeStyle = locked
        ? "rgba(174,198,203,.28)"
        : resolved ? "rgba(101,237,154,.38)" : "rgba(255,220,145,.32)";
      context.lineWidth = 6;
      context.strokeRect(x - half + 13, y - half + 13, BOX_SIZE - 26, BOX_SIZE - 26);
      context.beginPath();
      context.moveTo(x - half + 12, y - half + 12);
      context.lineTo(x + half - 12, y + half - 12);
      context.moveTo(x + half - 12, y - half + 12);
      context.lineTo(x - half + 12, y + half - 12);
      context.stroke();

      context.fillStyle = "rgba(4,18,22,.9)";
      context.beginPath();
      context.arc(x, y, 27, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = locked ? "#d0dcde" : "#ffffff";
      context.font = "900 31px Bahnschrift, Segoe UI";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(value, x, y + 1);

      if (reachable && !swapping && !locked) {
        context.strokeStyle = "rgba(255,255,255,.86)";
        context.lineWidth = 3;
        context.setLineDash([5, 5]);
        roundedRect(context, x - half - 7, y - half - 7, BOX_SIZE + 14, BOX_SIZE + 14, 12);
        context.stroke();
        context.setLineDash([]);
      }

      if (isPivot && !resolved) this._drawTag(x, y - half - 24, "PIVÔ", COLORS.gold);
      if (resolved) this._drawTag(x, y + half + 19, "FIXADO", COLORS.green);
      if (selected) this._drawTag(x, y + half + 20, "SELECIONADA", COLORS.ink);
      context.restore();
      if (locked) this._drawLockedBoxBadge(x, y);
    }

    _drawLockedBoxBadge(x, y) {
      const context = this.context;
      context.save();
      context.fillStyle = "rgba(3,15,19,.9)";
      context.strokeStyle = "#718b91";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x + 33, y - 34, 17, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      this._drawPadlock(x + 33, y - 34, "#9aafb3", 0.72);
      context.restore();
    }

    _drawPadlock(x, y, color, scale = 1) {
      const context = this.context;
      context.save();
      context.translate(x, y);
      context.scale(scale, scale);
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(0, -3, 7, Math.PI, 0);
      context.stroke();
      roundedRect(context, -9, -3, 18, 14, 3);
      context.fill();
      context.fillStyle = "#0a1b20";
      context.beginPath();
      context.arc(0, 3, 2, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    _isNearbyActionable(frame) {
      const index = frame.nearbyIndex;
      if (index === null || !frame.snapshot.segment) return false;
      if (frame.manualSwap?.phase === "carry-back") return index === frame.manualSwap.a;
      return index >= frame.snapshot.segment.start && index <= frame.snapshot.segment.end;
    }

    _drawTag(x, y, text, color) {
      const context = this.context;
      context.save();
      context.font = "800 11px Bahnschrift, Segoe UI";
      const width = context.measureText(text).width + 16;
      context.fillStyle = "rgba(3,17,22,.92)";
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      roundedRect(context, x - width / 2, y - 11, width, 22, 5);
      context.fill();
      context.stroke();
      context.fillStyle = color;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, x, y + 0.5);
      context.restore();
    }

    _drawPointers(snapshot, delta, now) {
      if (!snapshot.segment || snapshot.state === GameState.VICTORY) return;
      const iTarget = this.boxX(snapshot.i);
      const jTarget = this.boxX(snapshot.j);
      const followSpeed = 1 - Math.pow(0.001, delta);
      this.pointerPositions.i = lerp(this.pointerPositions.i, iTarget, followSpeed);
      this.pointerPositions.j = lerp(this.pointerPositions.j, jTarget, followSpeed);
      this._drawPointer(this.pointerPositions.i, 240, "i", COLORS.cyan, now, snapshot.state === GameState.SWAP_I_J);
      this._drawPointer(this.pointerPositions.j, 286, "j", COLORS.magenta, now, snapshot.state === GameState.SWAP_I_J || snapshot.state === GameState.PLACE_PIVOT);
    }

    _drawPointer(x, y, label, color, now, waiting) {
      const context = this.context;
      const hover = Math.sin(now / 180 + (label === "i" ? 0 : 1.7)) * 4;
      y += hover;
      context.save();
      context.shadowColor = color;
      context.shadowBlur = waiting ? 22 : 12;
      context.fillStyle = "#0b242c";
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y, 21, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = color;
      context.font = "900 22px Consolas, monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(label, x, y + 1);
      context.beginPath();
      context.moveTo(x, y + 25);
      context.lineTo(x - 10, y + 43);
      context.lineTo(x + 10, y + 43);
      context.closePath();
      context.fill();
      context.restore();
    }

    _getRobotMotion(robot, now, suppressWalking = false) {
      const walking = robot.moving && !suppressWalking;
      const gaitDuration = robot.sprinting ? 55 : 90;
      return {
        walking,
        step: walking ? Math.sin(now / gaitDuration) * (robot.sprinting ? 11 : 8) : 0,
        bob: walking
          ? Math.abs(Math.sin(now / gaitDuration)) * (robot.sprinting ? -6 : -4)
          : Math.sin(now / 500) * 2,
      };
    }

    _drawRobot(robot, now, canInteract, carrying = false, suppressWalking = false, gripPose = null) {
      const context = this.context;
      const { walking, step, bob } = this._getRobotMotion(robot, now, suppressWalking);
      const pose = this._getRobotPose(robot, now, Boolean(gripPose || carrying));
      const sprinting = walking && robot.sprinting;
      const bodyColor = sprinting ? "#71366f" : "#294b54";
      const headColor = sprinting ? "#422443" : "#17333b";
      const accentColor = canInteract ? "#ffffff" : sprinting ? COLORS.magenta : COLORS.cyan;
      const profileEyeColor = sprinting ? COLORS.magenta : COLORS.cyan;
      const x = robot.x;
      const y = robot.y + bob;
      const bodyHalf = lerp(34, 24, pose.side);
      const headHalf = lerp(39, 28, pose.side);
      const legSpread = lerp(17, 8, pose.side);
      const antennaX = pose.side * 8;

      context.save();
      context.translate(x, y);
      context.scale(robot.facing, 1);
      context.shadowColor = canInteract ? COLORS.ink : sprinting ? COLORS.magenta : COLORS.cyan;
      context.shadowBlur = canInteract ? 20 : sprinting ? 18 : 9;

      context.strokeStyle = "#7296a0";
      context.lineWidth = 9;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(-legSpread, 35);
      context.lineTo(-legSpread - 4 + step, 58);
      context.moveTo(legSpread, 35);
      context.lineTo(legSpread + 4 - step, 58);
      context.stroke();

      context.fillStyle = bodyColor;
      context.strokeStyle = accentColor;
      context.lineWidth = 3;
      roundedRect(context, -bodyHalf, -15, bodyHalf * 2, 59, lerp(16, 12, pose.side));
      context.fill();
      context.stroke();

      context.fillStyle = headColor;
      roundedRect(context, -headHalf, -57, headHalf * 2, 49, lerp(14, 11, pose.side));
      context.fill();
      context.stroke();

      const faceAlpha = (1 - pose.side) * (1 - pose.back);
      if (faceAlpha > 0.01) {
        context.save();
        context.globalAlpha = faceAlpha;
        context.fillStyle = accentColor;
        context.beginPath();
        context.arc(-15, -33, 6, 0, Math.PI * 2);
        context.arc(15, -33, 6, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = profileEyeColor;
        context.lineWidth = 2;
        context.beginPath();
        context.arc(-15, -33, 10, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.arc(15, -33, 10, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }

      const profileAlpha = pose.side * (1 - pose.back);
      if (profileAlpha > 0.01) {
        context.save();
        context.globalAlpha = profileAlpha;
        context.fillStyle = headColor;
        context.strokeStyle = profileEyeColor;
        context.lineWidth = 2;
        roundedRect(context, headHalf - 3, -43, 13, 20, 5);
        context.fill();
        context.stroke();
        context.fillStyle = profileEyeColor;
        roundedRect(context, headHalf + 1, -38, 6, 10, 3);
        context.fill();
        context.restore();
      }

      if (pose.back > 0.01) {
        context.save();
        context.globalAlpha = pose.back;
        context.fillStyle = "#102a32";
        context.strokeStyle = accentColor;
        context.lineWidth = 2;
        roundedRect(context, -22, -48, 44, 30, 8);
        context.fill();
        context.stroke();
        context.strokeStyle = "#63868e";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(-12, -39);
        context.lineTo(12, -39);
        context.moveTo(-12, -32);
        context.lineTo(12, -32);
        context.stroke();
        context.fillStyle = COLORS.gold;
        context.beginPath();
        context.arc(0, -24, 3, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      context.strokeStyle = "#789da5";
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(antennaX, -58);
      context.lineTo(antennaX, -73);
      context.stroke();
      context.fillStyle = COLORS.gold;
      context.beginPath();
      context.arc(antennaX, -79, 6, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = "#7799a1";
      context.lineWidth = 8;
      context.beginPath();
      if (gripPose) {
        this._drawReachingArms(robot, y, step, gripPose);
      } else if (carrying) {
        context.moveTo(-29, 0);
        context.lineTo(-42, -67);
        context.moveTo(29, 0);
        context.lineTo(42, -67);
        context.stroke();
      } else {
        const frontArmAlpha = 1 - pose.side;
        if (frontArmAlpha > 0.01) {
          context.save();
          context.globalAlpha = frontArmAlpha;
          context.beginPath();
          context.moveTo(-32, 2);
          context.lineTo(-54, 18 - step / 2);
          context.moveTo(32, 2);
          context.lineTo(54, 18 + step / 2);
          context.stroke();
          context.restore();
        }
        if (pose.side > 0.01) {
          const backwardLean = 14 + Math.abs(step) * 0.25;
          context.save();
          context.globalAlpha = pose.side;
          context.beginPath();
          context.moveTo(-4, 1);
          context.lineTo(-backwardLean, 22 + step * 0.12);
          context.moveTo(4, 1);
          context.lineTo(-backwardLean - 4, 25 - step * 0.12);
          context.stroke();
          context.restore();
        }
      }
      context.restore();

      if (canInteract) {
        this._drawTag(x, y - 105, "E  INTERAGIR", COLORS.ink);
      }
    }

    _getRobotPose(robot, now, interacting = false) {
      const targetSide = interacting ? 0 : robot.moving ? 1 : 0;
      const targetBack = interacting ? 1 : 0;
      if (this.robotPose.lastTime === null) {
        this.robotPose.side = targetSide;
        this.robotPose.back = targetBack;
        this.robotPose.lastTime = now;
        return { side: targetSide, back: targetBack };
      }

      const elapsed = Math.max(0, now - this.robotPose.lastTime);
      this.robotPose.lastTime = now;
      const transition = easeOutCubic(clamp(elapsed / POSE_TRANSITION_DURATION, 0, 1));
      this.robotPose.side = lerp(this.robotPose.side, targetSide, transition);
      this.robotPose.back = lerp(this.robotPose.back, targetBack, transition);
      if (Math.abs(this.robotPose.side - targetSide) < 0.01) this.robotPose.side = targetSide;
      if (Math.abs(this.robotPose.back - targetBack) < 0.01) this.robotPose.back = targetBack;
      return { side: this.robotPose.side, back: this.robotPose.back };
    }

    _drawReachingArms(robot, robotY, step, gripPose) {
      const context = this.context;
      const reach = clamp(gripPose.reach, 0, 1);
      const targetXs = [
        (gripPose.x - BOX_SIZE / 2 + 7 - robot.x) * robot.facing,
        (gripPose.x + BOX_SIZE / 2 - 7 - robot.x) * robot.facing,
      ].sort((left, right) => left - right);
      const targetY = clamp(gripPose.y + BOX_SIZE / 2 - robotY - 2, -102, 24);
      const shoulders = [-29, 29];
      const idleHands = [-50, 50];

      shoulders.forEach((shoulderX, index) => {
        const side = index === 0 ? -1 : 1;
        const handX = lerp(idleHands[index], targetXs[index], reach);
        const handY = lerp(18 + side * step * 0.2, targetY, reach);
        const elbowX = lerp(shoulderX, handX, 0.52) + side * (9 - reach * 4);
        const elbowY = lerp(1, handY, 0.48) + 10;
        context.moveTo(shoulderX, 0);
        context.lineTo(elbowX, elbowY);
        context.lineTo(handX, handY);
      });
      context.stroke();
    }

    _updateSpeedTrails(robot, now, suppressed = false) {
      const previous = this.lastRobotPosition;
      this.lastRobotPosition = { x: robot.x, y: robot.y };
      if (!previous || suppressed || !robot.moving || !robot.sprinting) return;

      const dx = robot.x - previous.x;
      const dy = robot.y - previous.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.5 || distance > 100 || now - this.lastSpeedTrailAt < 45) return;

      this.lastSpeedTrailAt = now;
      const directionX = dx / distance;
      const directionY = dy / distance;
      const perpendicularX = -directionY;
      const perpendicularY = directionX;
      for (let index = 0; index < 2; index += 1) {
        const offset = (Math.random() - 0.5) * 30;
        const length = 18 + Math.random() * 18;
        const x = robot.x - directionX * 43 + perpendicularX * offset;
        const y = robot.y - 24 - directionY * 34 + perpendicularY * offset;
        this.speedTrails.push({
          x,
          y,
          endX: x - directionX * length,
          endY: y - directionY * length,
          age: 0,
          life: 0.32,
          maxLife: 0.32,
          width: 2 + Math.random() * 2,
        });
      }
      if (this.speedTrails.length > 14) {
        this.speedTrails.splice(0, this.speedTrails.length - 14);
      }
    }

    _drawSpeedTrails(delta) {
      const context = this.context;
      this.speedTrails = this.speedTrails.filter((trail) => {
        trail.age += delta;
        trail.life -= delta;
        if (trail.life <= 0) return false;
        const fadeIn = clamp(trail.age / 0.07, 0, 1);
        const fadeOut = clamp(trail.life / 0.18, 0, 1);
        context.save();
        context.globalAlpha = fadeIn * fadeOut * 0.62;
        context.strokeStyle = COLORS.magenta;
        context.lineWidth = trail.width;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(trail.x, trail.y);
        context.lineTo(trail.endX, trail.endY);
        context.stroke();
        context.restore();
        return true;
      });
    }

    _drawGripHands(x, boxY, grip = 1) {
      const context = this.context;
      const half = BOX_SIZE / 2;
      const inset = lerp(-4, 5, clamp(grip, 0, 1));
      const radius = lerp(5, 8, clamp(grip, 0, 1));
      context.save();
      context.fillStyle = "#9ec3ca";
      context.strokeStyle = "#17333b";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x - half + inset, boxY + half - 2, radius, 0, Math.PI * 2);
      context.arc(x + half - inset, boxY + half - 2, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.restore();
    }

    _drawComparison(snapshot, now) {
      if (!snapshot.comparison || now - snapshot.comparison.timestamp > COMPARISON_DURATION) return;
      const context = this.context;
      const x = snapshot.comparison.index === null
        ? WIDTH / 2
        : this.boxX(snapshot.comparison.index);
      const age = now - snapshot.comparison.timestamp;
      context.save();
      const fadeDuration = 700;
      const fadeStart = COMPARISON_DURATION - fadeDuration;
      context.globalAlpha = clamp(1 - Math.max(0, age - fadeStart) / fadeDuration, 0, 1);
      context.fillStyle = snapshot.comparison.correct ? COLORS.green : COLORS.red;
      context.font = "900 19px Bahnschrift, Segoe UI";
      context.textAlign = "center";
      context.shadowColor = "#000";
      context.shadowBlur = 8;
      context.fillText(snapshot.comparison.text, x, 190 - age * 0.012);
      context.restore();
    }

    _drawParticles(delta) {
      const context = this.context;
      this.particles = this.particles.filter((particle) => {
        particle.life -= delta;
        if (particle.life <= 0) return false;
        particle.vy += particle.gravity * delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        context.save();
        context.globalAlpha = Math.min(1, particle.life);
        context.fillStyle = particle.color;
        context.translate(particle.x, particle.y);
        context.rotate(particle.life * 3);
        context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 1.8);
        context.restore();
        return true;
      });
    }

    _drawPauseOverlay(manualPaused = false, menuOpen = false) {
      const context = this.context;
      const centerX = menuOpen ? WIDTH / 4 : WIDTH / 2;
      context.fillStyle = "rgba(2,12,16,.7)";
      context.fillRect(0, 0, WIDTH, HEIGHT);
      context.fillStyle = COLORS.ink;
      context.textAlign = "center";
      context.font = "900 36px Bahnschrift, Segoe UI";
      context.fillText("PAUSADO", centerX, HEIGHT / 2 - 8);
      context.fillStyle = COLORS.muted;
      context.font = "600 18px Bahnschrift, Segoe UI";
      context.fillText(
        manualPaused ? "Pressione P ou use o botão para continuar" : "Clique na área do jogo para continuar",
        centerX,
        HEIGHT / 2 + 30,
      );
    }
  }

  namespace.Renderer = Renderer;
})(window.SortFactory || (window.SortFactory = {}));
