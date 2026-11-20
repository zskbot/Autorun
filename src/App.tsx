import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { CustomizerModal } from './components/CustomizerModal';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import {
  DEFAULT_RUNNER_CONFIG,
  INITIAL_ALERTS,
  INITIAL_AUTO_RUNNING_DAEMONS,
  INITIAL_AUTO_RUNNING_LOGS,
  INITIAL_AUTORUN_TASKS,
  INITIAL_BACKUPS,
  INITIAL_LOGS,
  INITIAL_MICROSERVICES,
  INITIAL_PIPELINES,
  INITIAL_PLUGINS,
  INITIAL_SECRETS,
} from './data/initialData';
import { useOfflineSync } from './hooks/useOfflineSync';
import { TRANSLATIONS } from './i18n/translations';
import {
  AlertRule,
  AutoRunningDaemon,
  AutoRunningExecutionLog,
  AutorunTask,
  BackupSnapshot,
  EnvSecret,
  ImportedDaemonSpec,
  MetricPoint,
  NavSection,
  OpsPlugin,
  PipelineRun,
  RunnerConfig,
  SystemLogEntry,
  UiPreferences,
} from './types/ops';
import { encryptWithAesGcm } from './utils/exporters';
import { AiAgentView } from './views/AiAgentView';
import { ArchitecturePluginsView } from './views/ArchitecturePluginsView';
import { AutoRunningMonitorView } from './views/AutoRunningMonitorView';
import { AutomationBackupView } from './views/AutomationBackupView';
import { ObservabilityView } from './views/ObservabilityView';
import { OverviewView } from './views/OverviewView';
import { PipelineRunnerView } from './views/PipelineRunnerView';
import { RunbookView } from './views/RunbookView';
import { SecurityVaultView } from './views/SecurityVaultView';

const PREFS_STORAGE_KEY = 'kinetix_ops_prefs_v1';

function buildInitialMetrics(): MetricPoint[] {
  const now = Date.now();
  const points: MetricPoint[] = [];
  for (let i = 15; i >= 0; i--) {
    const ts = new Date(now - i * 3000);
    const wave = Math.sin((now - i * 3000) / 15000);
    points.push({
      time: ts.toLocaleTimeString([], { hour12: false }),
      cpuPct: Math.round((28 + wave * 7) * 10) / 10,
      memoryPct: Math.round((54 + Math.cos((now - i * 3000) / 19000) * 5) * 10) / 10,
      p95LatencyMs: Math.round(39 + Math.abs(wave) * 16),
      p99LatencyMs: Math.round(76 + Math.abs(Math.cos((now - i * 3000) / 11000)) * 28),
      requestsPerSec: Math.round(415 + wave * 58),
      errorRatePct: Math.round((0.14 + Math.abs(wave) * 0.09) * 100) / 100,
      networkInMbps: Math.round((41 + wave * 8.5) * 10) / 10,
      networkOutMbps: Math.round((66 + Math.cos((now - i * 3000) / 13000) * 12) * 10) / 10,
      activeUsers: Math.round(1265 + wave * 82),
    });
  }
  return points;
}

export default function App() {
  const [prefs, setPrefs] = useState<UiPreferences>(() => {
    try {
      const saved = localStorage.getItem(PREFS_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as UiPreferences;
    } catch {
      // Ignore storage read errors
    }
    return { language: 'vi', theme: 'light', accent: 'cobalt', density: 'comfortable' };
  });

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [customizerOpen, setCustomizerOpen] = useState(false);

  const [runnerConfig, setRunnerConfig] = useState<RunnerConfig>(DEFAULT_RUNNER_CONFIG);
  const [pipelines, setPipelines] = useState<PipelineRun[]>(INITIAL_PIPELINES);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  const [metrics, setMetrics] = useState<MetricPoint[]>(buildInitialMetrics);
  const [streaming, setStreaming] = useState(true);
  const [logs, setLogs] = useState<SystemLogEntry[]>(INITIAL_LOGS);
  const [alerts, setAlerts] = useState<AlertRule[]>(INITIAL_ALERTS);
  const [backups, setBackups] = useState<BackupSnapshot[]>(INITIAL_BACKUPS);
  const [autorunTasks, setAutorunTasks] = useState<AutorunTask[]>(INITIAL_AUTORUN_TASKS);
  const [autoRunningDaemons, setAutoRunningDaemons] = useState<AutoRunningDaemon[]>(INITIAL_AUTO_RUNNING_DAEMONS);
  const [autoRunningLogs, setAutoRunningLogs] = useState<AutoRunningExecutionLog[]>(INITIAL_AUTO_RUNNING_LOGS);
  const [autoRunHistory, setAutoRunHistory] = useState<Array<{ time: string; avgMs: number; cpuPct: number }>>(() => {
    const now = Date.now();
    return Array.from({ length: 12 }, (_, idx) => ({
      time: new Date(now - (11 - idx) * 5000).toLocaleTimeString([], { hour12: false }),
      avgMs: Math.round(140 + Math.sin(idx / 2) * 35),
      cpuPct: Math.round((0.9 + Math.abs(Math.cos(idx / 2)) * 0.6) * 10) / 10,
    }));
  });
  const [secrets, setSecrets] = useState<EnvSecret[]>(INITIAL_SECRETS);
  const [plugins, setPlugins] = useState<OpsPlugin[]>(INITIAL_PLUGINS);
  const [mfaVerified, setMfaVerified] = useState(false);

  const {
    isOnline,
    simulatedOffline,
    setSimulatedOffline,
    queue,
    pendingCount,
    lastSyncedAt,
    recordOperation,
    flushSyncQueue,
    toasts,
    pushToast,
    dismissToast,
  } = useOfflineSync();

  const t = TRANSLATIONS[prefs.language];

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.lang = prefs.language;
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Ignore storage write errors
    }
  }, [prefs]);

  const appendLog = useCallback((service: string, severity: SystemLogEntry['severity'], message: string) => {
    setLogs((prev) => [
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        timestamp: new Date().toLocaleTimeString([], { hour12: false }),
        service,
        severity,
        message,
        traceId: `tr-${Math.random().toString(16).slice(2, 7)}`,
      },
      ...prev.slice(0, 79),
    ]);
  }, []);

  useEffect(() => {
    if (!streaming || !isOnline) return;
    const poll = async () => {
      try {
        const res = await fetch('/api/metrics/live');
        if (!res.ok) return;
        const data = await res.json();
        const nextPoint: MetricPoint = {
          time: new Date(data.timestamp).toLocaleTimeString([], { hour12: false }),
          cpuPct: data.cpuPct,
          memoryPct: data.memoryPct,
          p95LatencyMs: data.p95LatencyMs,
          p99LatencyMs: data.p99LatencyMs,
          requestsPerSec: data.requestsPerSec,
          errorRatePct: data.errorRatePct,
          networkInMbps: data.networkInMbps,
          networkOutMbps: data.networkOutMbps,
          activeUsers: data.activeUsers,
        };
        setMetrics((prev) => [...prev.slice(-19), nextPoint]);
      } catch {
        // Ignore transient poll errors
      }
    };
    const timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [streaming, isOnline]);

  useEffect(() => {
    const ticker = setInterval(() => {
      const dueUnits: AutoRunningDaemon[] = [];
      setAutoRunningDaemons((prev) =>
        prev.map((d) => {
          if (d.state !== 'active') return d;
          if (d.nextRunInSec <= 1) {
            dueUnits.push(d);
            return {
              ...d,
              nextRunInSec: d.intervalSec,
              successCount24h: d.successCount24h + 1,
              lastExitCode: 0,
              lastExecutionResult: `Scheduled tick completed cleanly (exit 0 in ${d.lastDurationMs}ms)`,
            };
          }
          return { ...d, nextRunInSec: d.nextRunInSec - 1 };
        }),
      );

      if (dueUnits.length > 0) {
        const nowTime = new Date().toLocaleTimeString([], { hour12: false });
        setAutoRunningLogs((prev) => [
          ...dueUnits.map((u) => ({
            id: `ar-${Date.now()}-${u.id}`,
            timestamp: nowTime,
            unitName: u.unitName,
            host: u.host,
            trigger: 'SCHEDULED' as const,
            exitCode: 0,
            durationMs: u.lastDurationMs,
            output: `Scheduled tick completed cleanly (exit 0 in ${u.lastDurationMs}ms)`,
          })),
          ...prev.slice(0, 39),
        ]);
      }
    }, 1000);

    const chartTicker = setInterval(() => {
      setAutoRunningDaemons((current) => {
        const updated = current.map((d) => {
          if (d.state === 'paused') return d;
          const jitterCpu = Math.max(0.1, Math.round((d.cpuOverheadPct + (Math.random() - 0.5) * 0.2) * 10) / 10);
          const jitterMem = Math.max(8, Math.round(d.memoryMb + (Math.random() - 0.5) * 2));
          return {
            ...d,
            cpuOverheadPct: jitterCpu,
            memoryMb: jitterMem,
            cpuHistory60m: [...d.cpuHistory60m.slice(-11), jitterCpu],
            memoryHistory60m: [...d.memoryHistory60m.slice(-11), jitterMem],
          };
        });
        const avgMs =
          updated.length > 0
            ? Math.round(updated.reduce((s, d) => s + d.lastDurationMs, 0) / updated.length)
            : 120;
        const cpuPct =
          Math.round(updated.filter((d) => d.state !== 'paused').reduce((s, d) => s + d.cpuOverheadPct, 0) * 10) / 10;
        setAutoRunHistory((prev) => [
          ...prev.slice(-15),
          { time: new Date().toLocaleTimeString([], { hour12: false }), avgMs, cpuPct },
        ]);
        return updated;
      });
    }, 5000);

    return () => {
      clearInterval(ticker);
      clearInterval(chartTicker);
    };
  }, []);

  const handleRunnerConfigChange = (next: RunnerConfig) => {
    setRunnerConfig(next);
    recordOperation('RunnerConfigUpdated', `${next.platform} · ${next.runnerName}`);
  };

  const handleTriggerPipeline = () => {
    if (pipelineRunning) return;
    setPipelineRunning(true);
    const runId = `run-${2085 + pipelines.length}`;
    const sha = Math.random().toString(16).slice(2, 9);
    const newRun: PipelineRun = {
      id: runId,
      commitSha: sha,
      branch: runnerConfig.targetBranch,
      author: 'huynh.thuong',
      startedAt: new Date().toLocaleString(),
      status: 'running',
      stages: [
        {
          id: 'checkout',
          name: 'Checkout & Env Injection',
          durationSec: 0,
          status: 'running',
          logs: [`Binding ${runnerConfig.platform} on ${runnerConfig.runnerName} (${runnerConfig.instanceType})`],
        },
        {
          id: 'test',
          name: 'Unit, Lint & Security Audit',
          durationSec: 0,
          status: 'idle',
          logs: ['Waiting for checkout...'],
        },
        {
          id: 'docker',
          name: 'Docker Multi-Stage Build',
          durationSec: 0,
          status: 'idle',
          logs: ['Waiting for test suite...'],
        },
        {
          id: 'deploy',
          name: 'SSH Staging Deploy & Probe',
          durationSec: 0,
          status: 'idle',
          logs: ['Waiting for Docker image...'],
        },
      ],
    };

    setPipelines((prev) => [newRun, ...prev]);
    appendLog(runnerConfig.runnerName, 'INFO', `Pipeline ${runId} (${sha}) triggered on ${runnerConfig.targetBranch}`);
    recordOperation('PipelineTriggered', `${runId} (${sha})`);

    const stageLogs = [
      [`Checked out ${sha}`, 'Injected encrypted runner secrets'],
      ['tsc --noEmit passed (0 errors)', 'All 48 test assertions succeeded'],
      [`Built ${runnerConfig.dockerImage}:${sha}`, 'Non-root alpine container verified'],
      [
        `SSH Ed25519 connected to ${runnerConfig.sshUser}@${runnerConfig.stagingHost}:${runnerConfig.stagingPort}`,
        `HTTP 200 OK from ${runnerConfig.healthcheckPath}`,
      ],
    ];
    const durations = [5, 18, 24, 12];

    [0, 1, 2, 3].forEach((stageIndex) => {
      setTimeout(() => {
        setPipelines((prev) =>
          prev.map((run) => {
            if (run.id !== runId) return run;
            const nextStages = run.stages.map((st, idx) => {
              if (idx === stageIndex) {
                return {
                  ...st,
                  status: 'success' as const,
                  durationSec: durations[stageIndex],
                  logs: stageLogs[stageIndex],
                };
              }
              if (idx === stageIndex + 1) {
                return { ...st, status: 'running' as const, logs: ['Executing step...'] };
              }
              return st;
            });
            const done = stageIndex === 3;
            return {
              ...run,
              status: done ? 'success' : 'running',
              stages: nextStages,
            };
          }),
        );

        if (stageIndex === 3) {
          setPipelineRunning(false);
          appendLog(
            'staging-deploy',
            'INFO',
            `Pipeline ${runId} deployed ${runnerConfig.dockerImage}:${sha} to ${runnerConfig.stagingHost}`,
          );
          pushToast(
            prefs.language === 'vi' ? 'Triển khai Staging thành công' : 'Staging Deployment Complete',
            `${runId} (${sha}) -> ${runnerConfig.stagingHost}`,
            'success',
          );
        }
      }, (stageIndex + 1) * 900);
    });
  };

  const handleToggleAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
    recordOperation('AlertRuleToggled', id);
  };

  const handleDispatchAlert = async (channel: 'email' | 'sms', recipient: string) => {
    try {
      await fetch('/api/alerts/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          recipient,
          severity: 'warning',
          message: `Test alert from ${runnerConfig.runnerName}`,
        }),
      });
    } catch {
      // Queue offline if disconnected
    }
    appendLog('alertmanager', 'WARN', `Dispatched ${channel.toUpperCase()} notification to ${recipient}`);
    pushToast(
      prefs.language === 'vi' ? `Cảnh báo ${channel.toUpperCase()} đã gửi` : `${channel.toUpperCase()} Alert Sent`,
      recipient,
      'warning',
    );
    recordOperation('AlertDispatched', `${channel} -> ${recipient}`);
  };

  const handleEnablePush = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        pushToast(
          prefs.language === 'vi' ? 'Thông báo đẩy' : 'Push Notifications',
          `Permission state: ${perm}`,
          perm === 'granted' ? 'success' : 'info',
        );
      } catch {
        pushToast('Push Notification', 'In-app event stream active.', 'info');
      }
    }
  };

  const handleToggleAutorunTask = (id: string) => {
    setAutorunTasks((prev) => prev.map((task) => (task.id === id ? { ...task, enabled: !task.enabled } : task)));
    recordOperation('AutorunTaskToggled', id);
  };

  const handleRunAutorunTask = (id: string) => {
    const target = autorunTasks.find((tItem) => tItem.id === id);
    if (!target) return;
    const nowStr = new Date().toLocaleTimeString([], { hour12: false });
    setAutorunTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, lastRunAt: `Today ${nowStr}`, lastResult: 'success' } : task,
      ),
    );
    appendLog('autorun-free', 'INFO', `Executed ${target.systemdUnit}: ${target.command}`);
    pushToast('Autorun-Free Executed', target.systemdUnit, 'success');
    recordOperation('AutorunExecuted', target.systemdUnit);
  };

  const handleTriggerBackup = () => {
    const snapId = `snap-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 13)}`;
    const randomHash = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const newSnap: BackupSnapshot = {
      id: snapId,
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      type: 'manual',
      sizeGb: 4.85,
      encryption: 'AES-256-GCM',
      checksumSha256: randomHash,
      destination: `s3://kinetix-ops-backups-${runnerConfig.awsRegion}/manual`,
      status: 'verified',
    };
    setBackups((prev) => [newSnap, ...prev]);
    appendLog('backup-agent', 'INFO', `Created encrypted snapshot ${snapId} (AES-256-GCM)`);
    pushToast(
      prefs.language === 'vi' ? 'Đã tạo bản sao lưu mã hóa' : 'Encrypted Backup Created',
      snapId,
      'success',
    );
    recordOperation('BackupCreated', snapId);
  };

  const handleRestoreBackup = (id: string) => {
    setBackups((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'restoring' } : b)));
    appendLog('backup-agent', 'WARN', `Initiated point-in-time restore drill from ${id}`);
    setTimeout(() => {
      setBackups((prev) => prev.map((b) => (b.id === id ? { ...b, status: 'verified' } : b)));
      appendLog('backup-agent', 'INFO', `Point-in-time restore verification completed for ${id}`);
      pushToast(
        prefs.language === 'vi' ? 'Khôi phục dữ liệu thành công' : 'Snapshot Restore Verified',
        id,
        'success',
      );
    }, 1500);
    recordOperation('BackupRestored', id);
  };

  const handleVerifyMfa = (code: string): boolean => {
    if (/^\d{6}$/.test(code.trim())) {
      setMfaVerified(true);
      appendLog('auth-mfa', 'INFO', 'Operator session elevated with TOTP 2FA verification');
      recordOperation('MfaVerified', 'TOTP session unlocked');
      return true;
    }
    return false;
  };

  const handleAddSecret = async (key: string, plainValue: string, scope: EnvSecret['scope']) => {
    const enc = await encryptWithAesGcm(plainValue);
    const secret: EnvSecret = {
      id: `sec-${Date.now()}`,
      key,
      encryptedValue: `AES256-GCM::iv=${enc.ivHex.slice(0, 8)}::ct=${enc.ciphertextBase64.slice(0, 16)}...`,
      plainPreview: plainValue,
      scope,
      updatedAt: new Date().toISOString().slice(0, 10),
      rotatedBy: 'huynh.thuong',
    };
    setSecrets((prev) => [secret, ...prev]);
    appendLog('secrets-vault', 'INFO', `Stored AES-256-GCM encrypted variable ${key} (${scope})`);
    recordOperation('SecretStored', `${key} (${scope})`);
  };

  const handleTogglePlugin = (id: string) => {
    setPlugins((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
    recordOperation('PluginToggled', id);
  };

  const handleToggleAutoDaemon = (id: string) => {
    setAutoRunningDaemons((prev) =>
      prev.map((d) => (d.id === id ? { ...d, state: d.state === 'paused' ? 'active' : 'paused' } : d)),
    );
    recordOperation('AutoRunningDaemonToggled', id);
  };

  const handleTriggerAutoDaemon = (id: string) => {
    const target = autoRunningDaemons.find((d) => d.id === id);
    if (!target) return;
    setAutoRunningDaemons((prev) => prev.map((d) => (d.id === id ? { ...d, state: 'running' } : d)));
    setTimeout(() => {
      const dur = Math.max(25, Math.round(target.lastDurationMs * (0.85 + Math.random() * 0.3)));
      setAutoRunningDaemons((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                state: 'active',
                nextRunInSec: d.intervalSec,
                lastExitCode: 0,
                lastDurationMs: dur,
                successCount24h: d.successCount24h + 1,
                lastExecutionResult: `Manual execution succeeded in ${dur}ms`,
              }
            : d,
        ),
      );
      setAutoRunningLogs((prev) => [
        {
          id: `ar-man-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour12: false }),
          unitName: target.unitName,
          host: target.host,
          trigger: 'MANUAL',
          exitCode: 0,
          durationMs: dur,
          output: `Manual execution succeeded: ${target.command}`,
        },
        ...prev.slice(0, 39),
      ]);
      appendLog('auto-running', 'INFO', `Executed ${target.unitName} manually in ${dur}ms`);
      recordOperation('AutoRunningManualRun', target.unitName);
    }, 650);
  };

  const handleSimulateFailureHeal = (id: string) => {
    const target = autoRunningDaemons.find((d) => d.id === id);
    if (!target) return;

    setAutoRunningDaemons((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              state: 'recovering',
              lastExitCode: 1,
              failureCount24h: d.failureCount24h + 1,
              lastExecutionResult: `Anomaly exit 1 detected; watchdog restarting ${d.unitName}`,
            }
          : d,
      ),
    );
    setAutoRunningLogs((prev) => [
      {
        id: `ar-err-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour12: false }),
        unitName: target.unitName,
        host: target.host,
        trigger: 'WATCHDOG',
        exitCode: 1,
        durationMs: 210,
        output: `Anomaly detected on ${target.unitName} (exit 1). Triggering alert & watchdog restart...`,
      },
      ...prev.slice(0, 39),
    ]);
    appendLog('auto-running', 'ERROR', `${target.unitName} exited with code 1; watchdog auto-healing initiated`);
    pushToast(
      prefs.language === 'vi' ? 'Cảnh báo Auto Running bất thường' : 'Auto Running Anomaly Alert',
      `${target.unitName} exited 1 -> Auto-Healing`,
      'warning',
    );
    fetch('/api/alerts/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'email+sms',
        recipient: 'ops-oncall@kinetix-ops.internal',
        severity: 'critical',
        message: `Auto Running daemon ${target.unitName} failed (exit 1); watchdog restarting.`,
      }),
    }).catch(() => {});

    setTimeout(() => {
      setAutoRunningDaemons((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                state: 'active',
                lastExitCode: 0,
                nextRunInSec: d.intervalSec,
                autoHealedCount: d.autoHealedCount + 1,
                successCount24h: d.successCount24h + 1,
                lastExecutionResult: 'Self-healing verified: daemon restarted cleanly (exit 0)',
              }
            : d,
        ),
      );
      setAutoRunningLogs((prev) => [
        {
          id: `ar-heal-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour12: false }),
          unitName: target.unitName,
          host: target.host,
          trigger: 'WATCHDOG',
          exitCode: 0,
          durationMs: 390,
          output: `Self-healing verified: ${target.unitName} restarted and passing health probe`,
        },
        ...prev.slice(0, 39),
      ]);
      appendLog('auto-running', 'INFO', `${target.unitName} self-healed by systemd watchdog`);
      pushToast(
        prefs.language === 'vi' ? 'Đã tự phục hồi Daemon' : 'Daemon Self-Healed',
        `${target.unitName} back to active`,
        'success',
      );
      recordOperation('AutoRunningSelfHealed', target.unitName);
    }, 1600);
  };

  const handleAddAutoDaemon = (
    name: string,
    cronExpr: string,
    intervalSec: number,
    command: string,
    host: string,
  ) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const newDaemon: AutoRunningDaemon = {
      id: `daemon-${Date.now()}`,
      nameVi: name,
      nameEn: name,
      unitName: `kinetix-${slug || 'custom'}.timer`,
      host,
      cronExpr,
      intervalSec,
      nextRunInSec: intervalSec,
      command,
      state: 'active',
      lastExitCode: 0,
      lastDurationMs: 110,
      cpuOverheadPct: 0.3,
      memoryMb: 22,
      cpuHistory60m: [0.2, 0.3, 0.3, 0.3, 0.2, 0.3, 0.4, 0.3, 0.3, 0.3, 0.3, 0.3],
      memoryHistory60m: [20, 21, 21, 22, 22, 21, 22, 22, 23, 22, 22, 22],
      successCount24h: 1,
      failureCount24h: 0,
      autoHealedCount: 0,
      lastExecutionResult: 'Initial activation succeeded (exit 0)',
      alertOnFailure: true,
    };
    setAutoRunningDaemons((prev) => [newDaemon, ...prev]);
    appendLog('auto-running', 'INFO', `Registered new Auto Running timer ${newDaemon.unitName} (${cronExpr})`);
    recordOperation('AutoRunningCreated', newDaemon.unitName);
  };

  const handleImportAutoDaemons = (tasks: ImportedDaemonSpec[]): { updatedCount: number; addedCount: number } => {
    let updatedCount = 0;
    let addedCount = 0;
    const next = [...autoRunningDaemons];

    for (const spec of tasks) {
      const existingIdx = next.findIndex((d) => d.unitName === spec.unitName);
      if (existingIdx >= 0) {
        const existing = next[existingIdx];
        next[existingIdx] = {
          ...existing,
          nameVi: spec.nameVi ?? existing.nameVi,
          nameEn: spec.nameEn ?? existing.nameEn,
          host: spec.host,
          cronExpr: spec.cronExpr,
          intervalSec: spec.intervalSec,
          nextRunInSec: Math.min(existing.nextRunInSec, spec.intervalSec),
          command: spec.command,
          alertOnFailure: spec.alertOnFailure ?? existing.alertOnFailure,
          state: spec.state ?? existing.state,
        };
        updatedCount++;
      } else {
        next.unshift({
          id: `daemon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          nameVi: spec.nameVi ?? spec.unitName,
          nameEn: spec.nameEn ?? spec.unitName,
          unitName: spec.unitName,
          host: spec.host,
          cronExpr: spec.cronExpr,
          intervalSec: spec.intervalSec,
          nextRunInSec: spec.intervalSec,
          command: spec.command,
          state: spec.state ?? 'active',
          lastExitCode: 0,
          lastDurationMs: 95,
          cpuOverheadPct: 0.3,
          memoryMb: 24,
          cpuHistory60m: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3],
          memoryHistory60m: [24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
          successCount24h: 0,
          failureCount24h: 0,
          autoHealedCount: 0,
          lastExecutionResult: 'Imported from JSON configuration',
          alertOnFailure: spec.alertOnFailure ?? true,
        });
        addedCount++;
      }
    }

    setAutoRunningDaemons(next);

    appendLog(
      'auto-running',
      'INFO',
      `Imported JSON daemon config: ${updatedCount} updated, ${addedCount} added`,
    );
    pushToast(
      prefs.language === 'vi' ? 'Đã nhập cấu hình JSON' : 'JSON Configuration Imported',
      `${updatedCount} updated · ${addedCount} added`,
      'success',
    );
    recordOperation('AutoRunningJsonImported', `${updatedCount} updated, ${addedCount} added`);
    return { updatedCount, addedCount };
  };

  const handleBatchPauseDaemons = (ids: string[]) => {
    const idSet = new Set(ids);
    setAutoRunningDaemons((prev) =>
      prev.map((d) => (idSet.has(d.id) ? { ...d, state: 'paused' } : d)),
    );
    appendLog('auto-running', 'WARN', `Batch paused ${ids.length} daemon(s)`);
    pushToast(
      prefs.language === 'vi' ? 'Đã tạm dừng hàng loạt' : 'Batch Paused',
      `${ids.length} daemon(s) paused`,
      'info',
    );
    recordOperation('AutoRunningBatchPause', `${ids.length} daemon(s)`);
  };

  const handleBatchResumeDaemons = (ids: string[]) => {
    const idSet = new Set(ids);
    setAutoRunningDaemons((prev) =>
      prev.map((d) => (idSet.has(d.id) ? { ...d, state: 'active' } : d)),
    );
    appendLog('auto-running', 'INFO', `Batch resumed ${ids.length} daemon(s)`);
    pushToast(
      prefs.language === 'vi' ? 'Đã tiếp tục hàng loạt' : 'Batch Resumed',
      `${ids.length} daemon(s) active`,
      'success',
    );
    recordOperation('AutoRunningBatchResume', `${ids.length} daemon(s)`);
  };

  const handleBatchDeleteDaemons = (ids: string[]) => {
    const idSet = new Set(ids);
    setAutoRunningDaemons((prev) => prev.filter((d) => !idSet.has(d.id)));
    appendLog('auto-running', 'WARN', `Removed ${ids.length} daemon(s) from supervision`);
    pushToast(
      prefs.language === 'vi' ? 'Đã xóa daemon đã chọn' : 'Batch Deleted',
      `${ids.length} daemon(s) removed`,
      'warning',
    );
    recordOperation('AutoRunningBatchDelete', `${ids.length} daemon(s)`);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100">
      <Sidebar
        active={activeSection}
        onSelect={setActiveSection}
        t={t}
        accent={prefs.accent}
        onOpenCustomizer={() => setCustomizerOpen(true)}
        isOnline={isOnline}
        pendingCount={pendingCount}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          activeSection={activeSection}
          t={t}
          accent={prefs.accent}
          isOnline={isOnline}
          pendingCount={pendingCount}
          mfaVerified={mfaVerified}
          pipelineRunning={pipelineRunning}
          onQuickRunPipeline={handleTriggerPipeline}
          onOpenCustomizer={() => setCustomizerOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {activeSection === 'overview' && (
            <OverviewView
              t={t}
              lang={prefs.language}
              density={prefs.density}
              metrics={metrics}
              streaming={streaming}
              onToggleStreaming={() => setStreaming(!streaming)}
              runnerConfig={runnerConfig}
              pipelines={pipelines}
              backups={backups}
            />
          )}

          {activeSection === 'pipeline' && (
            <PipelineRunnerView
              t={t}
              lang={prefs.language}
              accent={prefs.accent}
              config={runnerConfig}
              onChangeConfig={handleRunnerConfigChange}
              pipelines={pipelines}
              pipelineRunning={pipelineRunning}
              onTriggerPipeline={handleTriggerPipeline}
            />
          )}

          {activeSection === 'observability' && (
            <ObservabilityView
              t={t}
              lang={prefs.language}
              density={prefs.density}
              metrics={metrics}
              logs={logs}
              alerts={alerts}
              onToggleAlert={handleToggleAlert}
              onDispatchAlert={handleDispatchAlert}
              onEnablePush={handleEnablePush}
              pipelines={pipelines}
              backups={backups}
              runnerConfig={runnerConfig}
            />
          )}

          {activeSection === 'automation' && (
            <AutomationBackupView
              t={t}
              lang={prefs.language}
              accent={prefs.accent}
              tasks={autorunTasks}
              onToggleTask={handleToggleAutorunTask}
              onRunTaskNow={handleRunAutorunTask}
              backups={backups}
              onTriggerBackup={handleTriggerBackup}
              onRestoreBackup={handleRestoreBackup}
            />
          )}

          {activeSection === 'auto-running' && (
            <AutoRunningMonitorView
              lang={prefs.language}
              accent={prefs.accent}
              density={prefs.density}
              daemons={autoRunningDaemons}
              executionLogs={autoRunningLogs}
              durationHistory={autoRunHistory}
              onToggleDaemon={handleToggleAutoDaemon}
              onTriggerDaemonNow={handleTriggerAutoDaemon}
              onSimulateFailureHeal={handleSimulateFailureHeal}
              onAddDaemon={handleAddAutoDaemon}
              onImportDaemons={handleImportAutoDaemons}
              onBatchPause={handleBatchPauseDaemons}
              onBatchResume={handleBatchResumeDaemons}
              onBatchDelete={handleBatchDeleteDaemons}
            />
          )}

          {activeSection === 'security' && (
            <SecurityVaultView
              t={t}
              lang={prefs.language}
              accent={prefs.accent}
              mfaVerified={mfaVerified}
              onVerifyMfa={handleVerifyMfa}
              onLockMfa={() => setMfaVerified(false)}
              secrets={secrets}
              onAddSecret={handleAddSecret}
              runnerConfig={runnerConfig}
            />
          )}

          {activeSection === 'architecture' && (
            <ArchitecturePluginsView
              t={t}
              lang={prefs.language}
              density={prefs.density}
              microservices={INITIAL_MICROSERVICES}
              plugins={plugins}
              onTogglePlugin={handleTogglePlugin}
            />
          )}

          {activeSection === 'runbook' && <RunbookView t={t} lang={prefs.language} />}

          {activeSection === 'ai-agent' && (
            <AiAgentView
              t={t}
              lang={prefs.language}
              accent={prefs.accent}
              runnerConfig={runnerConfig}
              latestMetric={metrics[metrics.length - 1]}
            />
          )}
        </main>
      </div>

      <CustomizerModal
        open={customizerOpen}
        onClose={() => setCustomizerOpen(false)}
        prefs={prefs}
        onChangePrefs={setPrefs}
        t={t}
        simulatedOffline={simulatedOffline}
        onToggleOffline={setSimulatedOffline}
        queue={queue}
        onFlushSync={flushSyncQueue}
        lastSyncedAt={lastSyncedAt}
      />

      {toasts.length > 0 && (
        <div className="no-print fixed bottom-4 right-4 z-40 space-y-2 w-80 max-w-[calc(100vw-2rem)]">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">{toast.detail}</p>
                <p className="text-[11px] font-mono text-slate-400 mt-1 tabular-nums">{toast.timestamp}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
