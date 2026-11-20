import os from 'node:os';
import { checkoutJobRepository, isRepositoryAllowed } from './repositoryCheckout.js';
import { COMMAND_ALLOWLIST } from './security.js';
import { dockerNetworkFromEnv, executeDockerJob, runnerImageFromEnv } from './dockerRunner.js';

type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
interface JobRecord {
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
  steps: Array<{ stepId: string; label: string; status: JobStatus; exitCode: number | null; durationMs: number; stdout: string; stderr: string }>;
  artifacts: [];
  d1SyncStatus: 'synced' | 'unconfigured' | 'error';
}

interface QueueJob {
  job_id: string;
  repository: string;
  branch: string;
  commit_sha: string;
  commandIds: string[];
  attempt: number;
  leaseToken: string;
}

const RUNNER_ID = `docker-runner-${os.hostname()}`;
const recentRuns: JobRecord[] = [];
let runnerStarted = false;
let activeRunId: string | null = null;

function apiConfig() {
  return {
    url: (process.env.AUTORUN_CONTROL_API_URL || '').trim().replace(/\/+$/, ''),
    token: (process.env.AUTORUN_RUNNER_TOKEN || '').trim(),
  };
}

async function queueApi<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const { url, token } = apiConfig();
  if (!url || !token) throw new Error('Durable Control API URL or runner token is not configured.');
  const response = await fetch(`${url}/api/v1/autorun/queue/${action}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let parsed: any = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { error: text }; }
  if (!response.ok) throw new Error(`Control API ${action} failed (HTTP ${response.status}): ${String(parsed.error || 'request_failed')}`);
  return parsed as T;
}

function remember(run: JobRecord) {
  const existing = recentRuns.findIndex((item) => item.id === run.id);
  if (existing >= 0) recentRuns.splice(existing, 1);
  recentRuns.unshift(run);
  if (recentRuns.length > 50) recentRuns.length = 50;
}

export function getLiveWorkspaceRuns(): JobRecord[] {
  return recentRuns;
}

export function getRunnerHeartbeat() {
  return {
    runnerId: RUNNER_ID,
    hostname: os.hostname(),
    workspaceDir: 'ephemeral Docker container per job',
    status: activeRunId ? 'busy' as const : 'online' as const,
    activeRunId,
    lastHeartbeatAt: new Date().toISOString(),
    platform: `${os.platform()}/${os.arch()}`,
    nodeVersion: process.version,
    loadAvg1m: Math.round((os.loadavg()[0] || 0) * 100) / 100,
    freeMemMb: Math.round(os.freemem() / 1024 / 1024),
  };
}

export async function enqueueJobRun(params: {
  repo: string;
  branch: string;
  prNumber: number | null;
  commitSha: string;
  requestedBy: string;
  stepIds: string[];
}): Promise<{ ok: true; run: JobRecord } | { ok: false; error: string }> {
  if (process.env.AUTORUN_ENABLE_DOCKER_EXECUTION !== 'true') {
    return { ok: false, error: 'Docker execution is disabled by the safe default.' };
  }
  try { runnerImageFromEnv(); dockerNetworkFromEnv(); } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Docker runner configuration is invalid.' };
  }
  if (!apiConfig().url || !apiConfig().token) {
    return { ok: false, error: 'Durable staging Control API is not configured.' };
  }
  if (!isRepositoryAllowed(params.repo)) return { ok: false, error: `Repository ${params.repo} is not allowlisted.` };
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(params.repo.trim())) return { ok: false, error: 'Repository must use owner/name format.' };
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(params.branch.trim()) || params.branch.includes('..') || params.branch.startsWith('-')) {
    return { ok: false, error: 'Branch name is invalid.' };
  }
  if (!/^[a-f0-9]{40}$/i.test(params.commitSha.trim())) return { ok: false, error: 'A full 40-character commit SHA is required.' };
  if (!params.stepIds.length || params.stepIds.some((id) => !COMMAND_ALLOWLIST[id])) {
    return { ok: false, error: 'One or more requested command IDs are not allowlisted.' };
  }

  try {
    const result = await queueApi<{ job: any }>('jobs', {
      idempotencyKey: `${params.repo}:${params.branch}:${params.commitSha}:${params.prNumber ?? 0}`,
      repository: params.repo.trim(),
      branch: params.branch.trim(),
      commitSha: params.commitSha.trim(),
      commandIds: params.stepIds,
      requestedBy: params.requestedBy,
    });
    const saved = result.job;
    const run: JobRecord = {
      id: String(saved.job_id),
      repo: String(saved.repository),
      branch: String(saved.branch),
      prNumber: params.prNumber,
      commitSha: String(saved.commit_sha),
      status: saved.status === 'running' ? 'running' : 'queued',
      requestedBy: params.requestedBy,
      runnerId: RUNNER_ID,
      startedAt: String(saved.created_at),
      finishedAt: null,
      steps: params.stepIds.map((stepId) => ({
        stepId, label: COMMAND_ALLOWLIST[stepId].label, status: 'queued',
        exitCode: null, durationMs: 0, stdout: '', stderr: '',
      })),
      artifacts: [],
      d1SyncStatus: 'synced',
    };
    remember(run);
    return { ok: true, run };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Queue admission failed.' };
  }
}

export async function cancelJobRun(runId: string, _actor: string): Promise<{ ok: boolean; error?: string; run?: JobRecord }> {
  try {
    const result = await queueApi<any>('cancel', { jobId: runId });
    const run = recentRuns.find((item) => item.id === runId);
    if (run && result.status) run.status = result.status === 'cancelled' ? 'cancelled' : run.status;
    return { ok: true, run };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Cancellation failed.' };
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function processClaimedJob(job: QueueJob): Promise<void> {
  activeRunId = job.job_id;
  const run: JobRecord = {
    id: job.job_id, repo: job.repository, branch: job.branch, prNumber: null,
    commitSha: job.commit_sha, status: 'running', requestedBy: 'durable-queue',
    runnerId: RUNNER_ID, startedAt: new Date().toISOString(), finishedAt: null,
    steps: job.commandIds.map((stepId) => ({
      stepId, label: COMMAND_ALLOWLIST[stepId]?.label || stepId, status: 'queued',
      exitCode: null, durationMs: 0, stdout: '', stderr: '',
    })),
    artifacts: [], d1SyncStatus: 'synced',
  };
  remember(run);

  let checkout: Awaited<ReturnType<typeof checkoutJobRepository>> | null = null;
  let outcome: 'succeeded' | 'failed' | 'timed_out' = 'failed';
  let cancelled = false;
  let cancelRequested = false;
  let heartbeatBusy = false;
  const heartbeatTimer = setInterval(async () => {
    if (heartbeatBusy || cancelRequested) return;
    heartbeatBusy = true;
    try {
      const heartbeat = await queueApi<{ cancelRequested: boolean }>('heartbeat', {
        jobId: job.job_id, runnerId: RUNNER_ID, leaseToken: job.leaseToken,
      });
      cancelRequested = heartbeat.cancelRequested;
    } catch {
      // Lease expiry is the recovery mechanism; never execute after a failed heartbeat.
      cancelRequested = true;
    } finally {
      heartbeatBusy = false;
    }
  }, 15_000);
  heartbeatTimer.unref();
  let errorMessage = '';
  try {
    await queueApi('start', { jobId: job.job_id, runnerId: RUNNER_ID, leaseToken: job.leaseToken });
    checkout = await checkoutJobRepository({ repo: job.repository, branch: job.branch, commitSha: job.commit_sha });
    if (cancelRequested) {
      cancelled = true;
      throw new Error('Job cancellation requested before container start.');
    }

    const specs = job.commandIds.map((id) => {
      const command = COMMAND_ALLOWLIST[id];
      if (!command) throw new Error(`Command ${id} is not allowlisted by this runner.`);
      return { id, bin: command.bin, args: command.args, timeoutMs: command.timeoutMs };
    });

    const result = await executeDockerJob({
      sourceDir: checkout.directory,
      steps: specs,
      onHeartbeat: async () => cancelRequested,
      onStep: (step) => {
        const target = run.steps.find((item) => item.stepId === step.stepId);
        if (target) {
          target.status = step.exitCode === 0 ? 'succeeded' : 'failed';
          target.exitCode = step.exitCode;
          target.durationMs = step.durationMs;
          target.stdout = step.stdout;
          target.stderr = step.stderr;
        }
      },
    });
    cancelled = result.cancelled;
    if (!cancelled) {
      const failed = result.results.find((item) => item.exitCode !== 0);
      outcome = !failed ? 'succeeded' : failed.timedOut ? 'timed_out' : 'failed';
      errorMessage = failed?.stderr || '';
    }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Runner failed.';
    outcome = /timeout/i.test(errorMessage) ? 'timed_out' : 'failed';
  } finally {
    clearInterval(heartbeatTimer);
    await checkout?.cleanup().catch(() => undefined);
  }

  try {
    const completed = await queueApi<{ status: string }>('complete', {
      jobId: job.job_id, runnerId: RUNNER_ID, leaseToken: job.leaseToken,
      outcome, error: errorMessage,
      result: { cancelled, steps: run.steps.map(({ stepId, status, exitCode, durationMs }) => ({ stepId, status, exitCode, durationMs })) },
    });
    run.status = completed.status === 'succeeded' ? 'succeeded' :
      completed.status === 'cancelled' ? 'cancelled' :
      completed.status === 'timed_out' ? 'failed' :
      completed.status === 'queued' ? 'queued' : 'failed';
  } catch {
    // The lease will expire and the durable Control API will recover this job.
  }
  run.finishedAt = new Date().toISOString();
  activeRunId = null;
}

async function runnerLoop(): Promise<void> {
  while (process.env.AUTORUN_ENABLE_DOCKER_EXECUTION === 'true') {
    try {
      const claim = await queueApi<{ job: QueueJob | null }>('claim', { runnerId: RUNNER_ID, leaseSeconds: 90 });
      if (claim.job) await processClaimedJob(claim.job);
      else await delay(2500);
    } catch (error) {
      console.error('AutoRun durable runner poll failed:', error instanceof Error ? error.message : 'unknown error');
      await delay(5000);
    }
  }
  runnerStarted = false;
}

export function startRunnerWorker(): void {
  if (runnerStarted || process.env.AUTORUN_ENABLE_DOCKER_EXECUTION !== 'true') return;
  try { runnerImageFromEnv(); dockerNetworkFromEnv(); } catch (error) {
    console.error('AutoRun Docker runner is not ready:', error instanceof Error ? error.message : 'invalid config');
    return;
  }
  runnerStarted = true;
  void runnerLoop();
}
