function ScoreBreakdown({ score }) {
  const clamped = Math.max(0, Math.min(100, score.total));

  return (
    <section className="glass-card rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-white">Score Breakdown</h2>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-neon to-emerald" style={{ width: `${clamped}%` }} />
      </div>
      <p className="mt-3 text-2xl font-bold text-neon">{clamped}/100</p>

      <ul className="mt-4 space-y-2 text-sm text-slate-200">
        <li>Base: {score.base}</li>
        <li>Fixes Applied: +{score.fixesApplied}</li>
        <li>Retries Penalty: -{score.retriesPenalty}</li>
        <li>Failing Tests Penalty: -{score.failingPenalty}</li>
      </ul>

      <p className="mt-4 rounded-lg border border-slate-700/60 bg-slate-900/30 p-3 text-xs text-slate-300">
        Formula: total = base + fixesApplied - retriesPenalty - failingPenalty
      </p>
    </section>
  );
}

export default ScoreBreakdown;
