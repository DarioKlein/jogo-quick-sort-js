(function initializeRunScoring(namespace) {
  "use strict";

  const TIME_PENALTY_PER_SECOND = 3;

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

  namespace.RunScoring = Object.freeze({ TIME_PENALTY_PER_SECOND, calculateRunStats });
})(window.SortFactory || (window.SortFactory = {}));
