import { runInDocker } from '../dockerRunner.js';
import fs from 'node:fs/promises';
import path from 'node:path';

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectProject(repoRoot, scripts = {}) {
  const hasPackageJson = await pathExists(path.join(repoRoot, 'package.json'));
  const hasPyProject = await pathExists(path.join(repoRoot, 'pyproject.toml'));
  const hasRequirements = await pathExists(path.join(repoRoot, 'requirements.txt'));
  const hasGoMod = await pathExists(path.join(repoRoot, 'go.mod'));
  const hasMaven = await pathExists(path.join(repoRoot, 'pom.xml'));
  const hasGradle = (await pathExists(path.join(repoRoot, 'build.gradle'))) || (await pathExists(path.join(repoRoot, 'build.gradle.kts')));

  if (hasPackageJson && (scripts.test || scripts.lint || scripts.build)) {
    const commands = [];
    if (scripts.lint) commands.push('npm run lint');
    if (scripts.test) commands.push('npm test -- --watch=false || npm test');
    if (scripts.build) commands.push('npm run build');

    return {
      testsDiscovered: true,
      image: 'node:20-bullseye',
      command: `npm ci || npm install; ${commands.join('; ')}`,
      fallbackCommand: `npm ci || npm install & ${commands.join(' & ')}`
    };
  }

  if (hasPyProject || hasRequirements) {
    return {
      testsDiscovered: true,
      image: 'python:3.11-bullseye',
      command: [
        'python -m pip install --upgrade pip',
        'if [ -f requirements.txt ]; then pip install -r requirements.txt; fi',
        'pip install pytest',
        'pytest -q'
      ].join('; '),
      fallbackCommand: [
        'python -m pip install --upgrade pip',
        'if exist requirements.txt pip install -r requirements.txt',
        'pip install pytest',
        'pytest -q'
      ].join(' & ')
    };
  }

  if (hasGoMod) {
    return {
      testsDiscovered: true,
      image: 'golang:1.22-bullseye',
      command: 'go test ./... -count=1',
      fallbackCommand: 'go test ./... -count=1'
    };
  }

  if (hasMaven || hasGradle) {
    return {
      testsDiscovered: true,
      image: 'maven:3.9.7-eclipse-temurin-17',
      command: hasMaven ? 'mvn -q test' : 'gradle test',
      fallbackCommand: hasMaven ? 'mvn -q test' : 'gradle test'
    };
  }

  return {
    testsDiscovered: false,
    skipLocalExecution: true,
    image: 'node:20-bullseye',
    command: 'echo "No supported test framework discovered"; exit 1',
    fallbackCommand: 'echo No supported test framework discovered & exit /b 1'
  };
}

export async function runTests(repoRoot, scripts) {
  const project = await detectProject(repoRoot, scripts);
  
  if (project.skipLocalExecution) {
    return {
      passed: false,
      logs: 'No local test framework detected. Deferring to GitHub Actions for validation.',
      runner: 'none',
      testsDiscovered: false,
      skipLocalExecution: true
    };
  }
  
  const result = await runInDocker(repoRoot, {
    command: project.command,
    image: project.image,
    fallbackCommand: project.fallbackCommand
  });
  const logs = `${result.stdout}\n${result.stderr}`;

  return {
    passed: project.testsDiscovered && result.code === 0,
    logs,
    runner: result.runner,
    testsDiscovered: project.testsDiscovered,
    skipLocalExecution: project.skipLocalExecution || false
  };
}
