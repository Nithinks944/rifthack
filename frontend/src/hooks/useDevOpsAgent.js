import axios from 'axios';
import { create } from 'zustand';

const apiBase = import.meta.env.VITE_API_BASE_URL || '';

const toApiUrl = (path) => {
  if (!apiBase) return path;
  return `${apiBase}${path}`;
};

const initialScore = {
  total: 0,
  base: 100,
  max: 110,
  speedBonus: 0,
  efficiencyPenalty: 0
};

const initialSummary = {
  repository: '-',
  teamName: '-',
  leaderName: '-',
  branchName: '-',
  totalFailuresDetected: 0,
  totalFixesApplied: 0,
  finalStatus: 'IDLE',
  totalTime: '00:00',
  commitCount: 0,
  iterationsUsed: '0/5'
};

const useDevOpsAgentStore = create((set, get) => ({
  isRunning: false,
  error: null,
  jobId: null,
  metrics: {
    score: '0/110',
    totalTime: '00:00',
    status: 'IDLE'
  },
  summary: initialSummary,
  fixes: [],
  timeline: [],
  score: initialScore,
  setFromSnapshot: (snapshot) => {
    set({
      isRunning: snapshot.isRunning,
      metrics: snapshot.metrics,
      summary: snapshot.summary ?? initialSummary,
      fixes: snapshot.fixes,
      timeline: snapshot.timeline,
      score: snapshot.score,
      error: snapshot.error ?? null
    });
  },
  runAgent: async (payload) => {
    set({
      isRunning: true,
      error: null,
      metrics: {
        score: '0/110',
        totalTime: '00:00',
        status: 'STARTING'
      },
      score: initialScore,
      timeline: [],
      fixes: [],
      summary: {
        ...initialSummary,
        repository: payload.githubUrl,
        teamName: payload.teamName,
        leaderName: payload.leaderName,
        iterationsUsed: `0/${Number(payload.retryLimit || 5)}`
      }
    });

    try {
      const response = await axios.post(toApiUrl('/api/run-agent'), payload);
      const jobId = response.data.jobId;
      set({ jobId });

      const source = new EventSource(toApiUrl(`/api/run-agent/stream/${jobId}`));

      source.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'snapshot') {
          get().setFromSnapshot(message.payload);
        }

        if (message.type === 'done' || message.type === 'error') {
          source.close();
          set({ isRunning: false });
        }
      };

      source.onerror = () => {
        source.close();
        set({ isRunning: false, error: 'Lost real-time connection to backend stream.' });
      };
    } catch (error) {
      set({
        isRunning: false,
        error: error.response?.data?.error || 'Failed to start autonomous agent run.'
      });
    }
  }
}));

export const useDevOpsAgent = () => useDevOpsAgentStore();
