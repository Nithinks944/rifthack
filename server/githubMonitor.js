import axios from 'axios';

const POLL_INTERVAL = 30000; // 30 seconds
const workflowStates = new Map();

export class GitHubMonitor {
  constructor(token, owner, repo) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.pollTimer = null;
    this.isRunning = false;
  }

  async getWorkflowRuns() {
    try {
      const response = await axios.get(
        `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github.v3+json'
          },
          params: {
            per_page: 10,
            page: 1
          }
        }
      );
      return response.data.workflow_runs || [];
    } catch (error) {
      console.error('❌ GitHub API error:', error.message);
      return [];
    }
  }

  async checkForFailures() {
    const runs = await this.getWorkflowRuns();
    const newFailures = [];

    for (const run of runs) {
      const key = `${run.id}`;
      const previousState = workflowStates.get(key);
      const currentState = {
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        head_sha: run.head_sha,
        created_at: run.created_at
      };

      workflowStates.set(key, currentState);

      // Detect new failures
      if (
        run.status === 'completed' &&
        run.conclusion === 'failure' &&
        (!previousState || previousState.conclusion !== 'failure')
      ) {
        newFailures.push({
          id: run.id,
          name: run.name,
          sha: run.head_sha,
          url: run.html_url,
          created_at: run.created_at
        });
      }
    }

    if (newFailures.length > 0) {
      this.logFailures(newFailures);
    }

    return newFailures;
  }

  logFailures(failures) {
    console.log('\n🚨 NEW WORKFLOW FAILURES DETECTED 🚨');
    failures.forEach((failure) => {
      console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Workflow: ${failure.name}
  Run ID: ${failure.id}
  SHA: ${failure.sha.substring(0, 7)}
  URL: ${failure.url}
  Time: ${new Date(failure.created_at).toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      `);
    });
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️  GitHub monitor already running');
      return;
    }

    this.isRunning = true;
    console.log(`✅ GitHub monitor started for ${this.owner}/${this.repo}`);
    console.log(`🔄 Polling every ${POLL_INTERVAL / 1000} seconds`);

    // Initial check
    this.checkForFailures();

    // Start polling
    this.pollTimer = setInterval(() => {
      this.checkForFailures();
    }, POLL_INTERVAL);
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isRunning = false;
    console.log('🛑 GitHub monitor stopped');
  }

  async handleWebhook(payload) {
    const { action, workflow_run } = payload;

    if (!workflow_run) {
      return { acknowledged: false, reason: 'No workflow_run in payload' };
    }

    const key = `${workflow_run.id}`;
    const previousState = workflowStates.get(key);

    const currentState = {
      id: workflow_run.id,
      name: workflow_run.name,
      status: workflow_run.status,
      conclusion: workflow_run.conclusion,
      head_sha: workflow_run.head_sha,
      created_at: workflow_run.created_at
    };

    workflowStates.set(key, currentState);

    console.log(`📥 Webhook received: ${action} - ${workflow_run.name} (${workflow_run.status})`);

    if (
      workflow_run.status === 'completed' &&
      workflow_run.conclusion === 'failure' &&
      (!previousState || previousState.conclusion !== 'failure')
    ) {
      this.logFailures([
        {
          id: workflow_run.id,
          name: workflow_run.name,
          sha: workflow_run.head_sha,
          url: workflow_run.html_url,
          created_at: workflow_run.created_at
        }
      ]);

      return { acknowledged: true, newFailure: true };
    }

    return { acknowledged: true, newFailure: false };
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      owner: this.owner,
      repo: this.repo,
      trackedWorkflows: workflowStates.size,
      pollInterval: POLL_INTERVAL
    };
  }
}
