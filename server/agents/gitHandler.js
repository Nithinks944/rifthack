import { simpleGit } from 'simple-git';

const PROTECTED_BRANCHES = new Set(['main', 'master']);
export const AI_AGENT_COMMIT_PREFIX = '[AI-AGENT]';

function assertSafeTargetBranch(branchName) {
  const normalized = String(branchName || '').trim().toLowerCase();
  if (!normalized || PROTECTED_BRANCHES.has(normalized)) {
    throw new Error(`Policy violation: pushing to protected branch '${branchName}' is not allowed.`);
  }
}

export async function prepareBranch(repoRoot, branchName) {
  assertSafeTargetBranch(branchName);
  const git = simpleGit(repoRoot);
  await git.checkoutLocalBranch(branchName);
  return branchName;
}

export async function commitFixes(repoRoot, messageSuffix) {
  const git = simpleGit(repoRoot);
  const status = await git.status();
  if (status.files.length === 0) {
    return { committed: false };
  }

  await git.add('.');
  const commitMessage = `${AI_AGENT_COMMIT_PREFIX} ${messageSuffix}`;
  if (!commitMessage.startsWith(AI_AGENT_COMMIT_PREFIX)) {
    throw new Error('Policy violation: commit message must start with [AI-AGENT].');
  }
  await git.commit(commitMessage);

  return {
    committed: true,
    message: commitMessage
  };
}

export async function pushFixBranch(repoRoot, branchName) {
  assertSafeTargetBranch(branchName);
  const git = simpleGit(repoRoot);
  await git.push(['-u', 'origin', branchName]);
  return { pushed: true, branchName };
}
