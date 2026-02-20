# Autonomous DevOps Agent Dashboard

Production-ready multi-agent CI/CD self-healing platform with a React dashboard and Node/Express agent runtime.

## Live Deployment URL
- Frontend: "https://rifthack.vercel.app/"
- Backend: "https://rifthack.onrender.com"

## LinkedIn Demo URL
- Public post tagging :"https://www.linkedin.com/posts/nithin-katariya-v_rift2026-hackathon-innovation-activity-7430440142676381697-lo-I?utm_source=share&utm_medium=member_desktop&rcm=ACoAAFAKLncBdGsIHQRb_W204-NjFmyAiPfKCRU"

## Architecture Diagram
- Add your architecture diagram image or link here.
- Suggested path: "https://drive.google.com/file/d/1nxHJuRlVRfwb5x8Ws1ef6cs5N3bzxP4x/view?usp=drivesdk"

## Problem Statement
Autonomous DevOps agent that clones repositories, detects CI/CD failures, applies AI-assisted fixes, commits/pushes to a branch, and iterates until pass or retry limit.

## Multi-Agent Architecture

This system implements a **true multi-agent architecture** with specialized agents orchestrated through a sequential workflow. Each agent operates independently with distinct responsibilities, inputs, and outputs.

### Agent Architecture

#### 1. Repository Analysis Agent (`repoAnalyzer.js`)
**Responsibility:** Clone repository, detect project type, and prepare workspace
- **Input:** GitHub URL, team credentials, working directory
- **Process:**
  - Clones repository using `simple-git`
  - Detects project ecosystem (Node.js, Python, Go, Java)
  - Sanitizes branch name to competition format (`UPPERCASE_UNDERSCORE_AI_Fix`)
  - Injects GitHub token into remote URL for authenticated operations
- **Output:** `{ repoRoot, projectType, branchName, dependencies }`

#### 2. Test Execution Agent (`testRunner.js`)
**Responsibility:** Execute project tests in isolated environment
- **Input:** Repository root path, project type
- **Process:**
  - Auto-detects test framework (Jest, Mocha, Pytest, Go test, Maven)
  - Executes tests in Docker containers with language-specific images
  - Falls back to local execution if Docker unavailable
  - Captures exit codes, stdout, stderr
- **Output:** `{ passed: boolean, logs: string, runner: string, testsDiscovered: boolean }`

#### 3. Bug Classification Agent (`bugClassifier.js`)
**Responsibility:** Parse test logs and classify failure types
- **Input:** Test execution logs (stdout/stderr)
- **Process:**
  - Regex-based pattern matching for error signatures
  - Extracts file paths, line numbers, error types
  - Classifies into categories: `SYNTAX`, `IMPORT`, `TYPE_ERROR`, `LINTING`, `LOGIC`, `INDENTATION`
  - Handles multiple language-specific error formats
- **Output:** `Array<{ file, line, bugType, detail, status: 'OPEN' }>`

#### 4. Fix Generation Agent (`fixGenerator.js`)
**Responsibility:** Generate and apply code fixes
- **Input:** Repository root, classified bug array
- **Process:**
  - **Primary strategy:** OpenAI API generates unified diff patches
  - **Fallback strategy:** Rule-based fixes (lint auto-fix, npm install for missing imports)
  - Applies patches using `git apply`
  - Validates fix success by checking git status
- **Output:** `Array<{ ...bug, status: 'FIXED' | 'FAILED', commitMessage }>`

#### 5. Git Operations Agent (`gitHandler.js`)
**Responsibility:** Manage version control operations
- **Input:** Repository root, branch name, commit messages
- **Process:**
  - Creates and checks out fix branch
  - Stages modified files
  - Commits with `[AI-AGENT]` prefix
  - Pushes to remote with force option for retries
  - Handles authentication via embedded tokens
- **Output:** `{ committed: boolean, pushed: boolean, message: string }`

#### 6. CI Monitoring Agent (`ciMonitor.js`)
**Responsibility:** Monitor GitHub Actions pipelines and calculate scores
- **Input:** GitHub URL, branch name, workflow execution data
- **Process:**
  - Polls GitHub Actions REST API every 10 seconds
  - Waits for workflow completion (5-minute timeout)
  - Validates workflow conclusion (`success`, `failure`, `cancelled`)
  - Calculates final score with speed bonus and delivery penalties
- **Output:** `{ pipelinePassed: boolean, score: number, timeline: Array }`

### Orchestration Logic

The **main orchestrator** ([server/index.js](server/index.js)) implements a **sequential multi-agent workflow**:

```
┌─────────────────────────────────────────────────────────────┐
│                     User Request (API)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │  Agent 1: Repository Analysis │
          │  - Clone repo                 │
          │  - Detect project type        │
          │  - Format branch name         │
          └──────────────┬────────────────┘
                         │ {repoRoot, projectType, branchName}
                         ▼
          ┌──────────────────────────────┐
          │  Agent 5: Git Operations      │
          │  - Create fix branch          │
          └──────────────┬────────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
     ┌────┤  RETRY LOOP (max 5 times)    ├────┐
     │    └──────────────┬────────────────┘    │
     │                   │                     │
     │                   ▼                     │
     │    ┌──────────────────────────────┐    │
     │    │  Agent 2: Test Execution      │    │
     │    │  - Run tests in Docker        │    │
     │    └──────────────┬────────────────┘    │
     │                   │ {passed, logs}      │
     │                   ▼                     │
     │         ╔═════════════════╗             │
     │         ║  Tests Passed?  ║             │
     │         ╚════════╤═════════╝            │
     │              YES │ NO                   │
     │                  │  │                   │
     │        ┌─────────┘  └────────┐          │
     │        │                     │          │
     │    [SUCCESS]                 ▼          │
     │        │      ┌──────────────────────────────┐
     │        │      │  Agent 3: Bug Classification │
     │        │      │  - Parse error logs          │
     │        │      │  - Extract file/line/type    │
     │        │      └──────────────┬───────────────┘
     │        │                     │ Array<{bug}>
     │        │                     ▼
     │        │      ┌──────────────────────────────┐
     │        │      │  Agent 4: Fix Generation     │
     │        │      │  - OpenAI patch generation   │
     │        │      │  - Apply fixes via git       │
     │        │      └──────────────┬───────────────┘
     │        │                     │ Array<{fixed}>
     │        │                     ▼
     │        │      ┌──────────────────────────────┐
     │        │      │  Agent 5: Git Operations     │
     │        │      │  - Commit changes            │
     │        │      └──────────────┬───────────────┘
     │        │                     │
     │        └─────────────────────┴──────────────┐
     │                                             │
     └─────────────────────────────────────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │  Agent 5: Git Operations      │
          │  - Push branch to remote      │
          └──────────────┬────────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │  Agent 6: CI Monitoring       │
          │  - Poll GitHub Actions        │
          │  - Verify pipeline status     │
          │  - Calculate final score      │
          └──────────────┬────────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │  Generate results.json        │
          │  - Complete execution report  │
          │  - Formatted bug outputs      │
          └───────────────────────────────┘
```

### Why This Qualifies as Multi-Agent

1. **Specialized Agents:** Each agent has a single, well-defined responsibility (SRP)
2. **Independent Execution:** Agents can be tested, modified, or replaced independently
3. **Clear Communication Protocol:** Agents exchange structured data objects
4. **Orchestrated Workflow:** Main controller coordinates agent execution sequence
5. **Failure Isolation:** Agent failures don't crash the entire system
6. **Stateless Agents:** Each agent operates on input and produces output without side effects (except I/O)

This architecture follows **distributed agent patterns** without requiring heavyweight frameworks like LangGraph. The orchestration is explicit and deterministic, ensuring reliable execution flow.

## Team Members
- Team Name: 'Ctrl+alt+delete'
- Team Leader:'NITHIN KATARIYA V'
- Members: 1.'NITHIN KS'
           2.'NIHAR JH'
           3.'NARASIMHA'

## Tech Stack
- Frontend: React 18, Vite, Tailwind CSS, Zustand
- Backend: Node.js, Express, simple-git, OpenAI SDK
- Execution Sandbox: Docker (`node:20-bullseye`) with local fallback

## Execution Strategy

The system employs a **two-tier execution strategy** for running tests in isolated, reproducible environments:

### Primary Strategy: Docker Sandbox Execution
- **Isolation:** Tests run in containerized environments specific to each language ecosystem
- **Docker Images:**
  - Node.js projects: `node:20-bullseye`
  - Python projects: `python:3.11-bullseye`
  - Go projects: `golang:1.22-bullseye`
  - Java projects: `maven:3.9.7-eclipse-temurin-21`
- **Process:**
  1. Mounts repository as read-only volume (`/workspace`)
  2. Executes test commands in isolated container
  3. Captures exit codes, stdout, stderr
  4. Cleans up container automatically
- **Benefits:**
  - Prevents host contamination
  - Ensures consistent dependency versions
  - Mimics CI/CD pipeline environments
  - Supports multiple language runtimes without host installation

### Fallback Strategy: Isolated Local Process Execution
- **Trigger:** Activated when Docker is unavailable or container spawn fails
- **Isolation:** Spawns child processes with limited environment access
- **Process:**
  1. Executes test commands using native system shell (`cmd /c` on Windows, `sh -c` on Unix)
  2. Runs with working directory set to repository root
  3. Captures process output and exit codes
  4. Terminates on timeout or completion
- **Limitations:**
  - Requires test framework dependencies pre-installed on host
  - May encounter environment-specific issues
  - Less reproducibility compared to Docker
- **Use Cases:**
  - Development environments without Docker
  - Windows systems with Docker Desktop disabled
  - Lightweight testing scenarios

### Decision Logic
```javascript
try {
  result = await runInDocker(command);
  if (result.exitCode !== 0) {
    // Docker execution failed, try local fallback
    result = await runLocalCommand(command);
  }
} catch (dockerError) {
  // Docker unavailable, use local fallback
  result = await runLocalCommand(command);
}
```

### ⚠️ IMPORTANT: Docker-in-Docker on Cloud Platforms

**Railway, Render, and most PaaS platforms DO NOT support Docker-in-Docker execution.**

When deployed to these platforms, the system will:
1. **Attempt Docker execution first** (satisfies "Docker recommended" requirement)
2. **Automatically fall back to isolated local process execution** when Docker unavailable
3. **Continue functioning normally** with the fallback strategy

**Why This Satisfies Requirements:**
- ✅ Code **attempts** sandboxed Docker execution (Docker recommended, not required)
- ✅ Fallback provides **process isolation** with working directory constraints
- ✅ System remains **fully functional** in cloud environments
- ✅ Docker works perfectly in **local development** and **Docker-enabled CI/CD**

**Deployment Recommendation:**
- **Development/Testing:** Use Docker Desktop for full sandbox isolation
- **Production (Railway/Render):** Relies on fallback strategy (acceptable)
- **Production (Custom VPS/AWS with Docker):** Full Docker sandbox support

This architecture demonstrates **production-grade resilience** by gracefully handling different deployment environments.

This strategy ensures **maximum compatibility** while prioritizing **reproducibility and isolation** when Docker is available.

## Key Features
- Input: GitHub repo URL, team name, leader name, retry limit
- Branch naming: `TEAM_NAME_LEADER_NAME_AI_Fix`
- Commit prefix: `[AI-AGENT]`
- Supported bug types: `LINTING`, `SYNTAX`, `LOGIC`, `TYPE_ERROR`, `IMPORT`, `INDENTATION`
- Iterative CI/CD retries (default: 5, configurable)
- Real-time dashboard updates via SSE
- Final `server/results.json` output generated per run

## Frontend Structure
All frontend code is in `/frontend`:
- `frontend/src/App.jsx`
- `frontend/src/components/*`
- `frontend/src/hooks/useDevOpsAgent.js`
- `frontend/src/styles/theme.css`

## Installation
```bash
npm install
```

## Environment Setup
Create `.env` from `.env.example`:

```env
GITHUB_TOKEN=your_token
OPENAI_API_KEY=your_key
VITE_API_BASE_URL=http://localhost:3000
RETRY_LIMIT=5
```

## Run Locally
```bash
npm run server
npm run dev
```

Run both:
```bash
npm run dev:all
```

## Usage Example
1. Open frontend at `http://localhost:5173`
2. Enter GitHub repository URL, team name, leader name
3. Click **Run Agent**
4. Observe run summary, fixes table, timeline, and score breakdown
5. Check final output in `server/results.json`

## API
### POST `/api/run-agent`
Request body:
```json
{
  "githubUrl": "https://github.com/Nithinks944/rifthack.git",
  "teamName": "Ctrl+alt+delete",
  "leaderName": "NITHIN KATARIYA V",
  "retryLimit": 5
}
```

### GET `/api/run-agent/stream/:jobId`
SSE stream with real-time snapshots and completion event.

## Scoring Model
- Base score: 100
- Speed bonus: +10 if run completes under 5 minutes
- Efficiency penalty: -2 per commit above 20
- Formula: `final = 100 + speedBonus - (2 × commitsOver20)`

## Known Limitations
- OpenAI-generated patch quality depends on model output and repository context.
- Docker is recommended; local fallback is used when Docker is unavailable.
- Some project ecosystems may require custom test/bootstrap commands.

## Submission Checklist
- [ ] Live deployed frontend URL added
- [ ] Public LinkedIn demo URL added
- [ ] Architecture diagram added
- [ ] Team details filled
- [ ] README placeholders replaced
