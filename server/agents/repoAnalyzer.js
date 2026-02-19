import fs from 'node:fs/promises';
import path from 'node:path';
import { simpleGit } from 'simple-git';

function withGitHubToken(url, token) {
  if (!token || !url.includes('github.com')) return url;
  const cleaned = url.replace('https://', '').replace(/\/$/, '');
  return `https://${token}:x-oauth-basic@${cleaned}`;
}

function sanitizeName(value, fallback) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  return cleaned || fallback;
}

export function formatBranchName(teamName, leaderName) {
  const team = sanitizeName(teamName, 'TEAM');
  const leader = sanitizeName(leaderName, 'LEADER');
  return `${team}_${leader}_AI_Fix`;
}

export function isValidCompetitionBranchName(branchName) {
  return /^[A-Z0-9]+(?:_[A-Z0-9]+)*_[A-Z0-9]+(?:_[A-Z0-9]+)*_AI_Fix$/.test(branchName);
}

export async function analyzeRepo({ githubUrl, teamName, leaderName, workDir }) {
  const repoRoot = path.join(workDir, 'repo');
  await fs.rm(repoRoot, { recursive: true, force: true });
  await fs.mkdir(workDir, { recursive: true });

  const git = simpleGit();
  const cloneUrl = withGitHubToken(githubUrl, process.env.GITHUB_TOKEN);
  await git.clone(cloneUrl, repoRoot);

  const packageJsonPath = path.join(repoRoot, 'package.json');
  let scripts = {};
  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    scripts = JSON.parse(content).scripts || {};
  } catch {
    scripts = {};
  }

  return {
    repoRoot,
    scripts,
    branchName: formatBranchName(teamName, leaderName)
  };
}
