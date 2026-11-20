import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  fetchEventsFromD1,
  fetchRunsFromD1,
  getD1BridgeStatus,
  persistAlertToD1,
  persistEventToD1,
} from './server/d1Bridge.js';
import {
  cancelJobRun,
  enqueueJobRun,
  getLiveWorkspaceRuns,
  getRunnerHeartbeat,
} from './server/executionAgent.js';
import {
  COMMAND_ALLOWLIST,
  requireControlAuth,
  verifyGitHubHmac,
} from './server/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// GitHub Webhook requires raw body buffer for HMAC-SHA256 verification before JSON parsing
app.post(
  '/api/github/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req: Request, res: Response) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
    const signature = req.header('X-Hub-Signature-256');
    const hmacCheck = verifyGitHubHmac(rawBody, signature);

    if (!hmacCheck.valid) {
      res.status(401).json({
        error: hmacCheck.reason || 'Webhook signature verification failed.',
        code: 'INVALID_GITHUB_SIGNATURE',
      });
      return;
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      res.status(400).json({ error: 'Invalid webhook JSON body.' });
      return;
    }

    const eventType = req.header('X-GitHub-Event') || 'unknown';
    const repoObj = payload.repository as { full_name?: string } | undefined;
    const prObj = payload.pull_request as
      | { number?: number; head?: { ref?: string; sha?: string } }
      | undefined;
    const headCommit = payload.head_commit as { id?: string } | undefined;

    const repo = repoObj?.full_name || 'zskbot/OCodeJS-Auth';
    const prNumber = typeof prObj?.number === 'number' ? prObj.number : null;
    const branch =
      prObj?.head?.ref ||
      (typeof payload.ref === 'string' ? payload.ref.replace('refs/heads/', '') : 'main');
    const commitSha = prObj?.head?.sha || headCommit?.id || String(payload.after || 'HEAD').slice(0, 12);

    await persistEventToD1({
      id: `evt-${Date.now()}`,
      runId: prNumber ? `pr-${prNumber}` : 'webhook',
      type: 'WEBHOOK_RECEIVED',
      timestamp: new Date().toISOString(),
      actor: 'github-webhook',
      detail: `Verified ${eventType} for ${repo} (${branch} @ ${commitSha})`,
    });

    const pullRequestAction = typeof payload.action === 'string' ? payload.action : '';
    const approvedPullRequestAction = ['opened', 'reopened', 'synchronize'].includes(pullRequestAction);
    if (eventType === 'push' || (eventType === 'pull_request' && approvedPullRequestAction)) {
      const enqueued = await enqueueJobRun({
        repo,
        branch,
        prNumber,
        commitSha,
        requestedBy: `github:${eventType}`,
        stepIds: ['typecheck', 'lint', 'vite_build'],
      });
      if (!enqueued.ok) {
        res.status(400).json({ error: enqueued.error });
        return;
      }
      res.status(202).json({ accepted: true, eventType, run: enqueued.run });
      return;
    }

    res.json({ accepted: true, eventType, ignored: true });
  },
);

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    uptimeSec: Math.round(process.uptime()),
    nodeVersion: process.version,
    hostname: os.hostname(),
    rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/metrics/live', (_req: Request, res: Response) => {
  const mem = process.memoryUsage();
  const load = os.loadavg();
  const cpus = Math.max(1, os.cpus().length);
  const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
  const hostMemPct = Math.round(((totalMemMb - freeMemMb) / Math.max(1, totalMemMb)) * 1000) / 10;
  const cpuPct = Math.min(100, Math.round(((load[0] || 0) / cpus) * 1000) / 10);

  res.json({
    timestamp: new Date().toISOString(),
    cpuPct,
    memoryPct: hostMemPct,
    processRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    p95LatencyMs: 0,
    p99LatencyMs: 0,
    requestsPerSec: 0,
    errorRatePct: 0,
    networkInMbps: 0,
    networkOutMbps: 0,
    activeUsers: getLiveWorkspaceRuns().filter((r) => r.status === 'running' || r.status === 'queued').length,
  });
});

app.get('/api/control/status', async (_req: Request, res: Response) => {
  const d1 = await getD1BridgeStatus();
  res.json({
    authConfigured: Boolean(process.env.AUTORUN_CONTROL_TOKEN?.trim()),
    githubWebhookConfigured: Boolean(process.env.GITHUB_WEBHOOK_SECRET?.trim()),
    githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN?.trim()),
    executionEnabled: process.env.AUTORUN_ENABLE_UNSANDBOXED_EXECUTION === 'true',
    allowedRepositories: (process.env.AUTORUN_ALLOWED_REPOSITORIES || '').split(',').map((repo) => repo.trim()).filter(Boolean),
    d1,
    runner: getRunnerHeartbeat(),
    allowlist: Object.values(COMMAND_ALLOWLIST).map((c) => ({
      id: c.id,
      label: c.label,
      command: `${c.bin} ${c.args.join(' ')}`,
      timeoutMs: c.timeoutMs,
      description: c.description,
    })),
  });
});

app.get('/api/runs', async (_req: Request, res: Response) => {
  const localRuns = getLiveWorkspaceRuns();
  const d1Result = await fetchRunsFromD1();
  res.json({
    runs: localRuns,
    d1: d1Result.ok
      ? { synced: true, remoteRunsCount: d1Result.data.runs?.length ?? 0, remoteRuns: d1Result.data.runs ?? [] }
      : { synced: false, error: d1Result.error },
  });
});

app.post('/api/runs/dispatch', requireControlAuth, async (req: Request, res: Response) => {
  const { repo, branch, prNumber, commitSha, stepIds } = req.body ?? {};
  const steps = Array.isArray(stepIds) ? stepIds.map(String) : [];

  const result = await enqueueJobRun({
    repo: typeof repo === 'string' ? repo : 'zskbot/OCodeJS-Auth',
    branch: typeof branch === 'string' ? branch : 'main',
    prNumber: typeof prNumber === 'number' ? prNumber : null,
    commitSha: typeof commitSha === 'string' ? commitSha : 'HEAD',
    requestedBy: 'authorized-operator',
    stepIds: steps,
  });

  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.status(202).json({ accepted: true, run: result.run });
});

app.post('/api/runs/:id/cancel', requireControlAuth, async (req: Request, res: Response) => {
  const runId = String(req.params.id || '');
  const result = await cancelJobRun(runId, 'authorized-operator');
  if (!result.ok) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json({ cancelled: true, run: result.run });
});

app.get('/api/events', async (_req: Request, res: Response) => {
  const result = await fetchEventsFromD1();
  if (!result.ok) {
    res.status(result.status).json({ error: result.error, events: [] });
    return;
  }
  res.json({ events: result.data.events ?? [] });
});

app.post('/api/alerts/dispatch', requireControlAuth, async (req: Request, res: Response) => {
  const { channel, recipient, severity, message } = req.body ?? {};
  if (!channel || !recipient || !message) {
    res.status(400).json({ error: 'Missing channel, recipient, or message.' });
    return;
  }

  const entry = {
    id: `alt-${Date.now()}`,
    channel: String(channel),
    recipient: String(recipient),
    severity: String(severity || 'warning'),
    message: String(message),
    timestamp: new Date().toISOString(),
  };

  const persisted = await persistAlertToD1(entry);
  if (!persisted.ok) {
    res.status(persisted.status).json({
      error: `Alert rejected by persistent storage bridge: ${persisted.error}`,
      entry,
    });
    return;
  }

  res.json({ ok: true, entry });
});

app.post('/api/ai/consult', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server. Set it in Settings > Secrets.',
    });
    return;
  }

  const { question, context, language = 'vi', mode = 'consult' } = req.body ?? {};
  if (!question || typeof question !== 'string') {
    res.status(400).json({ error: 'Question prompt is required.' });
    return;
  }

  const langLabel = language === 'vi' ? 'Vietnamese' : 'English';
  const systemInstruction = [
    `You are an elite Principal Site Reliability Engineer (SRE), DevSecOps Architect, and Cloud Automation Agent inside the OCodeJS AutoRun Control Center.`,
    `Respond in ${langLabel}.`,
    `Mode: ${mode}.`,
    `Provide precise, production-grade guidance covering local/self-hosted execution agents, D1 job persistence, GitHub Actions webhooks & PR verification, Docker isolation, SSH Ed25519 hardening, Prometheus & Grafana alerting, and bank-grade security.`,
    `Format cleanly with short sections, exact commands or YAML/Bash snippets when helpful, and concrete verification checks.`,
  ].join(' ');

  const promptContent = context
    ? `Active Infrastructure Context:\n${JSON.stringify(context, null, 2)}\n\nOperator Request:\n${question}`
    : question;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: promptContent,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    res.json({
      answer: response.text ?? '',
      model: 'gemini-4-hydrogen',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to query AI Operations Agent.';
    console.error('Gemini /api/ai/consult error:', err);
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kinetix Ops / AutoRun Control Center listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
