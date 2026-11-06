(function initializeRunScoring(namespace) {
  "use strict";

  const TIME_PENALTY_PER_SECOND = 3;

  function calculatePlayableTime({
    start,
    end,
    pausedMs = 0,
    activePauseMs = 0,
    phaseDowntimeMs = 0,
  }) {
    if (start === null || start === undefined) return 0;
    return Math.max(
      0,
      end - start - pausedMs - activePauseMs - phaseDowntimeMs,
    );
  }

  function calculateRunStats({
    phaseCount,
    initialPhaseScore,
    completedScoreDelta,
    completedErrors,
    currentPhaseScore,
    currentPhaseErrors,
    phaseCommitted,
    timeMs,
  }) {
    const safeTimeMs = Math.max(0, Math.round(Number(timeMs) || 0));
    const currentDelta = phaseCommitted ? 0 : currentPhaseScore - initialPhaseScore;
    const rawScore = initialPhaseScore * phaseCount + completedScoreDelta + currentDelta;
    const timePenalty = Math.floor(safeTimeMs / 1000) * TIME_PENALTY_PER_SECOND;
    return {
      score: Math.max(0, rawScore - timePenalty),
      rawScore,
      timePenalty,
      timeMs: safeTimeMs,
      errors: completedErrors + (phaseCommitted ? 0 : currentPhaseErrors),
    };
  }

  namespace.RunScoring = Object.freeze({
    TIME_PENALTY_PER_SECOND,
    calculatePlayableTime,
    calculateRunStats,
  });
})(window.SortFactory || (window.SortFactory = {}));
