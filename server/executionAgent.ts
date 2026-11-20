import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { persistEventToD1, persistRunToD1 } from './d1Bridge.js';
import { COMMAND_ALLOWLIST } from './security.js';
import { checkoutJobRepository, isRepositoryAllowed } from './repositoryCheckout.js';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface StepExecutionRecord {
  stepId: string;
  label: string;
  status: JobStatus;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
}

export interface JobArtifactRecord {
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  content: string;
}

export interface JobRunRecord {
  id: string;
  repo: string;
  branch: string;
  prNumber: number | null;
  commitSha: string;
  status: JobStatus;
  requestedBy: string;
  runnerId: string;
  startedAt: string;
  finishedAt: string | null;
  steps: StepExecutionRecord[];
  artifacts: JobArtifactRecord[];
  d1SyncStatus: 'synced' | 'unconfigured' | 'error';
  d1SyncError?: string;
}

export interface RunnerAgentHeartbeat {
  runnerId: string;
  hostname: string;
  workspaceDir: string;
  status: 'online' | 'busy';
  activeRunId: string | null;
  lastHeartbeatAt: string;
  platform: string;
  nodeVersion: string;
  loadAvg1m: number;
  freeMemMb: number;
}

const RUNNER_ID = `local-workspace-agent-${os.hostname()}`;
const MAX_OUTPUT_CHARS = 16_000;

const activeQueue: JobRunRecord[] = [];
const activeChildProcesses = new Map<string, ChildProcess>();
let isProcessing = false;
let currentActiveRunId: string | null = null;

function getWorkspaceDir(): string {
  const configured = process.env.AUTORUN_WORKSPACE_DIR?.trim();
  if (configured && fs.existsSync(configured)) {
    return path.resolve(configured);
  }
  return process.cwd();
}

export function getRunnerHeartbeat(): RunnerAgentHeartbeat {
  return {
    runnerId: RUNNER_ID,
    hostname: os.hostname(),
    workspaceDir: getWorkspaceDir(),
    status: currentActiveRunId ? 'busy' : 'online',
    activeRunId: currentActiveRunId,
    lastHeartbeatAt: new Date().toISOString(),
    platform: `${os.platform()}/${os.arch()}`,
    nodeVersion: process.version,
    loadAvg1m: Math.round((os.loadavg()[0] || 0) * 100) / 100,
    freeMemMb: Math.round(os.freemem() / 1024 / 1024),
  };
}

export function getLiveWorkspaceRuns(): JobRunRecord[] {
  return activeQueue;
}

async function syncRunAndEvent(run: JobRunRecord, eventType: string, actor: string, detail: string) {
  const runRes = await persistRunToD1({
    id: run.id,
    repo: run.repo,
    branch: run.branch,
    prNumber: run.prNumber,
    commitSha: run.commitSha,
    status: run.status,
    requestedBy: run.requestedBy,
    runnerId: run.runnerId,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    stepsJson: JSON.stringify(run.steps),
    artifactsJson: JSON.stringify(run.artifacts.map(({ content: _c, ...meta }) => meta)),
  });

  if (runRes.ok) {
    run.d1SyncStatus = 'synced';
    delete run.d1SyncError;
  } else {
    run.d1SyncStatus = runRes.status === 503 ? 'unconfigured' : 'error';
    run.d1SyncError = runRes.error;
  }

  await persistEventToD1({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    runId: run.id,
    type: eventType,
    timestamp: new Date().toISOString(),
    actor,
    detail,
  });
}

function appendBounded(current: string, chunk: string): string {
  const combined = current + chunk;
  if (combined.length <= MAX_OUTPUT_CHARS) return combined;
  return combined.slice(combined.length - MAX_OUTPUT_CHARS);
}

function runAllowlistedStep(run: JobRunRecord, step: StepExecutionRecord, workspaceDir?: string): Promise<number> {
  return new Promise((resolve) => {
    const spec = COMMAND_ALLOWLIST[step.stepId];
    if (!spec) {
      step.stderr = `Rejected: "${step.stepId}" is not in COMMAND_ALLOWLIST.`;
      step.exitCode = 126;
      resolve(126);
      return;
    }

    const startMs = Date.now();
    const child = spawn(spec.bin, spec.args, {
      cwd: workspaceDir || getWorkspaceDir(),
      shell: false,
      env: {
        PATH: process.env.PATH || '',
        HOME: process.env.HOME || os.tmpdir(),
        TMPDIR: process.env.TMPDIR || os.tmpdir(),
        CI: 'true',
        FORCE_COLOR: '0',
        NODE_ENV: 'test',
      },
    });

    activeChildProcesses.set(run.id, child);
    let timedOut = false;
    let forceKillTimer: NodeJS.Timeout | undefined;

    const timer = setTimeout(() => {
      timedOut = true;
      step.stderr = appendBounded(step.stderr, `\n[TIMEOUT] Exceeded ${spec.timeoutMs}ms limit. Sending SIGTERM...\n`);
      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, 3000);
    }, spec.timeoutMs);

    child.stdout.on('data', (buf: Buffer) => {
      step.stdout = appendBounded(step.stdout, buf.toString('utf8'));
    });

    child.stderr.on('data', (buf: Buffer) => {
      step.stderr = appendBounded(step.stderr, buf.toString('utf8'));
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      activeChildProcesses.delete(run.id);
      step.durationMs = Date.now() - startMs;
      step.stderr = appendBounded(step.stderr, `\n[SPAWN ERROR] ${err.message}\n`);
      step.exitCode = 1;
      resolve(1);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      activeChildProcesses.delete(run.id);
      step.durationMs = Date.now() - startMs;
      const exitCode = timedOut ? 124 : (code ?? 1);
      step.exitCode = exitCode;
      resolve(exitCode);
    });
  });
}

function isRunCancelled(run: JobRunRecord): boolean {
  return run.status === 'cancelled';
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    while (true) {
      const nextJob = activeQueue.find((j) => j.status === 'queued');
      if (!nextJob) break;

      currentActiveRunId = nextJob.id;
      nextJob.status = 'running';
      await syncRunAndEvent(nextJob, 'CLAIMED', RUNNER_ID, `Execution agent claimed job ${nextJob.id}`);

      let failed = false;
      let checkedOut: Awaited<ReturnType<typeof checkoutJobRepository>> | null = null;

      try {
        checkedOut = await checkoutJobRepository({
          repo: nextJob.repo,
          branch: nextJob.branch,
          commitSha: nextJob.commitSha,
        });
        await syncRunAndEvent(nextJob, 'CHECKOUT_DONE', RUNNER_ID, `Checked out ${nextJob.repo}@${nextJob.commitSha}`);
      } catch (error) {
        failed = true;
        nextJob.steps[0].status = 'failed';
        nextJob.steps[0].exitCode = 1;
        nextJob.steps[0].stderr = error instanceof Error ? error.message : 'Repository checkout failed.';
        await syncRunAndEvent(nextJob, 'CHECKOUT_FAILED', RUNNER_ID, nextJob.steps[0].stderr);
      }

      for (const step of failed ? [] : nextJob.steps) {
        if (isRunCancelled(nextJob)) {
          step.status = 'cancelled';
          continue;
        }

        step.status = 'running';
        await syncRunAndEvent(nextJob, 'STEP_START', RUNNER_ID, `Starting allowlisted step ${step.stepId}`);

        const exitCode = await runAllowlistedStep(nextJob, step, checkedOut?.directory);

        if (isRunCancelled(nextJob)) {
          step.status = 'cancelled';
          break;
        }

        if (exitCode === 0) {
          step.status = 'succeeded';
          await syncRunAndEvent(nextJob, 'STEP_DONE', RUNNER_ID, `Step ${step.stepId} passed in ${step.durationMs}ms`);
        } else {
          step.status = 'failed';
          failed = true;
          await syncRunAndEvent(
            nextJob,
            'STEP_FAILED',
            RUNNER_ID,
            `Step ${step.stepId} failed with exit code ${exitCode}`,
          );
          break;
        }
      }

      if (!isRunCancelled(nextJob)) {
        nextJob.status = failed ? 'failed' : 'succeeded';
      }
      nextJob.finishedAt = new Date().toISOString();

      const reportBody = JSON.stringify(
        {
          runId: nextJob.id,
          repo: nextJob.repo,
          branch: nextJob.branch,
          prNumber: nextJob.prNumber,
          commitSha: nextJob.commitSha,
          status: nextJob.status,
          runnerId: RUNNER_ID,
          startedAt: nextJob.startedAt,
          finishedAt: nextJob.finishedAt,
          steps: nextJob.steps.map((s) => ({
            stepId: s.stepId,
            status: s.status,
            exitCode: s.exitCode,
            durationMs: s.durationMs,
          })),
        },
        null,
        2,
      );

      nextJob.artifacts.push({
        name: `${nextJob.id}-ci-report.json`,
        mimeType: 'application/json',
        sizeBytes: Buffer.byteLength(reportBody, 'utf8'),
        createdAt: nextJob.finishedAt,
        content: reportBody,
      });

      if (checkedOut) {
        await checkedOut.cleanup().catch((error) => {
          console.error('Failed to clean job workspace:', error);
        });
      }

      await syncRunAndEvent(
        nextJob,
        `RUN_${nextJob.status.toUpperCase()}`,
        RUNNER_ID,
        `Job ${nextJob.id} finished with status ${nextJob.status}`,
      );
      currentActiveRunId = null;
    }
  } finally {
    currentActiveRunId = null;
    isProcessing = false;
  }
}

export async function enqueueJobRun(params: {
  repo: string;
  branch: string;
  prNumber: number | null;
  commitSha: string;
  requestedBy: string;
  stepIds: string[];
}): Promise<{ ok: true; run: JobRunRecord } | { ok: false; error: string }> {
  if (process.env.AUTORUN_ENABLE_UNSANDBOXED_EXECUTION !== 'true') {
    return { ok: false, error: 'Execution is disabled until an isolated runner is provisioned and explicitly enabled.' };
  }

  if (!isRepositoryAllowed(params.repo)) {
    return { ok: false, error: `Repository ${params.repo} is not in AUTORUN_ALLOWED_REPOSITORIES.` };
  }
  if (!/^[A-Za-z0-9_.-]+\\/[A-Za-z0-9_.-]+$/.test(params.repo.trim())) {
    return { ok: false, error: 'Repository must use the owner/name GitHub format.' };
  }
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(params.branch.trim()) || params.branch.startsWith('-') || params.branch.includes('..') || params.branch.endsWith('/')) {
    return { ok: false, error: 'Branch name is invalid.' };
  }
  if (!/^[a-f0-9]{40}$/i.test(params.commitSha.trim())) {
    return { ok: false, error: 'A full 40-character commit SHA is required.' };
  }
  if (!params.stepIds.length) {
    return { ok: false, error: 'At least one allowlisted CI step is required.' };
  }

  for (const stepId of params.stepIds) {
    if (!COMMAND_ALLOWLIST[stepId]) {
      return { ok: false, error: `Command "${stepId}" is not in the server allowlist.` };
    }
  }

  const run: JobRunRecord = {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    repo: params.repo.trim() || 'zskbot/OCodeJS-Auth',
    branch: params.branch.trim() || 'main',
    prNumber: params.prNumber,
    commitSha: params.commitSha.trim() || 'HEAD',
    status: 'queued',
    requestedBy: params.requestedBy,
    runnerId: RUNNER_ID,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    steps: params.stepIds.map((id) => ({
      stepId: id,
      label: COMMAND_ALLOWLIST[id].label,
      status: 'queued',
      exitCode: null,
      durationMs: 0,
      stdout: '',
      stderr: '',
    })),
    artifacts: [],
    d1SyncStatus: 'unconfigured',
  };

  activeQueue.unshift(run);
  if (activeQueue.length > 25) {
    activeQueue.pop();
  }

  await syncRunAndEvent(run, 'QUEUED', params.requestedBy, `Queued ${params.stepIds.join(' -> ')} for ${run.commitSha}`);
  void processQueue();

  return { ok: true, run };
}

export async function cancelJobRun(runId: string, actor: string): Promise<{ ok: boolean; error?: string; run?: JobRunRecord }> {
  const run = activeQueue.find((r) => r.id === runId);
  if (!run) {
    return { ok: false, error: 'Run ID not found in active execution queue.' };
  }
  if (run.status === 'succeeded' || run.status === 'failed' || run.status === 'cancelled') {
    return { ok: false, error: `Cannot cancel run in terminal state "${run.status}".` };
  }

  run.status = 'cancelled';
  run.finishedAt = new Date().toISOString();
  const child = activeChildProcesses.get(runId);
  if (child && !child.killed) {
    child.kill('SIGTERM');
  }

  await syncRunAndEvent(run, 'CANCELLED', actor, `Run ${runId} cancelled by ${actor}`);
  return { ok: true, run };
}
