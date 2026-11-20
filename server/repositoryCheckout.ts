import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const GITHUB_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const BRANCH = /^[A-Za-z0-9._/-]{1,200}$/;
const SHA = /^[a-f0-9]{40}$/i;

export interface CheckedOutWorkspace {
  directory: string;
  cleanup: () => Promise<void>;
}

export function isRepositoryAllowed(repo: string): boolean {
  return allowedRepositories().has(repo.trim().toLowerCase());
}

function allowedRepositories(): Set<string> {
  return new Set(
    (process.env.AUTORUN_ALLOWED_REPOSITORIES || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function checkoutJobRepository(input: {
  repo: string;
  branch: string;
  commitSha: string;
}): Promise<CheckedOutWorkspace> {
  if (process.env.AUTORUN_ENABLE_UNSANDBOXED_EXECUTION !== 'true') {
    throw new Error('Execution is disabled. Set AUTORUN_ENABLE_UNSANDBOXED_EXECUTION=true only on a dedicated, isolated runner.');
  }

  const repo = input.repo.trim();
  const branch = input.branch.trim();
  const commitSha = input.commitSha.trim().toLowerCase();

  if (!GITHUB_REPO.test(repo) || repo.includes('..')) {
    throw new Error('Repository must use the owner/name GitHub format.');
  }
  if (!BRANCH.test(branch) || branch.startsWith('-') || branch.includes('..') || branch.endsWith('/')) {
    throw new Error('Branch name is invalid.');
  }
  if (!SHA.test(commitSha)) {
    throw new Error('A full 40-character commit SHA is required; HEAD and abbreviated SHAs are rejected.');
  }
  if (!allowedRepositories().has(repo.toLowerCase())) {
    throw new Error(`Repository ${repo} is not in AUTORUN_ALLOWED_REPOSITORIES.`);
  }

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'autorun-job-'));
  const directory = path.join(root, 'source');
  const remote = `https://github.com/${repo}.git`;

  try {
    await execFileAsync('git', ['init', directory], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    await execFileAsync('git', ['-C', directory, 'remote', 'add', 'origin', remote], { timeout: 30_000 });
    await execFileAsync('git', ['-C', directory, 'fetch', '--depth=1', 'origin', `refs/heads/${branch}`], {
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    await execFileAsync('git', ['-C', directory, 'fetch', '--depth=1', 'origin', commitSha], {
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const { stdout: fetchedSha } = await execFileAsync('git', ['-C', directory, 'rev-parse', 'FETCH_HEAD'], { timeout: 30_000 });
    if (fetchedSha.trim().toLowerCase() !== commitSha) {
      throw new Error('Fetched commit SHA does not match the requested commit SHA.');
    }
    await execFileAsync('git', ['-C', directory, 'checkout', '--detach', commitSha], { timeout: 30_000 });
    const { stdout: headSha } = await execFileAsync('git', ['-C', directory, 'rev-parse', 'HEAD'], { timeout: 30_000 });
    if (headSha.trim().toLowerCase() !== commitSha) {
      throw new Error('Checked-out HEAD does not match the requested commit SHA.');
    }

    return {
      directory,
      cleanup: async () => fs.rm(root, { recursive: true, force: true }),
    };
  } catch (error) {
    await fs.rm(root, { recursive: true, force: true });
    throw error;
  }
}
