function ScoreBreakdown({ score }) {
  const max = score.max || 110;
  const clamped = Math.max(0, Math.min(max, score.total));
  const percent = Math.round((clamped / max) * 100);

  return (
    <section className="glass-card rounded-2xl p-5">
      <h2 className="text-lg font-semibold text-white">Score Breakdown</h2>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-neon to-emerald" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-3 text-2xl font-bold text-neon">{clamped}/{max}</p>

      <ul className="mt-4 space-y-2 text-sm text-slate-200">
        <li>Base Score: {score.base}</li>
        <li>Speed Bonus: +{score.speedBonus}</li>
        <li>Efficiency Penalty: -{score.efficiencyPenalty}</li>
        <li>Delivery Penalty: -{score.deliveryPenalty || 0}</li>
      </ul>

      <p className="mt-4 rounded-lg border border-slate-700/60 bg-slate-900/30 p-3 text-xs text-slate-300">
        Formula: final = 100 + speedBonus - (2 × commitsOver20) - deliveryPenalty
      </p>
    </section>
  );
}

export default ScoreBreakdown;
