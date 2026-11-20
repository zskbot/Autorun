export type Language = 'vi' | 'en';
export type ThemeMode = 'light' | 'dark';
export type AccentTheme = 'cobalt' | 'emerald' | 'indigo';
export type DensityMode = 'compact' | 'comfortable';

export type NavSection =
  | 'overview'
  | 'pipeline'
  | 'observability'
  | 'automation'
  | 'auto-running'
  | 'security'
  | 'architecture'
  | 'runbook'
  | 'ai-agent';

export type RunnerPlatform = 'github-actions' | 'gitlab-runner';

export interface RunnerConfig {
  platform: RunnerPlatform;
  awsRegion: string;
  instanceType: string;
  runnerName: string;
  repositoryUrl: string;
  targetBranch: string;
  stagingHost: string;
  stagingPort: number;
  sshUser: string;
  dockerImage: string;
  appPort: number;
  healthcheckPath: string;
  autoDeployStaging: boolean;
}

export type StageStatus = 'idle' | 'running' | 'success' | 'failed';

export interface PipelineStage {
  id: string;
  name: string;
  durationSec: number;
  status: StageStatus;
  logs: string[];
}

export interface PipelineRun {
  id: string;
  commitSha: string;
  branch: string;
  author: string;
  startedAt: string;
  status: StageStatus;
  stages: PipelineStage[];
}

export interface MetricPoint {
  time: string;
  cpuPct: number;
  memoryPct: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  requestsPerSec: number;
  errorRatePct: number;
  networkInMbps: number;
  networkOutMbps: number;
  activeUsers: number;
}

export type LogSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  service: string;
  severity: LogSeverity;
  message: string;
  traceId: string;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: string;
  channels: Array<'email' | 'sms' | 'push'>;
  enabled: boolean;
  lastTriggered: string | null;
}

export interface BackupSnapshot {
  id: string;
  createdAt: string;
  type: 'daily-auto' | 'manual';
  sizeGb: number;
  encryption: 'AES-256-GCM';
  checksumSha256: string;
  destination: string;
  status: 'verified' | 'restoring' | 'completed';
}

export interface AutorunTask {
  id: string;
  nameVi: string;
  nameEn: string;
  scheduleCron: string;
  systemdUnit: string;
  command: string;
  enabled: boolean;
  lastRunAt: string;
  lastResult: 'success' | 'running' | 'skipped';
  savedCostNoteVi: string;
  savedCostNoteEn: string;
}

export interface EnvSecret {
  id: string;
  key: string;
  encryptedValue: string;
  plainPreview: string;
  scope: 'runner' | 'staging' | 'production';
  updatedAt: string;
  rotatedBy: string;
}

export interface OpsPlugin {
  id: string;
  name: string;
  category: string;
  descriptionVi: string;
  descriptionEn: string;
  enabled: boolean;
  provider: string;
}

export interface MicroserviceNode {
  id: string;
  name: string;
  protocol: string;
  instances: number;
  rps: number;
  p95Ms: number;
  errorPct: number;
  status: 'healthy' | 'degraded';
}

export interface SyncQueueItem {
  id: string;
  action: string;
  payloadSummary: string;
  createdAt: string;
  synced: boolean;
}

export interface PushToast {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  timestamp: string;
}

export interface UiPreferences {
  language: Language;
  theme: ThemeMode;
  accent: AccentTheme;
  density: DensityMode;
}

export type DaemonRunState = 'active' | 'running' | 'paused' | 'recovering';

export interface AutoRunningDaemon {
  id: string;
  nameVi: string;
  nameEn: string;
  unitName: string;
  host: string;
  cronExpr: string;
  intervalSec: number;
  nextRunInSec: number;
  command: string;
  state: DaemonRunState;
  lastExitCode: number;
  lastDurationMs: number;
  cpuOverheadPct: number;
  memoryMb: number;
  cpuHistory60m: number[];
  memoryHistory60m: number[];
  successCount24h: number;
  failureCount24h: number;
  autoHealedCount: number;
  lastExecutionResult: string;
  alertOnFailure: boolean;
}

export interface ImportedDaemonSpec {
  unitName: string;
  nameVi?: string;
  nameEn?: string;
  host: string;
  cronExpr: string;
  intervalSec: number;
  command: string;
  alertOnFailure?: boolean;
  state?: DaemonRunState;
}

export interface AutoRunningConfigExport {
  schemaVersion: string;
  exportedAt: string;
  sourceEnvironment: string;
  tasks: ImportedDaemonSpec[];
}

export interface AutoRunningExecutionLog {
  id: string;
  timestamp: string;
  unitName: string;
  host: string;
  trigger: 'SCHEDULED' | 'WATCHDOG' | 'MANUAL';
  exitCode: number;
  durationMs: number;
  output: string;
}

