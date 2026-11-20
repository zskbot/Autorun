import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export interface DockerStep {
  id: string;
  bin: string;
  args: string[];
  timeoutMs: number;
}

export interface DockerStepResult {
  stepId: string;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

const OUTPUT_LIMIT = 16_000;
const MAX_JOB_SECONDS = 900;
const RUNNER_UID = '10001:10001';

function bounded(current: string, chunk: string): string {
  const next = current + chunk;
  return next.length <= OUTPUT_LIMIT ? next : next.slice(-OUTPUT_LIMIT);
}

function runProcess(bin: string, args: string[], timeoutMs: number): Promise<DockerStepResult> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(bin, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: {
      PATH: process.env.PATH || '/usr/bin:/bin',
      HOME: process.env.HOME || '/tmp',
      TMPDIR: process.env.TMPDIR || '/tmp',
      CI: 'true',
    } });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let forceKillTimer: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      }, 3000);
      forceKillTimer.unref();
    }, Math.min(timeoutMs, MAX_JOB_SECONDS * 1000));
    child.stdout.on('data', (chunk: Buffer) => { stdout = bounded(stdout, chunk.toString('utf8')); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = bounded(stderr, chunk.toString('utf8')); });
    child.on('error', (error) => { clearTimeout(timer); if (forceKillTimer) clearTimeout(forceKillTimer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      resolve({ stepId: '', exitCode: timedOut ? 124 : (code ?? 1), durationMs: Date.now() - started, stdout, stderr, timedOut });
    });
  });
}

export function runnerImageFromEnv(env = process.env): string {
  const image = String(env.AUTORUN_RUNNER_IMAGE || '').trim();
  if (!/^[A-Za-z0-9._/:+-]+@sha256:[a-f0-9]{64}$/.test(image)) {
    throw new Error('AUTORUN_RUNNER_IMAGE must be pinned to an immutable sha256 digest.');
  }
  return image;
}

export function dockerNetworkFromEnv(env = process.env): string {
  const network = String(env.AUTORUN_DOCKER_NETWORK || 'none').trim();
  if (network !== 'none' && !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/.test(network)) {
    throw new Error('Invalid Docker network name.');
  }
  if (network === 'host' || network === 'bridge') throw new Error('Host and default bridge networking are prohibited.');
  return network;
}

export function buildDockerCreateArgs(containerName: string, image: string, network: string): string[] {
  return [
    'create', '--name', containerName, '--network', network,
    '--cap-drop=ALL', '--security-opt=no-new-privileges',
    '--read-only', '--user', RUNNER_UID, '--pids-limit=128',
    '--memory=1g', '--cpus=1',
    '--tmpfs', '/tmp:rw,nosuid,nodev,noexec,size=256m',
    '--tmpfs', '/workspace:rw,mode=1777,nosuid,nodev,size=2g',
    '--workdir', '/workspace',
    '--env', 'CI=true', '--env', 'NODE_ENV=test', '--env', 'HOME=/tmp/home', '--env', 'npm_config_cache=/tmp/npm-cache', '--env', 'DATABASE_URL=postgresql://127.0.0.1:5432/autorun',
    image, 'sh', '-lc', 'sleep 900',
  ];
}

async function verifyDockerHost(requireRootless: boolean): Promise<void> {
  const info = await runProcess('docker', ['info', '--format', '{{json .SecurityOptions}}'], 15_000);
  if (info.exitCode !== 0) throw new Error('Docker daemon is unavailable.');
  if (requireRootless && !/rootless/i.test(info.stdout)) {
    throw new Error('Runner requires a rootless Docker daemon; refusing to execute.');
  }
}

async function verifyRestrictedNetwork(network: string): Promise<void> {
  if (network === 'none') return;
  const result = await runProcess('docker', [
    'network', 'inspect', '--format',
    '{{ index .Labels "ocodejs.autorun.egress" }}', network,
  ], 10_000);
  if (result.exitCode !== 0 || result.stdout.trim() !== 'restricted') {
    throw new Error('Custom Docker network is not labeled as an approved restricted-egress network.');
  }
}

export async function assertDockerRunnerReady(): Promise<void> {
  const network = dockerNetworkFromEnv();
  await assertDockerRunnerReady();
}

async function archiveGitCheckout(sourceDir: string, containerName: string): Promise<void> {
  const archive = spawn('git', ['-C', sourceDir, 'archive', '--format=tar', 'HEAD'], {
    shell: false, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: process.env.HOME || '/tmp' },
  });
  const extract = spawn('docker', ['exec', '-i', '-u', RUNNER_UID, containerName, 'tar', '-xf', '-', '-C', '/workspace'], {
    shell: false, stdio: ['pipe', 'ignore', 'pipe'],
    env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: process.env.HOME || '/tmp' },
  });
  archive.stdout.pipe(extract.stdin);
  let errors = '';
  archive.stderr.on('data', (chunk: Buffer) => { errors = bounded(errors, chunk.toString('utf8')); });
  extract.stderr.on('data', (chunk: Buffer) => { errors = bounded(errors, chunk.toString('utf8')); });
  const [archiveCode, extractCode] = await Promise.all([
    new Promise<number>((resolve, reject) => { archive.on('error', reject); archive.on('close', (code) => resolve(code ?? 1)); }),
    new Promise<number>((resolve, reject) => { extract.on('error', reject); extract.on('close', (code) => resolve(code ?? 1)); }),
  ]);
  if (archiveCode !== 0 || extractCode !== 0) throw new Error('Could not stream the source snapshot into the isolated container: ' + errors.slice(-1000));
}

export async function executeDockerJob(options: {
  sourceDir: string;
  steps: DockerStep[];
  onHeartbeat?: () => Promise<boolean>;
  onStep?: (result: DockerStepResult) => void;
}): Promise<{ results: DockerStepResult[]; cancelled: boolean; containerName: string }> {
  const image = runnerImageFromEnv();
  const network = dockerNetworkFromEnv();
  await verifyDockerHost(process.env.AUTORUN_DOCKER_REQUIRE_ROOTLESS !== 'false');
  await verifyRestrictedNetwork(network);

  const containerName = `ocodejs-autorun-${randomUUID()}`;
  let created = false;
  let cancelled = false;
  let heartbeatTimer: NodeJS.Timeout | undefined;
  let heartbeatBusy = false;
  const args = buildDockerCreateArgs(containerName, image, network);
  try {
    const create = await runProcess('docker', args, 30_000);
    if (create.exitCode !== 0) throw new Error('Docker container creation failed: ' + create.stderr.slice(-1000));
    created = true;
    const start = await runProcess('docker', ['start', containerName], 30_000);
    if (start.exitCode !== 0) throw new Error('Docker container start failed: ' + start.stderr.slice(-1000));
    await archiveGitCheckout(options.sourceDir, containerName);
    if (options.onHeartbeat) {
      heartbeatTimer = setInterval(async () => {
        if (heartbeatBusy || cancelled) return;
        heartbeatBusy = true;
        try {
          if (await options.onHeartbeat!()) {
            cancelled = true;
            await runProcess('docker', ['stop', '--time', '3', containerName], 10_000).catch(() => undefined);
          }
        } catch {
          cancelled = true;
          await runProcess('docker', ['stop', '--time', '3', containerName], 10_000).catch(() => undefined);
        } finally {
          heartbeatBusy = false;
        }
      }, 15_000);
      heartbeatTimer.unref();
    }

    const results: DockerStepResult[] = [];
    for (const step of options.steps) {
      if (options.onHeartbeat && await options.onHeartbeat()) {
        cancelled = true;
        await runProcess('docker', ['stop', '--time', '3', containerName], 10_000).catch(() => undefined);
        break;
      }
      const result = await runProcess('docker', [
        'exec', '-u', RUNNER_UID, containerName, step.bin, ...step.args,
      ], step.timeoutMs);
      result.stepId = step.id;
      results.push(result);
      options.onStep?.(result);
      if (result.timedOut || result.exitCode !== 0) break;
    }
    return { results, cancelled, containerName };
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (created) await runProcess('docker', ['rm', '-f', containerName], 20_000).catch(() => undefined);
  }
}
