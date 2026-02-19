function MetricCards({ metrics }) {
  const cards = [
    { title: 'Current Score', value: metrics.score, tone: 'text-neon' },
    { title: 'Total Runtime', value: metrics.totalTime, tone: 'text-emerald' },
    { title: 'Pipeline Status', value: metrics.status, tone: metrics.status === 'PASS' ? 'text-emerald' : 'text-amber-300' }
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <article key={card.title} className="glass-card rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-slate-300">{card.title}</p>
          <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{card.value}</p>
        </article>
      ))}
    </div>
  );
}

export default MetricCards;
