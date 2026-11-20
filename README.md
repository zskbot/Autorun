# OCodeJS AutoRun Control Center

AutoRun is a dashboard and a guarded local execution-agent prototype. It is **not yet a production runner service** and does not by itself remove GitHub Actions queue delays.

## Current execution model

1. An operator dispatches an allowlisted job through the authenticated API.
2. The agent validates the repository against `AUTORUN_ALLOWED_REPOSITORIES`.
3. It fetches the requested branch and exact 40-character commit SHA from GitHub.
4. It checks out that SHA in a fresh temporary directory.
5. It executes only server-defined command IDs, without a shell, then removes the temporary checkout.
6. Run and event state is mirrored to the configured OCodeJS staging Control API.

The local queue is still in process memory. D1 is currently a remote mirror, not yet the authoritative atomic queue. A process restart can therefore lose in-flight queue state. Do not use this build for critical production jobs.

## Safe defaults

Execution is disabled unless an operator explicitly sets:

```dotenv
AUTORUN_ENABLE_UNSANDBOXED_EXECUTION=false
AUTORUN_ALLOWED_REPOSITORIES=OCodejs/mcp.auth.ocodejs
```

**Do not enable execution on a general-purpose host.** The current agent does not yet provide Docker/VM isolation. Even though commands are allowlisted and spawned with `shell: false`, package installation and project build/test scripts execute repository-controlled code. Use only a dedicated disposable machine with no production credentials, no privileged network access, and no secrets in its environment. Prefer an ephemeral isolated runner before enabling this feature.

The repository allowlist is exact and comma-separated. The default example allows only `OCodejs/mcp.auth.ocodejs`; the actual runtime must be configured separately. Private repository checkout is not implemented in this iteration.

## Required configuration

- `AUTORUN_CONTROL_API_URL`: exact HTTPS URL of the existing staging Control API. Leave empty until the real endpoint is verified; do not use the example placeholder.
- `AUTORUN_CONTROL_TOKEN`: operator bearer token, configured only in the runtime secret manager.
- `D1_DATABASE_ID`: existing staging database identifier.
- `AUTORUN_ALLOWED_REPOSITORIES`: exact GitHub `owner/name` allowlist.
- `AUTORUN_ENABLE_UNSANDBOXED_EXECUTION`: must remain `false` until a dedicated isolated runner has been provisioned and reviewed.
- `GITHUB_WEBHOOK_SECRET`: webhook HMAC secret, configured only in the runtime secret manager.

Never commit real secret values.

## Webhook behavior

The webhook endpoint verifies `X-Hub-Signature-256`. Only `push` and pull-request `opened`, `reopened`, and `synchronize` events are eligible for dispatch. `workflow_job` is intentionally not used as a dispatch trigger, preventing a feedback loop where AutoRun-generated jobs trigger more AutoRun jobs.

## Verification status

The repository change set must pass typecheck/build and a security review before the execution flag is enabled. No staging database migration, production deployment, runner registration, or job execution is performed by this repository patch.
