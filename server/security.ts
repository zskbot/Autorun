import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

export interface AllowlistedCommand {
  id: string;
  label: string;
  bin: string;
  args: string[];
  timeoutMs: number;
  description: string;
}

export const COMMAND_ALLOWLIST: Record<string, AllowlistedCommand> = {
  typecheck: {
    id: 'typecheck',
    label: 'TypeScript Check (tsc --noEmit)',
    bin: 'npx',
    args: ['tsc', '--noEmit'],
    timeoutMs: 120_000,
    description: 'Validates TypeScript types across the workspace without emitting files.',
  },
  lint: {
    id: 'lint',
    label: 'Workspace Lint',
    bin: 'npm',
    args: ['run', 'lint'],
    timeoutMs: 120_000,
    description: 'Runs configured npm lint script in the target workspace.',
  },
  vite_build: {
    id: 'vite_build',
    label: 'Vite Production Build',
    bin: 'npm',
    args: ['run', 'build'],
    timeoutMs: 180_000,
    description: 'Builds production bundle via npm run build.',
  },
  npm_ci: {
    id: 'npm_ci',
    label: 'Install Dependencies (npm ci)',
    bin: 'npm',
    args: ['ci', '--no-audit', '--no-fund'],
    timeoutMs: 300_000,
    description: 'Clean deterministic dependency installation from package-lock.json.',
  },
  unit_tests: {
    id: 'unit_tests',
    label: 'Run Test Suite (npm test)',
    bin: 'npm',
    args: ['test', '--', '--watchAll=false'],
    timeoutMs: 240_000,
    description: 'Executes non-interactive unit/integration tests.',
  },
  prisma_generate: {
    id: 'prisma_generate',
    label: 'Prisma Client Generate',
    bin: 'npx',
    args: ['prisma', 'generate'],
    timeoutMs: 120_000,
    description: 'Generates Prisma client from schema.prisma.',
  },
  prisma_validate: {
    id: 'prisma_validate',
    label: 'Prisma Schema Validate',
    bin: 'npx',
    args: ['prisma', 'validate'],
    timeoutMs: 60_000,
    description: 'Validates Prisma schema integrity before build.',
  },
  nextjs_build: {
    id: 'nextjs_build',
    label: 'Next.js Production Build',
    bin: 'npx',
    args: ['next', 'build'],
    timeoutMs: 300_000,
    description: 'Compiles Next.js application for staging/preview verification.',
  },
};

export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireControlAuth(req: Request, res: Response, next: NextFunction): void {
  const expectedToken = process.env.AUTORUN_CONTROL_TOKEN;
  if (!expectedToken || !expectedToken.trim()) {
    res.status(503).json({
      error: 'Control-plane authentication is not configured (missing AUTORUN_CONTROL_TOKEN).',
      code: 'AUTH_NOT_CONFIGURED',
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or invalid Authorization Bearer token.',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const provided = authHeader.slice('Bearer '.length).trim();
  if (!constantTimeEquals(provided, expectedToken.trim())) {
    res.status(403).json({
      error: 'Forbidden: Bearer token rejected.',
      code: 'FORBIDDEN',
    });
    return;
  }

  next();
}

export function verifyGitHubHmac(rawBody: Buffer, signatureHeader: string | undefined): {
  valid: boolean;
  reason?: string;
} {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !secret.trim()) {
    return { valid: false, reason: 'GITHUB_WEBHOOK_SECRET is not configured on the server.' };
  }
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return { valid: false, reason: 'Missing X-Hub-Signature-256 header.' };
  }

  const digest = 'sha256=' + crypto.createHmac('sha256', secret.trim()).update(rawBody).digest('hex');
  if (!constantTimeEquals(digest, signatureHeader)) {
    return { valid: false, reason: 'HMAC-SHA256 signature mismatch.' };
  }
  return { valid: true };
}
