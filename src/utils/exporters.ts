import {
  AutoRunningConfigExport,
  AutoRunningDaemon,
  BackupSnapshot,
  DaemonRunState,
  ImportedDaemonSpec,
  MetricPoint,
  PipelineRun,
  SystemLogEntry,
} from '../types/ops';

export function downloadTextFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportMetricsCsv(metrics: MetricPoint[], filename = 'kinetix-ops-metrics.csv') {
  const headers = [
    'Timestamp',
    'CPU (%)',
    'Memory (%)',
    'p95 Latency (ms)',
    'p99 Latency (ms)',
    'Throughput (req/s)',
    'Error Rate (%)',
    'Net In (Mbps)',
    'Net Out (Mbps)',
    'Active Users',
  ];
  const rows = metrics.map((m) => [
    m.time,
    m.cpuPct.toFixed(1),
    m.memoryPct.toFixed(1),
    m.p95LatencyMs.toString(),
    m.p99LatencyMs.toString(),
    m.requestsPerSec.toString(),
    m.errorRatePct.toFixed(2),
    m.networkInMbps.toFixed(1),
    m.networkOutMbps.toFixed(1),
    m.activeUsers.toString(),
  ]);
  const csvContent =
    '\uFEFF' + [headers, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadTextFile(filename, csvContent, 'text/csv;charset=utf-8');
}

export function exportAutoRunningCsv(
  daemons: AutoRunningDaemon[],
  filename = 'kinetix-auto-running-report.csv',
) {
  const headers = [
    'Unit Name',
    'Daemon Name',
    'Host',
    'Schedule',
    'State',
    'Success Count (24h)',
    'Failure Count (24h)',
    'Auto-Healed Count',
    'Last Exit Code',
    'Last Duration (ms)',
    'Last Execution Result',
  ];
  const rows = daemons.map((d) => [
    d.unitName,
    d.nameEn,
    d.host,
    d.cronExpr,
    d.state,
    d.successCount24h.toString(),
    d.failureCount24h.toString(),
    d.autoHealedCount.toString(),
    d.lastExitCode.toString(),
    d.lastDurationMs.toString(),
    d.lastExecutionResult,
  ]);
  const csvContent =
    '\uFEFF' + [headers, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadTextFile(filename, csvContent, 'text/csv;charset=utf-8');
}

export function exportAutoRunningJsonConfig(
  daemons: AutoRunningDaemon[],
  sourceEnvironment = 'aws-ap-southeast-1',
  filename = 'kinetix-auto-running-config.json',
) {
  const payload: AutoRunningConfigExport = {
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    sourceEnvironment,
    tasks: daemons.map((d) => ({
      unitName: d.unitName,
      nameVi: d.nameVi,
      nameEn: d.nameEn,
      host: d.host,
      cronExpr: d.cronExpr,
      intervalSec: d.intervalSec,
      command: d.command,
      alertOnFailure: d.alertOnFailure,
      state: d.state,
    })),
  };
  downloadTextFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

const VALID_STATES: DaemonRunState[] = ['active', 'running', 'paused', 'recovering'];

export function parseAndValidateDaemonConfigJson(
  rawText: string,
): { ok: true; tasks: ImportedDaemonSpec[] } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'Invalid JSON syntax.' };
  }

  const candidateTasks = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { tasks?: unknown }).tasks)
      ? (parsed as { tasks: unknown[] }).tasks
      : null;

  if (!candidateTasks || candidateTasks.length === 0) {
    return { ok: false, error: 'JSON must contain a non-empty "tasks" array.' };
  }

  const validTasks: ImportedDaemonSpec[] = [];
  for (let i = 0; i < candidateTasks.length; i++) {
    const item = candidateTasks[i] as Record<string, unknown>;
    if (
      !item ||
      typeof item !== 'object' ||
      typeof item.unitName !== 'string' ||
      !item.unitName.trim() ||
      typeof item.host !== 'string' ||
      !item.host.trim() ||
      typeof item.cronExpr !== 'string' ||
      !item.cronExpr.trim() ||
      typeof item.command !== 'string' ||
      !item.command.trim()
    ) {
      return {
        ok: false,
        error: `Task at index ${i} is missing required string fields (unitName, host, cronExpr, command).`,
      };
    }

    const intervalSec =
      typeof item.intervalSec === 'number' && Number.isFinite(item.intervalSec) && item.intervalSec >= 10
        ? Math.round(item.intervalSec)
        : 60;

    const state =
      typeof item.state === 'string' && VALID_STATES.includes(item.state as DaemonRunState)
        ? (item.state as DaemonRunState)
        : 'active';

    validTasks.push({
      unitName: item.unitName.trim(),
      nameVi: typeof item.nameVi === 'string' && item.nameVi.trim() ? item.nameVi.trim() : item.unitName.trim(),
      nameEn: typeof item.nameEn === 'string' && item.nameEn.trim() ? item.nameEn.trim() : item.unitName.trim(),
      host: item.host.trim(),
      cronExpr: item.cronExpr.trim(),
      intervalSec,
      command: item.command.trim(),
      alertOnFailure: typeof item.alertOnFailure === 'boolean' ? item.alertOnFailure : true,
      state,
    });
  }

  return { ok: true, tasks: validTasks };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportPeriodicExcelReport(
  metrics: MetricPoint[],
  pipelines: PipelineRun[],
  backups: BackupSnapshot[],
  logs: SystemLogEntry[],
  filename = 'kinetix-ops-periodic-report.xls',
) {
  const metricRows = metrics
    .map(
      (m) => `
      <Row>
        <Cell><Data ss:Type="String">${escapeXml(m.time)}</Data></Cell>
        <Cell><Data ss:Type="Number">${m.cpuPct}</Data></Cell>
        <Cell><Data ss:Type="Number">${m.memoryPct}</Data></Cell>
        <Cell><Data ss:Type="Number">${m.p95LatencyMs}</Data></Cell>
        <Cell><Data ss:Type="Number">${m.requestsPerSec}</Data></Cell>
        <Cell><Data ss:Type="Number">${m.errorRatePct}</Data></Cell>
        <Cell><Data ss:Type="Number">${m.activeUsers}</Data></Cell>
      </Row>`,
    )
    .join('');

  const backupRows = backups
    .map(
      (b) => `
      <Row>
        <Cell><Data ss:Type="String">${escapeXml(b.id)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(b.createdAt)}</Data></Cell>
        <Cell><Data ss:Type="Number">${b.sizeGb}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(b.encryption)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(b.status)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(b.checksumSha256)}</Data></Cell>
      </Row>`,
    )
    .join('');

  const pipelineRows = pipelines
    .map(
      (p) => `
      <Row>
        <Cell><Data ss:Type="String">${escapeXml(p.id)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.branch)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.commitSha)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.status)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(p.startedAt)}</Data></Cell>
      </Row>`,
    )
    .join('');

  const logRows = logs
    .slice(0, 30)
    .map(
      (l) => `
      <Row>
        <Cell><Data ss:Type="String">${escapeXml(l.timestamp)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(l.severity)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(l.service)}</Data></Cell>
        <Cell><Data ss:Type="String">${escapeXml(l.message)}</Data></Cell>
      </Row>`,
    )
    .join('');

  const workbookXml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Telemetry">
    <Table>
      <Row>
        <Cell><Data ss:Type="String">Time</Data></Cell>
        <Cell><Data ss:Type="String">CPU (%)</Data></Cell>
        <Cell><Data ss:Type="String">Memory (%)</Data></Cell>
        <Cell><Data ss:Type="String">p95 Latency (ms)</Data></Cell>
        <Cell><Data ss:Type="String">Requests/sec</Data></Cell>
        <Cell><Data ss:Type="String">Error Rate (%)</Data></Cell>
        <Cell><Data ss:Type="String">Active Users</Data></Cell>
      </Row>
      ${metricRows}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Pipelines">
    <Table>
      <Row>
        <Cell><Data ss:Type="String">Run ID</Data></Cell>
        <Cell><Data ss:Type="String">Branch</Data></Cell>
        <Cell><Data ss:Type="String">Commit</Data></Cell>
        <Cell><Data ss:Type="String">Status</Data></Cell>
        <Cell><Data ss:Type="String">Started At</Data></Cell>
      </Row>
      ${pipelineRows}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Backups">
    <Table>
      <Row>
        <Cell><Data ss:Type="String">Snapshot ID</Data></Cell>
        <Cell><Data ss:Type="String">Created At</Data></Cell>
        <Cell><Data ss:Type="String">Size (GB)</Data></Cell>
        <Cell><Data ss:Type="String">Encryption</Data></Cell>
        <Cell><Data ss:Type="String">Status</Data></Cell>
        <Cell><Data ss:Type="String">SHA-256</Data></Cell>
      </Row>
      ${backupRows}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="RecentLogs">
    <Table>
      <Row>
        <Cell><Data ss:Type="String">Timestamp</Data></Cell>
        <Cell><Data ss:Type="String">Severity</Data></Cell>
        <Cell><Data ss:Type="String">Service</Data></Cell>
        <Cell><Data ss:Type="String">Message</Data></Cell>
      </Row>
      ${logRows}
    </Table>
  </Worksheet>
</Workbook>`;

  downloadTextFile(filename, workbookXml, 'application/vnd.ms-excel;charset=utf-8');
}

export async function encryptWithAesGcm(plainText: string): Promise<{
  ciphertextBase64: string;
  ivHex: string;
  sha256Hex: string;
}> {
  const enc = new TextEncoder();
  const data = enc.encode(plainText);
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const digest = await crypto.subtle.digest('SHA-256', data);

  const bytes = new Uint8Array(encrypted);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const ciphertextBase64 = btoa(binary);
  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const sha256Hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { ciphertextBase64, ivHex, sha256Hex };
}
