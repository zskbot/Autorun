export interface D1Status {
  configured: boolean;
  endpointUrl: string | null;
  databaseId: string;
  reachable: boolean;
  lastError: string | null;
}

export interface D1RunPayload {
  id: string;
  repo: string;
  branch: string;
  prNumber: number | null;
  commitSha: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  requestedBy: string;
  runnerId: string;
  startedAt: string;
  finishedAt: string | null;
  stepsJson: string;
  artifactsJson: string;
}

export interface D1EventPayload {
  id: string;
  runId: string;
  type: string;
  timestamp: string;
  actor: string;
  detail: string;
}

export interface D1AlertPayload {
  id: string;
  channel: string;
  recipient: string;
  severity: string;
  message: string;
  timestamp: string;
}

function getD1Config() {
  const baseUrl = process.env.AUTORUN_CONTROL_API_URL?.trim() || '';
  const token = process.env.AUTORUN_CONTROL_TOKEN?.trim() || '';
  const databaseId = process.env.D1_DATABASE_ID?.trim() || 'ocodejs-autorun-staging';
  return {
    configured: Boolean(baseUrl && token),
    baseUrl: baseUrl.replace(/\/+$/, ''),
    token,
    databaseId,
  };
}

let lastD1Error: string | null = null;
let lastD1Reachable = false;

async function callD1Api<T>(path: string, init: RequestInit = {}): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const cfg = getD1Config();
  if (!cfg.configured) {
    lastD1Reachable = false;
    lastD1Error = 'Remote D1 Control API is not configured (set AUTORUN_CONTROL_API_URL and AUTORUN_CONTROL_TOKEN).';
    return { ok: false, status: 503, error: lastD1Error };
  }

  try {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.token}`,
        'X-D1-Database-Id': cfg.databaseId,
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(8000),
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }

    if (!res.ok) {
      const msg =
        typeof parsed === 'object' && parsed !== null && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : `D1 Control API returned HTTP ${res.status}`;
      lastD1Reachable = false;
      lastD1Error = msg;
      return { ok: false, status: res.status, error: msg };
    }

    lastD1Reachable = true;
    lastD1Error = null;
    return { ok: true, data: parsed as T };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reach Remote D1 Control API.';
    lastD1Reachable = false;
    lastD1Error = msg;
    return { ok: false, status: 502, error: msg };
  }
}

export async function getD1BridgeStatus(): Promise<D1Status> {
  const cfg = getD1Config();
  if (!cfg.configured) {
    return {
      configured: false,
      endpointUrl: null,
      databaseId: cfg.databaseId,
      reachable: false,
      lastError: 'Set AUTORUN_CONTROL_API_URL and AUTORUN_CONTROL_TOKEN to connect to ocodejs-autorun-staging.',
    };
  }
  await callD1Api('/api/d1/health', { method: 'GET' });
  return {
    configured: true,
    endpointUrl: cfg.baseUrl,
    databaseId: cfg.databaseId,
    reachable: lastD1Reachable,
    lastError: lastD1Error,
  };
}

export async function persistRunToD1(run: D1RunPayload) {
  return callD1Api('/api/d1/runs', {
    method: 'POST',
    body: JSON.stringify(run),
  });
}

export async function fetchRunsFromD1() {
  return callD1Api<{ runs: D1RunPayload[] }>('/api/d1/runs?limit=50', { method: 'GET' });
}

export async function persistEventToD1(event: D1EventPayload) {
  return callD1Api('/api/d1/events', {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function fetchEventsFromD1() {
  return callD1Api<{ events: D1EventPayload[] }>('/api/d1/events?limit=100', { method: 'GET' });
}

export async function persistAlertToD1(alert: D1AlertPayload) {
  return callD1Api('/api/d1/alerts', {
    method: 'POST',
    body: JSON.stringify(alert),
  });
}
