function Timeline({ timeline }) {
  return (
    <section className="glass-card rounded-2xl p-5">
      <h2 className="mb-4 text-lg font-semibold text-white">CI/CD Iteration Timeline</h2>
      <ol className="space-y-3">
        {timeline.length === 0 ? (
          <li className="text-sm text-slate-400">No pipeline activity yet.</li>
        ) : (
          timeline.map((step, index) => (
            <li key={`${step.retry}-${index}`} className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">Retry {step.retry}/5</span>
                <span className={`status-badge ${step.status === 'PASS' ? 'status-pass' : step.status === 'FAIL' ? 'status-fail' : 'status-running'}`}>
                  {step.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{step.message}</p>
              <p className="mt-1 text-xs text-slate-400">{step.time}</p>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}

export default Timeline;
