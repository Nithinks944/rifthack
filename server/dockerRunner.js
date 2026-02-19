import { spawn } from 'node:child_process';

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` });
    });
  });
}

export async function runInDocker(repoPath, testCommand) {
  const config = typeof testCommand === 'string'
    ? {
      command: testCommand,
      image: 'node:20-bullseye',
      fallbackCommand: 'npm run test --if-present'
    }
    : {
      command: testCommand.command,
      image: testCommand.image || 'node:20-bullseye',
      fallbackCommand: testCommand.fallbackCommand || 'npm run test --if-present'
    };

  const volume = `${repoPath}:/workspace`;
  const args = [
    'run',
    '--rm',
    '-v',
    volume,
    '-w',
    '/workspace',
    config.image,
    'bash',
    '-lc',
    config.command
  ];

  const result = await runCommand('docker', args);
  if (result.code === 0) {
    return { ...result, runner: 'docker' };
  }

  const fallback = await runCommand('cmd', ['/c', config.fallbackCommand], { cwd: repoPath });
  return {
    code: fallback.code,
    stdout: `${result.stdout}\n${fallback.stdout}`,
    stderr: `${result.stderr}\n${fallback.stderr}`,
    runner: 'fallback-local'
  };
}
