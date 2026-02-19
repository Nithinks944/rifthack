import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { analyzeRepo, isValidCompetitionBranchName } from './agents/repoAnalyzer.js';
import { runTests } from './agents/testRunner.js';
import { classifyBugs } from './agents/bugClassifier.js';
import { generateFixes } from './agents/fixGenerator.js';
import { AI_AGENT_COMMIT_PREFIX, prepareBranch, commitFixes, pushFixBranch } from './agents/gitHandler.js';
import { buildScore, makeTimelineEntry, pollGitHubActions } from './agents/ciMonitor.js';
import { GitHubMonitor } from './githubMonitor.js';
import { formatJudgeOutput } from './formatOutput.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(express.json());

const jobs = new Map();
const streams = new Map();

let githubMonitor = null;
if (process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_REPO) {
  githubMonitor = new GitHubMonitor(
    process.env.GITHUB_TOKEN,
    process.env.GITHUB_OWNER,
    process.env.GITHUB_REPO
  );
  githubMonitor.start();
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getSnapshot(job) {
  const elapsed = Date.now() - job.startedAt;
  return {
    isRunning: job.isRunning,
    error: job.error,
    metrics: {
      score: `${job.score.total}/${job.score.max}`,
      totalTime: formatDuration(elapsed),
      status: job.status
    },
    summary: {
      repository: job.repository,
      teamName: job.teamName,
      leaderName: job.leaderName,
      branchName: job.branchName,
      totalFailuresDetected: job.totalFailuresDetected,
      totalFixesApplied: job.totalFixesApplied,
      finalStatus: job.status,
      totalTime: formatDuration(elapsed),
      commitCount: job.commitCount,
      iterationsUsed: `${job.iterationsUsed}/${job.maxRetries}`
    },
    fixes: job.fixes,
    timeline: job.timeline,
    score: job.score
  };
}

function broadcast(jobId, type, payload) {
  const clients = streams.get(jobId) || [];
  for (const response of clients) {
    response.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
  }
}

async function writeResultsFile(output) {
  const outputPath = path.join(__dirname, 'results.json');
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
}

async function runAgent(jobId, input) {
  const job = jobs.get(jobId);

  try {
    const runDir = path.join(__dirname, 'runs', jobId);
    const analysis = await analyzeRepo({ ...input, workDir: runDir });
    job.branchName = analysis.branchName;
    broadcast(jobId, 'snapshot', getSnapshot(job));

    if (!isValidCompetitionBranchName(analysis.branchName)) {
      throw new Error(`Policy violation: branch '${analysis.branchName}' does not match required TEAM_LEADER_AI_Fix format.`);
    }

    await prepareBranch(analysis.repoRoot, analysis.branchName);

    // Validate configuration before starting retry loop
    if (!process.env.GITHUB_TOKEN) {
      job.status = 'CONFIGURATION_ERROR';
      job.iterationsUsed = 0;
      job.timeline.push(makeTimelineEntry(0, job.maxRetries, 'FAIL', 
        '❌ GITHUB_TOKEN not configured. Cannot verify GitHub Actions. Set GITHUB_TOKEN in .env file.'));
      broadcast(jobId, 'snapshot', getSnapshot(job));
      
      const finalOutput = {
        jobId,
        repository: job.repository,
        branch: job.branchName,
        teamName: job.teamName,
        leaderName: job.leaderName,
        retriesUsed: 0,
        maxRetries: job.maxRetries,
        status: 'CONFIGURATION_ERROR',
        commitPrefix: input.commitPrefix,
        commitCount: 0,
        totalFailuresDetected: 0,
        totalFixesApplied: 0,
        bugs: [],
        scoreBreakdown: job.score,
        metrics: {
          score: `${job.score.total}/${job.score.max}`,
          totalTime: formatDuration(Date.now() - job.startedAt),
          status: 'CONFIGURATION_ERROR'
        },
        generatedAt: new Date().toISOString()
      };
      
      await writeResultsFile(finalOutput);
      job.isRunning = false;
      broadcast(jobId, 'done', getSnapshot(job));
      return;
    }

    let pass = false;
    let pushSucceeded = false;
    let retry = 0;
    let latestIssues = [];
    const retryLimit = job.maxRetries;

    while (retry < retryLimit && !pass) {
      retry += 1;
      const testResult = await runTests(analysis.repoRoot, analysis.scripts);

      // Handle case where no local test framework is detected
      if (testResult.skipLocalExecution) {
        job.status = 'VERIFYING_PIPELINE';
        job.timeline.push(makeTimelineEntry(retry, retryLimit, 'INFO', 
          'No local test framework detected. Relying on GitHub Actions for validation.'));
        broadcast(jobId, 'snapshot', getSnapshot(job));

        try {
          const pushResult = await pushFixBranch(analysis.repoRoot, analysis.branchName);
          if (pushResult.pushed) {
            pushSucceeded = true;
            job.timeline.push(makeTimelineEntry(retry, retryLimit, 'PASS', `Branch pushed: ${analysis.branchName}`));
            broadcast(jobId, 'snapshot', getSnapshot(job));

            // Monitor GitHub Actions pipeline
            const pipelineResult = await pollGitHubActions({
              githubUrl: input.githubUrl,
              branchName: analysis.branchName,
              token: process.env.GITHUB_TOKEN
            });

            if (pipelineResult.pipelinePassed) {
              pass = true;
              job.status = 'PASS';
              job.iterationsUsed = retry;
              job.timeline.push(makeTimelineEntry(retry, retryLimit, 'PASS', 
                `GitHub Actions passed: ${pipelineResult.workflowName || 'CI/CD'}`));
              broadcast(jobId, 'snapshot', getSnapshot(job));
              break;
            } else {
              // GitHub Actions failed - cannot fix without local test framework
              const reason = pipelineResult.reason || pipelineResult.conclusion || 'Pipeline failed';
              job.timeline.push(makeTimelineEntry(retry, retryLimit, 'FAIL', 
                `GitHub Actions failed: ${reason}. Cannot auto-fix without local test framework.`));
              broadcast(jobId, 'snapshot', getSnapshot(job));
              
              // Log the failure but continue retry (in case manual fixes were made)
              job.totalFailuresDetected += 1;
              job.fixes.push({
                file: 'pipeline',
                line: null,
                bugType: 'LOGIC',
                status: 'FAILED',
                detail: `GitHub Actions failed: ${reason}. No local test framework to generate fixes.`,
                commitMessage: 'NO_COMMIT',
                formattedOutput: `LOGIC error in pipeline line null → Fix: GitHub Actions failed: ${reason}. No local test framework available.`
              });
            }
          } else {
            pushSucceeded = false;
            job.status = 'FAILED_PUSH';
            job.iterationsUsed = retry;
            job.timeline.push(makeTimelineEntry(retry, retryLimit, 'FAIL', 'Branch push failed. Stopping execution.'));
            broadcast(jobId, 'snapshot', getSnapshot(job));
            break;
          }
        } catch (pushError) {
          pushSucceeded = false;
          job.status = 'FAILED_PUSH';
          job.iterationsUsed = retry;
          job.timeline.push(makeTimelineEntry(retry, retryLimit, 'FAIL', `Push error: ${pushError.message}. Stopping execution.`));
          broadcast(jobId, 'snapshot', getSnapshot(job));
          break;
        }

        // If we didn't pass, this retry failed
        if (!pass) {
          job.iterationsUsed = retry;
        }
        continue;
      }

      if (testResult.passed) {
        // Local tests passed - now push and verify GitHub Actions
        job.status = 'VERIFYING_PIPELINE';
        job.timeline.push(makeTimelineEntry(retry, retryLimit, 'PASS', `Local tests passed on retry ${retry}. Runner: ${testResult.runner}`));
        broadcast(jobId, 'snapshot', getSnapshot(job));

        try {
          const pushResult = await pushFixBranch(analysis.repoRoot, analysis.branchName);
          if (pushResult.pushed) {
            pushSucceeded = true;
            job.timeline.push(makeTimelineEntry(retry, retryLimit, 'PASS', `Branch pushed: ${analysis.branchName}`));
            broadcast(jobId, 'snapshot', getSnapshot(job));

            // Monitor GitHub Actions pipeline
            const pipelineResult = await pollGitHubActions({
              githubUrl: input.githubUrl,
              branchName: analysis.branchName,
              token: process.env.GITHUB_TOKEN
            });

            if (pipelineResult.pipelinePassed) {
              pass = true;
              job.status = 'PASS';
              job.iterationsUsed = retry;
              job.timeline.push(makeTimelineEntry(retry, retryLimit, 'PASS', 
                `GitHub Actions passed: ${pipelineResult.workflowName || 'CI/CD'}`));
              broadcast(jobId, 'snapshot', getSnapshot(job));
              break;
            } else {
              // GitHub Actions failed - continue retry loop
              const reason = pipelineResult.reason || pipelineResult.conclusion || 'Pipeline failed';
              job.timeline.push(makeTimelineEntry(retry, retryLimit, 'FAIL', 
                `GitHub Actions failed: ${reason}. Retrying...`));
              broadcast(jobId, 'snapshot', getSnapshot(job));
              
              // Re-run tests to get fresh error logs for next retry
              const reTestResult = await runTests(analysis.repoRoot, analysis.scripts);
              latestIssues = reTestResult.testsDiscovered
                ? classifyBugs(reTestResult.logs)
                : [
                  {
                    file: 'pipeline',
                    line: null,
                    bugType: 'LOGIC',
                    status: 'OPEN',
                    detail: `GitHub Actions failed: ${reason}`
                  }
                ];
            }
          } else {
            pushSucceeded = false;
            job.status = 'FAILED_PUSH';
            job.iterationsUsed = retry;
            job.timeline.push(makeTimelineEntry(retry, retryLimit, 'FAIL', 'Branch push failed. Stopping execution.'));
            broadcast(jobId, 'snapshot', getSnapshot(job));
            break;
          }
        } catch (pushError) {
          pushSucceeded = false;
          job.status = 'FAILED_PUSH';
          job.iterationsUsed = retry;
          job.timeline.push(makeTimelineEntry(retry, retryLimit, 'FAIL', `Push error: ${pushError.message}. Stopping execution.`));
          broadcast(jobId, 'snapshot', getSnapshot(job));
          break;
        }

        // If we get here and pass is still false, continue to generate fixes
        if (pass) break;
      } else {
        // Local tests failed - classify bugs and generate fixes
        job.status = 'RETRYING';
        latestIssues = testResult.testsDiscovered
          ? classifyBugs(testResult.logs)
          : [
            {
              file: 'pipeline',
              line: null,
              bugType: 'LOGIC',
              status: 'OPEN',
              detail: 'No supported test framework discovered; unable to validate pipeline.'
            }
          ];
      }

      // Generate fixes for the current iteration's issues
      job.totalFailuresDetected += latestIssues.length;
      const fixed = await generateFixes(analysis.repoRoot, latestIssues);
      const fixedInIteration = fixed.filter((item) => item.status === 'FIXED').length;
      job.totalFixesApplied += fixedInIteration;

      const commit = await commitFixes(analysis.repoRoot, `Retry ${retry} automated fixes`);
      if (commit.committed) {
        job.commitCount += 1;
      }

      const fixesWithCommit = fixed.map((item) => {
        const fixDescription = item.status === 'FIXED' 
          ? `Applied automated fix for ${item.detail || 'issue'}` 
          : `Fix attempt failed: ${item.detail || 'unknown error'}`;
        return {
          ...item,
          commitMessage: commit.committed ? commit.message : 'NO_COMMIT',
          formattedOutput: formatJudgeOutput(item, fixDescription)
        };
      });
      job.fixes = [...job.fixes, ...fixesWithCommit].slice(-100);

      const message = commit.committed
        ? `Retry ${retry}: ${fixedInIteration} fixes applied and committed.`
        : `Retry ${retry}: no commit generated (no file changes).`;

      job.iterationsUsed = retry;
      if (!pass) {
        job.timeline.push(makeTimelineEntry(retry, retryLimit, 'FAIL', message));
      }
      broadcast(jobId, 'snapshot', getSnapshot(job));
    }

    const retriesUsed = retry;
    
    // Final status determination
    if (!pass) {
      job.status = pushSucceeded ? 'FAILED_PIPELINE' : 'FAILED_MAX_RETRIES';
    }

    const elapsedMs = Date.now() - job.startedAt;
    job.score = buildScore({
      elapsedMs,
      commitCount: job.commitCount,
      pipelinePassed: pass,
      pushSucceeded
    });

    job.isRunning = false;

    const resultOutput = {
      jobId,
      repository: input.githubUrl,
      branch: job.branchName,
      teamName: input.teamName,
      leaderName: input.leaderName,
      retriesUsed,
      maxRetries: retryLimit,
      status: job.status,
      commitPrefix: AI_AGENT_COMMIT_PREFIX,
      commitCount: job.commitCount,
      totalFailuresDetected: job.totalFailuresDetected,
      totalFixesApplied: job.totalFixesApplied,
      bugs: job.fixes,
      scoreBreakdown: job.score,
      metrics: getSnapshot(job).metrics,
      generatedAt: new Date().toISOString()
    };

    await writeResultsFile(resultOutput);
    broadcast(jobId, 'snapshot', getSnapshot(job));
    broadcast(jobId, 'done', resultOutput);
  } catch (error) {
    job.isRunning = false;
    job.status = error.message?.startsWith('Policy violation:') ? 'POLICY_VIOLATION' : 'ERROR';
    job.error = error.message;
    job.timeline.push(makeTimelineEntry(0, job.maxRetries, 'FAIL', `Execution failed: ${error.message}`));
    broadcast(jobId, 'snapshot', getSnapshot(job));
    broadcast(jobId, 'error', { error: error.message });
  }
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.post('/api/run-agent', async (request, response) => {
  const { githubUrl, teamName, leaderName, retryLimit } = request.body || {};
  if (!githubUrl || !teamName || !leaderName) {
    return response.status(400).json({ error: 'githubUrl, teamName, and leaderName are required.' });
  }

  const parsedRetryLimit = Number(retryLimit || process.env.RETRY_LIMIT || 5);
  const safeRetryLimit = Number.isFinite(parsedRetryLimit) ? Math.max(1, Math.min(10, Math.floor(parsedRetryLimit))) : 5;

  const jobId = uuidv4();
  jobs.set(jobId, {
    id: jobId,
    startedAt: Date.now(),
    isRunning: true,
    status: 'STARTING',
    error: null,
    repository: githubUrl,
    teamName,
    leaderName,
    branchName: '',
    maxRetries: safeRetryLimit,
    totalFailuresDetected: 0,
    totalFixesApplied: 0,
    commitCount: 0,
    iterationsUsed: 0,
    fixes: [],
    timeline: [],
    score: {
      total: 0,
      base: 100,
      max: 110,
      speedBonus: 0,
      efficiencyPenalty: 0
    }
  });

  runAgent(jobId, { githubUrl, teamName, leaderName });
  return response.json({ jobId });
});

app.get('/api/run-agent/stream/:jobId', (request, response) => {
  const { jobId } = request.params;
  const job = jobs.get(jobId);
  if (!job) {
    return response.status(404).json({ error: 'Job not found' });
  }

  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders();

  const clients = streams.get(jobId) || [];
  clients.push(response);
  streams.set(jobId, clients);

  response.write(`data: ${JSON.stringify({ type: 'snapshot', payload: getSnapshot(job) })}\n\n`);

  request.on('close', () => {
    const active = streams.get(jobId) || [];
    streams.set(
      jobId,
      active.filter((client) => client !== response)
    );
  });

  return undefined;
});

app.post('/github-webhook', async (request, response) => {
  if (!githubMonitor) {
    return response.status(503).json({ 
      error: 'GitHub monitor not configured',
      message: 'Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO environment variables'
    });
  }

  const signature = request.headers['x-hub-signature-256'];
  const event = request.headers['x-github-event'];

  if (event !== 'workflow_run') {
    return response.json({ acknowledged: false, reason: 'Not a workflow_run event' });
  }

  try {
    const result = await githubMonitor.handleWebhook(request.body);
    return response.json(result);
  } catch (error) {
    console.error('❌ Webhook processing error:', error.message);
    return response.status(500).json({ error: error.message });
  }
});

app.get('/api/github-monitor/status', (_request, response) => {
  if (!githubMonitor) {
    return response.json({ enabled: false, message: 'GitHub monitor not configured' });
  }
  return response.json({ enabled: true, ...githubMonitor.getStatus() });
});

const PORT = Number(process.env.PORT || 3000);
const server = app.listen(PORT, () => {
  console.log(`DevOps agent backend running at http://localhost:${PORT}`);
  if (githubMonitor) {
    console.log(`🔍 GitHub Actions monitoring enabled`);
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Stop the existing process or set a different PORT in .env.`);
    if (githubMonitor) {
      githubMonitor.stop();
    }
    process.exit(1);
    return;
  }

  console.error(`❌ Server startup failed: ${error.message}`);
  if (githubMonitor) {
    githubMonitor.stop();
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  if (githubMonitor) {
    githubMonitor.stop();
  }
  process.exit(0);
});
