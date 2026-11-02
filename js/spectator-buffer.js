(function initializeSpectatorBuffer(namespace) {
  "use strict";

  const { clamp, lerp } = namespace.Utils;
  const DEFAULT_DELAY_MS = 320;
  const DEFAULT_MAX_DELAY_MS = 700;
  const DEFAULT_MAX_FRAMES = 48;
  const TELEPORT_DISTANCE = 100;
  const JITTER_WEIGHT = 0.25;
  const DELAY_RECOVERY_WEIGHT = 0.04;
  const MAX_PLAYBACK_RATE_CORRECTION = 0.1;

  class SpectatorBuffer {
    constructor({
      delayMs = DEFAULT_DELAY_MS,
      maxDelayMs = DEFAULT_MAX_DELAY_MS,
      maxFrames = DEFAULT_MAX_FRAMES,
    } = {}) {
      this.minimumDelayMs = delayMs;
      this.maximumDelayMs = Math.max(delayMs, maxDelayMs);
      this.maxFrames = maxFrames;
      this.reset();
    }

    get size() {
      return this.frames.length;
    }

    get delayMs() {
      return this.adaptiveDelayMs;
    }

    reset() {
      this.frames = [];
      this.lastSequence = -1;
      this.clockOffset = null;
      this.jitterMs = 0;
      this.adaptiveDelayMs = this.minimumDelayMs;
      this.lastArrival = null;
      this.playbackTime = null;
      this.lastSampleAt = null;
    }

    push(frame, { serverTime, sequence, receivedAt = performance.now() }) {
      if (!frame || !Number.isFinite(serverTime) || !Number.isFinite(sequence)) return false;
      if (sequence <= this.lastSequence) return false;

      this.lastSequence = sequence;
      const measuredOffset = receivedAt - serverTime;
      this.clockOffset = this.clockOffset === null
        ? measuredOffset
        : Math.min(this.clockOffset, measuredOffset);

      if (this.lastArrival) {
        const serverGap = Math.max(0, serverTime - this.lastArrival.serverTime);
        const arrivalGap = Math.max(0, receivedAt - this.lastArrival.receivedAt);
        const variation = Math.abs(arrivalGap - serverGap);
        this.jitterMs = lerp(this.jitterMs, variation, JITTER_WEIGHT);
        const desiredDelay = clamp(
          this.minimumDelayMs + this.jitterMs * 3,
          this.minimumDelayMs,
          this.maximumDelayMs,
        );
        this.adaptiveDelayMs = desiredDelay > this.adaptiveDelayMs
          ? desiredDelay
          : lerp(this.adaptiveDelayMs, desiredDelay, DELAY_RECOVERY_WEIGHT);
      }
      this.lastArrival = { serverTime, receivedAt };

      this.frames.push({ frame, serverTime, sequence });
      if (this.frames.length > this.maxFrames) {
        this.frames.splice(0, this.frames.length - this.maxFrames);
      }
      return true;
    }

    sample(now = performance.now()) {
      if (this.frames.length === 0) return null;
      if (this.frames.length === 1 || this.clockOffset === null) return this.frames[0].frame;

      const desiredTime = now - this.clockOffset - this.adaptiveDelayMs;
      if (this.playbackTime === null || this.lastSampleAt === null) {
        this.playbackTime = Math.min(desiredTime, this.frames.at(-1).serverTime);
      } else {
        const elapsed = clamp(now - this.lastSampleAt, 0, 100);
        const drift = desiredTime - this.playbackTime;
        const correctionLimit = elapsed * MAX_PLAYBACK_RATE_CORRECTION;
        const advance = Math.max(0, elapsed + clamp(drift, -correctionLimit, correctionLimit));
        this.playbackTime = Math.min(
          this.playbackTime + advance,
          this.frames.at(-1).serverTime,
        );
      }
      this.lastSampleAt = now;
      const targetTime = this.playbackTime;
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
