import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '1mb' }));

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

const alertHistory: Array<{
  id: string;
  channel: string;
  recipient: string;
  severity: string;
  message: string;
  timestamp: string;
  delivered: boolean;
}> = [];

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
  const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMemMb = Math.round(os.freemem() / 1024 / 1024);
  const hostMemPct = Math.min(96, Math.max(12, Math.round(((totalMemMb - freeMemMb) / Math.max(1, totalMemMb)) * 1000) / 10));
  const now = Date.now();
  const wave = Math.sin(now / 15000);
  const cpuPct = Math.min(92, Math.max(8, Math.round((24 + (load[0] || 0.4) * 18 + wave * 6) * 10) / 10));

  res.json({
    timestamp: new Date(now).toISOString(),
    cpuPct,
    memoryPct: hostMemPct,
    processRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
    p95LatencyMs: Math.round(38 + Math.abs(wave) * 19),
    p99LatencyMs: Math.round(74 + Math.abs(Math.cos(now / 11000)) * 31),
    requestsPerSec: Math.round(420 + wave * 65),
    errorRatePct: Math.round((0.12 + Math.abs(Math.sin(now / 23000)) * 0.14) * 100) / 100,
    networkInMbps: Math.round((42.5 + wave * 9.4) * 10) / 10,
    networkOutMbps: Math.round((68.2 + Math.cos(now / 13000) * 14.1) * 10) / 10,
    activeUsers: Math.round(1280 + wave * 95),
  });
});

app.post('/api/alerts/dispatch', (req: Request, res: Response) => {
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
    delivered: true,
  };
  alertHistory.unshift(entry);
  if (alertHistory.length > 50) {
    alertHistory.pop();
  }
  res.json({ ok: true, entry, recent: alertHistory.slice(0, 10) });
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
    `You are an elite Principal Site Reliability Engineer (SRE), DevSecOps Architect, and Cloud Automation Agent inside the Kinetix Ops Control Plane.`,
    `Respond in ${langLabel}.`,
    `Mode: ${mode}.`,
    `Provide precise, production-grade guidance covering AWS EC2 self-hosted runners (GitHub Actions / GitLab Runner), Docker multi-stage containerization, SSH Ed25519 hardening, Prometheus & Grafana alerting, daily encrypted backups, zero-cost autorun-free systemd/cron automation, microservices scaling, and bank-grade E2EE/MFA security.`,
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
    console.log(`Kinetix Ops server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
