import axios from 'axios';

export function nowLabel() {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export function makeTimelineEntry(iteration, maxRetries, status, message) {
  return {
    iteration,
    maxRetries,
    status,
    message,
    time: nowLabel()
  };
}

export function buildScore({ elapsedMs, commitCount, pipelinePassed, pushSucceeded }) {
  const base = 100;
  const max = 110;
  const speedBonus = pipelinePassed && pushSucceeded && elapsedMs < 5 * 60 * 1000 ? 10 : 0;
  const efficiencyPenalty = Math.max(0, commitCount - 20) * 2;
  const deliveryPenalty = pipelinePassed && pushSucceeded ? 0 : 60;
  const total = Math.max(0, Math.min(max, base + speedBonus - efficiencyPenalty - deliveryPenalty));

  return {
    total,
    base,
    max,
    speedBonus,
    efficiencyPenalty,
    deliveryPenalty
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollGitHubActions({ githubUrl, branchName, token }) {
  if (!token) {
    console.log('⚠️  No GITHUB_TOKEN - skipping pipeline verification');
    return { 
      pipelinePassed: false, 
      reason: 'GITHUB_TOKEN not configured',
      configurationError: true 
    };
  }

  const match = githubUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!match) {
    console.log('⚠️  Invalid GitHub URL format');
    return { pipelinePassed: false, reason: 'Invalid GitHub URL' };
  }

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, '');

  console.log(`\n🔍 Monitoring GitHub Actions for ${owner}/${cleanRepo} on branch ${branchName}...`);

  const POLL_INTERVAL = 10000; // 10 seconds
  const TIMEOUT = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();

  try {
    while (Date.now() - startTime < TIMEOUT) {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${cleanRepo}/actions/runs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json'
          },
          params: {
            branch: branchName,
            per_page: 1
          }
        }
      );

      const runs = response.data.workflow_runs || [];

      if (runs.length === 0) {
        console.log(`⏳ No workflow runs found yet for branch ${branchName}. Waiting...`);
        await sleep(POLL_INTERVAL);
        continue;
      }

      const latestRun = runs[0];
      const { status, conclusion, html_url, name } = latestRun;

      console.log(`📊 Workflow: ${name} | Status: ${status} | Conclusion: ${conclusion || 'pending'}`);

      if (status === 'completed') {
        if (conclusion === 'success') {
          console.log(`✅ GitHub Actions PASSED: ${html_url}`);
          return { 
            pipelinePassed: true, 
            workflowUrl: html_url,
            workflowName: name,
            conclusion 
          };
        } else {
          console.log(`❌ GitHub Actions FAILED (${conclusion}): ${html_url}`);
          return { 
            pipelinePassed: false, 
            workflowUrl: html_url,
            workflowName: name,
            conclusion 
          };
        }
      }

      await sleep(POLL_INTERVAL);
    }

    console.log('⏰ GitHub Actions polling timed out after 5 minutes');
    return { pipelinePassed: false, reason: 'Timeout after 5 minutes' };

  } catch (error) {
    console.error('❌ GitHub API error:', error.message);
    return { pipelinePassed: false, reason: error.message };
  }
}
