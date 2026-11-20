import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { checkoutJobRepository, isRepositoryAllowed } from './repositoryCheckout.js';

const original = {
  enabled: process.env.AUTORUN_ENABLE_UNSANDBOXED_EXECUTION,
  allowed: process.env.AUTORUN_ALLOWED_REPOSITORIES,
};

afterEach(() => {
  if (original.enabled === undefined) delete process.env.AUTORUN_ENABLE_UNSANDBOXED_EXECUTION;
  else process.env.AUTORUN_ENABLE_UNSANDBOXED_EXECUTION = original.enabled;
  if (original.allowed === undefined) delete process.env.AUTORUN_ALLOWED_REPOSITORIES;
  else process.env.AUTORUN_ALLOWED_REPOSITORIES = original.allowed;
});

test('repository allowlist is exact and case-insensitive', () => {
  process.env.AUTORUN_ALLOWED_REPOSITORIES = 'OCodejs/mcp.auth.ocodejs';
  assert.equal(isRepositoryAllowed('ocodejs/MCP.AUTH.OCODEJS'), true);
  assert.equal(isRepositoryAllowed('OCodejs/other'), false);
});

test('checkout remains disabled unless explicitly enabled', async () => {
  process.env.AUTORUN_ENABLE_UNSANDBOXED_EXECUTION = 'false';
  await assert.rejects(
    checkoutJobRepository({
      repo: 'OCodejs/mcp.auth.ocodejs',
      branch: 'main',
      commitSha: 'a'.repeat(40),
    }),
    /Execution is disabled/,
  );
});

test('checkout rejects repositories outside the configured allowlist', async () => {
  process.env.AUTORUN_ENABLE_UNSANDBOXED_EXECUTION = 'true';
  process.env.AUTORUN_ALLOWED_REPOSITORIES = 'OCodejs/mcp.auth.ocodejs';
  await assert.rejects(
    checkoutJobRepository({
      repo: 'OCodejs/another-repo',
      branch: 'main',
      commitSha: 'a'.repeat(40),
    }),
    /not in AUTORUN_ALLOWED_REPOSITORIES/,
  );
});

test('checkout requires a full commit SHA', async () => {
  process.env.AUTORUN_ENABLE_UNSANDBOXED_EXECUTION = 'true';
  process.env.AUTORUN_ALLOWED_REPOSITORIES = 'OCodejs/mcp.auth.ocodejs';
  await assert.rejects(
    checkoutJobRepository({
      repo: 'OCodejs/mcp.auth.ocodejs',
      branch: 'main',
      commitSha: 'deadbeef',
    }),
    /full 40-character commit SHA/,
  );
});
