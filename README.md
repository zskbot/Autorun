# OCodeJS AutoRun Control Center

AutoRun is a dashboard and a guarded job runner. The durable queue and Docker runner in this branch are a staging prototype; they are not enabled by default and are not production-ready.

## Architecture

- GitHub remains the source of truth for repositories, branches and commits.
- Cloudflare Worker `ocodejs-autorun-control-staging` is the Control API.
- Existing D1 database `ocodejs-autorun-staging` stores durable jobs, leases, attempts and append-only job events.
- AutoRun submits idempotent jobs to the Control API and claims work using a short-lived lease.
- Each job runs in a disposable Docker container; the host checkout is streamed as a Git archive into a tmpfs workspace. No host directory or Docker socket is mounted into the job container.

## Queue protocol

The Control API queue routes are under `/api/v1/autorun/queue`:

- `POST /jobs`: idempotent job admission; exact repository allowlist, branch, full commit SHA and command IDs are validated.
- `POST /claim`: atomic D1 claim using one conditional `UPDATE ... RETURNING`; returns a one-time lease token.
- `POST /heartbeat`: extends the lease and returns cooperative cancellation state.
- `POST /start`: transitions a leased job to running.
- `POST /complete`: records success, failure or timeout; bounded retry policy applies.
- `POST /cancel`: cancels queued/leased work or sets a cancellation request for running work.
- `GET /jobs`: lists durable job state.

Expired leases are recovered during the next claim. The database trigger records queue status transitions in `autorun_job_events`. GitHub Actions run snapshots in `autorun_runs` and `autorun_events` remain a separate reporting history.

## Docker boundary

The runner fails closed unless `AUTORUN_RUNNER_IMAGE` is pinned to an immutable `@sha256:` digest. The job container uses:

- `--network none` by default; host and default bridge networking are rejected.
- `--cap-drop=ALL`, `--security-opt=no-new-privileges`, `--read-only`, non-root UID 10001.
- CPU 1, memory 1 GiB, PID limit 128, bounded tmpfs for `/tmp` and `/workspace`.
- No privileged mode, host mounts, Docker socket, runner credentials or long-lived secrets inside the container.
- A hard timeout per allowlisted step and forced container removal in `finally`.

A custom egress network is accepted only when it has the operator label `ocodejs.autorun.egress=restricted`. That label is an attestation, not proof of firewall enforcement. A dedicated runner host must enforce and independently test outbound DNS/HTTP allowlists before any networked job is enabled. Do not use the default bridge or host network.

The runner host must use rootless Docker by default. The host's Docker daemon is controlled by the runner process; the daemon socket is never exposed to the job container. Do not run this service on a general-purpose application host.

## Safe configuration

Keep execution disabled until all CI and host acceptance tests pass:

```dotenv
AUTORUN_ENABLE_UNSANDBOXED_EXECUTION=false
AUTORUN_ENABLE_DOCKER_EXECUTION=false
AUTORUN_CONTROL_API_URL=https://ocodejs-autorun-control-staging.ocodejs-df1.workers.dev
AUTORUN_RUNNER_TOKEN=
AUTORUN_RUNNER_IMAGE=
AUTORUN_DOCKER_NETWORK=none
AUTORUN_DOCKER_REQUIRE_ROOTLESS=true
AUTORUN_ALLOWED_REPOSITORIES=OCodejs/mcp.auth.ocodejs
```

The Worker requires `AUTORUN_RUNNER_TOKEN_SHA256` as a Cloudflare secret. AutoRun receives the matching plaintext token only through its secret manager. Never commit or log either value. The D1 migration `0002_durable_queue.sql` is not applied by this PR.

## Validation gate

The PR workflow runs TypeScript, unit tests, frontend build and Docker boundary smoke tests. These are necessary but not sufficient for staging acceptance. Before connecting `OCodejs/mcp.auth.ocodejs`, also verify on a dedicated rootless Docker host:

1. Two independent runners cannot claim the same job.
2. Restart after claim recovers an expired lease without losing the job.
3. Timeout, retry budget and cancellation stop the container and persist terminal state.
4. No host path, Docker socket, host PID/network namespace or elevated capability is visible from the container.
5. Egress is denied by default; any custom restricted network is tested against an explicit allowlist.
6. Container cleanup removes writable layers and tmpfs after success, failure, timeout and cancellation.

No D1 migration, Worker deployment, secret configuration, runner registration, staging job, Production deployment, DNS change or PR merge is part of this change.
