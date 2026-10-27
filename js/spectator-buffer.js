(function initializeSpectatorBuffer(namespace) {
  "use strict";

  const { clamp, lerp } = namespace.Utils;
  const DEFAULT_DELAY_MS = 120;
  const DEFAULT_MAX_FRAMES = 24;
  const TELEPORT_DISTANCE = 100;

  class SpectatorBuffer {
    constructor({ delayMs = DEFAULT_DELAY_MS, maxFrames = DEFAULT_MAX_FRAMES } = {}) {
      this.delayMs = delayMs;
      this.maxFrames = maxFrames;
      this.reset();
    }

    get size() {
      return this.frames.length;
    }

    reset() {
      this.frames = [];
      this.lastSequence = -1;
      this.clockOffset = null;
    }

    push(frame, { serverTime, sequence, receivedAt = performance.now() }) {
      if (!frame || !Number.isFinite(serverTime) || !Number.isFinite(sequence)) return false;
      if (sequence <= this.lastSequence) return false;

      this.lastSequence = sequence;
      const measuredOffset = receivedAt - serverTime;
      this.clockOffset = this.clockOffset === null
        ? measuredOffset
        : Math.min(this.clockOffset, measuredOffset);
      this.frames.push({ frame, serverTime, sequence });
      if (this.frames.length > this.maxFrames) {
        this.frames.splice(0, this.frames.length - this.maxFrames);
      }
      return true;
    }

    sample(now = performance.now()) {
      if (this.frames.length === 0) return null;
      if (this.frames.length === 1 || this.clockOffset === null) return this.frames[0].frame;

      const targetTime = now - this.clockOffset - this.delayMs;
      while (this.frames.length > 2 && this.frames[1].serverTime <= targetTime) {
        this.frames.shift();
      }

      const older = this.frames[0];
      const newer = this.frames[1];
      if (targetTime <= older.serverTime) return older.frame;
      if (targetTime >= newer.serverTime) return newer.frame;

      const duration = Math.max(1, newer.serverTime - older.serverTime);
      const progress = clamp((targetTime - older.serverTime) / duration, 0, 1);
      return this._interpolateFrames(older.frame, newer.frame, progress);
    }

    _interpolateFrames(older, newer, progress) {
      const base = progress < 1 ? older : newer;
      return {
        ...base,
        robot: this._interpolateRobot(older.robot, newer.robot, progress),
        manualSwap: this._interpolateManualSwap(
          older.manualSwap,
          newer.manualSwap,
          progress,
        ),
      };
    }

    _interpolateRobot(older, newer, progress) {
      if (!older || !newer) return newer ?? older;
      const distance = Math.hypot(newer.x - older.x, newer.y - older.y);
      if (distance > TELEPORT_DISTANCE) return progress < 1 ? { ...older } : { ...newer };

      return {
        ...older,
        x: lerp(older.x, newer.x, progress),
        y: lerp(older.y, newer.y, progress),
        facing: progress < 0.5 ? older.facing : newer.facing,
        moving: progress < 1 ? older.moving || newer.moving : newer.moving,
      };
    }

    _interpolateManualSwap(older, newer, progress) {
      if (!older || !newer) return progress < 1 ? older : newer;
      const sameAnimation = older.a === newer.a
        && older.b === newer.b
        && older.phase === newer.phase;
      if (!sameAnimation) return progress < 1 ? older : newer;

      return {
        ...older,
        phaseProgress: Math.max(
          older.phaseProgress,
          lerp(older.phaseProgress, newer.phaseProgress, progress),
        ),
      };
    }
  }

  namespace.SpectatorBuffer = SpectatorBuffer;
})(window.SortFactory || (window.SortFactory = {}));
