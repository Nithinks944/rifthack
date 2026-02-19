function SummaryField({ label, value }) {
  const display = value === undefined || value === null || value === '' ? '-' : String(value);
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100 break-all">{display}</p>
    </div>
  );
}

function RunSummaryCard({ summary }) {
  const statusClass =
    summary.finalStatus === 'PASS'
      ? 'status-pass'
      : summary.finalStatus === 'FAILED_MAX_RETRIES' || summary.finalStatus === 'ERROR'
        ? 'status-fail'
        : 'status-running';

  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Run Summary</h2>
        <span className={`status-badge ${statusClass}`}>{summary.finalStatus || 'IDLE'}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryField label="Repository URL" value={summary.repository} />
        <SummaryField label="Team Name" value={summary.teamName} />
        <SummaryField label="Team Leader" value={summary.leaderName} />
        <SummaryField label="Branch Name" value={summary.branchName} />
        <SummaryField label="Total Failures" value={summary.totalFailuresDetected} />
        <SummaryField label="Total Fixes Applied" value={summary.totalFixesApplied} />
        <SummaryField label="Iterations" value={summary.iterationsUsed} />
        <SummaryField label="Commits" value={summary.commitCount} />
        <SummaryField label="Total Time" value={summary.totalTime} />
      </div>
    </section>
  );
}

export default RunSummaryCard;
