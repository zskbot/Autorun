import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDockerCreateArgs, dockerNetworkFromEnv, runnerImageFromEnv } from './dockerRunner.js';

const digestImage = 'node:22-bookworm-slim@sha256:' + 'a'.repeat(64);

test('runner refuses mutable image tags and requires an immutable digest', () => {
  assert.throws(() => runnerImageFromEnv({ AUTORUN_RUNNER_IMAGE: 'node:22-bookworm-slim' }), /immutable sha256 digest/);
  assert.equal(runnerImageFromEnv({ AUTORUN_RUNNER_IMAGE: digestImage }), digestImage);
});

test('runner network defaults to no network and rejects host/default bridge', () => {
  assert.equal(dockerNetworkFromEnv({}), 'none');
  assert.throws(() => dockerNetworkFromEnv({ AUTORUN_DOCKER_NETWORK: 'ocodejs-egress-restricted' }), /Only --network none/);
  assert.throws(() => dockerNetworkFromEnv({ AUTORUN_DOCKER_NETWORK: 'host' }), /Only --network none/);
  assert.throws(() => dockerNetworkFromEnv({ AUTORUN_DOCKER_NETWORK: 'bridge' }), /Only --network none/);
});

test('job container is non-privileged, non-root, resource limited and has no host mounts', () => {
  const args = buildDockerCreateArgs('job-test', digestImage, 'none');
  const joined = args.join(' ');
  for (const flag of ['--network none', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--read-only', '--user 10001:10001', '--pids-limit=128', '--memory=1g', '--memory-swap=1g', '--cpus=1', '--tmpfs']) {
    assert.ok(joined.includes(flag), `missing ${flag}`);
  }
  assert.doesNotMatch(joined, /--privileged|--volume| -v |docker\.sock|--network host/);
  assert.equal(args.includes('--privileged'), false);
});

test('Docker arguments never request host mounts, devices, privileged mode or host networking', () => {
  const args = buildDockerCreateArgs('job-boundary', digestImage, 'none');
  assert.equal(args.includes('--privileged'), false);
  assert.equal(args.some((arg) => arg === '--volume' || arg === '-v' || arg === '--mount' || arg === '--device'), false);
  assert.equal(args.includes('/var/run/docker.sock'), false);
  assert.equal(args[args.indexOf('--network') + 1], 'none');
  assert.equal(args[args.indexOf('--user') + 1], '10001:10001');
  assert.equal(args[args.indexOf('--pids-limit=128')], '--pids-limit=128');
});
