import axios from 'axios';
import { create } from 'zustand';

const apiBase = import.meta.env.VITE_API_BASE_URL || '';

const toApiUrl = (path) => {
  if (!apiBase) return path;
  return `${apiBase}${path}`;
};

const useDevOpsAgentStore = create((set, get) => ({
  isRunning: false,
  error: null,
  jobId: null,
  metrics: {
    score: '0/100',
    totalTime: '00:00',
    status: 'IDLE'
  },
  fixes: [],
  timeline: [],
  score: {
    total: 0,
    base: 60,
    fixesApplied: 0,
    retriesPenalty: 0,
    failingPenalty: 0
  },
  setFromSnapshot: (snapshot) => {
    set({
      isRunning: snapshot.isRunning,
      metrics: snapshot.metrics,
      fixes: snapshot.fixes,
      timeline: snapshot.timeline,
      score: snapshot.score,
      error: snapshot.error ?? null
    });
  },
  runAgent: async (payload) => {
    set({ isRunning: true, error: null, timeline: [], fixes: [] });
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
