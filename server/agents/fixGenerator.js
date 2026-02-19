import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { spawn } from 'node:child_process';

function runLocalCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, shell: false, env: process.env });
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('close', (code) => resolve({ code, stderr }));
    child.on('error', (error) => resolve({ code: 1, stderr: `${stderr}\n${error.message}` }));
  });
}

function normalizePatchResponse(responseText) {
  const trimmed = String(responseText || '').trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/^```diff\n?/i, '')
    .replace(/^```\n?/i, '')
    .replace(/```$/i, '')
    .trim();
}

async function applyPatchFile(repoRoot, patchText) {
  const patchPath = path.join(repoRoot, '.ai-fix.patch');
  await fs.writeFile(patchPath, patchText, 'utf-8');
  const result = await runLocalCommand('git', ['apply', patchPath], repoRoot);
  await fs.rm(patchPath, { force: true });
  return result.code === 0;
}

async function requestPatchFromOpenAI(repoRoot, bug) {
  if (!process.env.OPENAI_API_KEY) return false;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const targetPath = bug.file && bug.file !== 'unknown' && bug.file !== 'pipeline' ? path.join(repoRoot, bug.file) : null;
  let fileContent = '';

  if (targetPath) {
    try {
      fileContent = await fs.readFile(targetPath, 'utf-8');
    } catch {
      fileContent = '';
    }
  }

  const prompt = [
    'You are fixing CI failures.',
    `Bug type: ${bug.bugType}`,
    `Bug detail: ${bug.detail}`,
    'Return only a valid unified diff patch for git apply.',
    'Do not include explanations.'
  ].join('\n');

  const response = await client.responses.create({
    model: 'gpt-5-mini',
    input: `${prompt}\n\nCurrent file content:\n${fileContent}`,
    temperature: 0.1
  });

  const patchText = normalizePatchResponse(response.output_text);
  if (!patchText) return false;

  return applyPatchFile(repoRoot, patchText);
}

async function applyFallbackFix(repoRoot, bug) {
  if (bug.bugType === 'LINTING' || bug.bugType === 'INDENTATION') {
    const lintFix = await runLocalCommand('npm', ['run', 'lint', '--', '--fix'], repoRoot);
    return lintFix.code === 0;
  }

  if (bug.bugType === 'IMPORT') {
    const match = bug.detail.match(/['"]([^'"]+)['"]/);
    const packageName = match?.[1];
    if (!packageName || packageName.startsWith('.')) return false;
    const install = await runLocalCommand('npm', ['install', packageName], repoRoot);
    return install.code === 0;
  }

  return false;
}

export async function generateFixes(repoRoot, bugs) {
  const outcomes = [];

  for (const bug of bugs) {
    let fixed = false;
    try {
      fixed = await requestPatchFromOpenAI(repoRoot, bug);
      if (!fixed) {
        fixed = await applyFallbackFix(repoRoot, bug);
      }
    } catch {
      fixed = await applyFallbackFix(repoRoot, bug);
    }

    outcomes.push({
      ...bug,
      status: fixed ? 'FIXED' : 'FAILED'
    });
  }

  return outcomes;
}
