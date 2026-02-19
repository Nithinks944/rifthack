import InputForm from './components/InputForm';
import MetricCards from './components/MetricCards';
import FixesTable from './components/FixesTable';
import Timeline from './components/Timeline';
import ScoreBreakdown from './components/ScoreBreakdown';
import RunSummaryCard from './components/RunSummaryCard';
import { useDevOpsAgent } from './hooks/useDevOpsAgent';

function App() {
  const { metrics, fixes, timeline, score, summary, isRunning, error, runAgent } = useDevOpsAgent();

  return (
    <div className="min-h-screen bg-navy text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="glass-card mb-6 flex flex-col gap-2 rounded-2xl p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Autonomous DevOps Agent Dashboard</h1>
            <p className="mt-1 text-sm text-slate-300">Multi-agent CI/CD self-healing with real-time observability</p>
          </div>
          <span className={`status-badge ${isRunning ? 'status-running' : 'status-idle'}`}>
            {isRunning ? 'RUNNING' : 'READY'}
          </span>
        </header>

        <InputForm onSubmit={runAgent} isRunning={isRunning} />

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</div>
        ) : null}

        <div className="mt-6">
          <RunSummaryCard summary={summary} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <MetricCards metrics={metrics} />
            <div className="mt-6">
              <FixesTable fixes={fixes} />
            </div>
            <div className="mt-6">
              <Timeline timeline={timeline} />
            </div>
          </div>
          <div>
            <ScoreBreakdown score={score} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
