import React, { useCallback, useEffect, useState } from 'react';
import {
  Ban,
  Download,
  KeyRound,
  Play,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import {
  AccentTheme,
  AutorunEventRecord,
  ControlPlaneStatus,
  DensityMode,
  JobRunRecord,
  JobStatus,
  Language,
} from '../types/ops';
import { downloadTextFile } from '../utils/exporters';

interface JobQueueEngineViewProps {
  lang: Language;
  accent: AccentTheme;
  density: DensityMode;
  controlToken: string;
  onChangeControlToken: (token: string) => void;
}

const BTN_MAP: Record<AccentTheme, string> = {
  cobalt: 'bg-blue-600 hover:bg-blue-700 text-white',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
};

export const JobQueueEngineView: React.FC<JobQueueEngineViewProps> = ({
  lang,
  accent,
  density,
  controlToken,
  onChangeControlToken,
}) => {
  const [statusData, setStatusData] = useState<ControlPlaneStatus | null>(null);
  const [runs, setRuns] = useState<JobRunRecord[]>([]);
  const [d1RunsNote, setD1RunsNote] = useState<string | null>(null);
  const [events, setEvents] = useState<AutorunEventRecord[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [repo, setRepo] = useState('zskbot/OCodeJS-Auth');
  const [branch, setBranch] = useState('feat/auth-ci-check');
  const [prNumber, setPrNumber] = useState('17');
  const [commitSha, setCommitSha] = useState('pr17-head');
  const [selectedSteps, setSelectedSteps] = useState<string[]>(['typecheck', 'lint']);

  const [statusFilter, setStatusFilter] = useState<'all' | JobStatus>('all');
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [dispatching, setDispatching] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, runsRes, eventsRes] = await Promise.all([
        fetch('/api/control/status'),
        fetch('/api/runs'),
        fetch('/api/events'),
      ]);

      if (statusRes.ok) {
        const s = (await statusRes.json()) as ControlPlaneStatus;
        setStatusData(s);
      }

      if (runsRes.ok) {
        const r = (await runsRes.json()) as {
          runs: JobRunRecord[];
          d1: { synced: boolean; error?: string };
        };
        setRuns(r.runs || []);
        setD1RunsNote(r.d1.synced ? null : r.d1.error || 'D1 bridge unavailable.');
      }

      const evData = (await eventsRes.json()) as { events?: AutorunEventRecord[]; error?: string };
      if (eventsRes.ok) {
        setEvents(evData.events ?? []);
        setEventsError(null);
      } else {
        setEvents([]);
        setEventsError(evData.error || `HTTP ${eventsRes.status}`);
      }
    } catch (err: unknown) {
      setActionMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to poll control server.',
      });
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    const timer = setInterval(() => {
      void fetchAll();
    }, 2500);
    return () => clearInterval(timer);
  }, [fetchAll]);

  const toggleStep = (id: string) => {
    setSelectedSteps((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const applyPreset = (preset: 'ocodejs-pr17' | 'local-check') => {
    if (preset === 'ocodejs-pr17') {
      setRepo('zskbot/OCodeJS-Auth');
      setBranch('pr-17');
      setPrNumber('17');
      setCommitSha('pr17-staging');
      setSelectedSteps(['npm_ci', 'unit_tests', 'prisma_validate', 'typecheck', 'nextjs_build']);
    } else {
      setRepo('zskbot/Autorun');
      setBranch('main');
      setPrNumber('');
      setCommitSha('workspace-head');
      setSelectedSteps(['typecheck', 'lint', 'vite_build']);
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);
    if (selectedSteps.length === 0) {
      setActionMessage({
        type: 'err',
        text: lang === 'vi' ? 'Chọn ít nhất 1 bước CI trong allowlist.' : 'Select at least one allowlisted CI step.',
      });
      return;
    }

    setDispatching(true);
    try {
      const res = await fetch('/api/runs/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(controlToken.trim() ? { Authorization: `Bearer ${controlToken.trim()}` } : {}),
        },
        body: JSON.stringify({
          repo,
          branch,
          prNumber: prNumber.trim() ? Number(prNumber.trim()) : null,
          commitSha,
          stepIds: selectedSteps,
        }),
      });
      const data = (await res.json()) as { error?: string; run?: JobRunRecord };
      if (!res.ok) {
        setActionMessage({ type: 'err', text: data.error || `HTTP ${res.status}` });
      } else if (data.run) {
        setSelectedRunId(data.run.id);
        setActionMessage({
          type: 'ok',
          text:
            lang === 'vi'
              ? `Đã đưa job ${data.run.id} vào hàng đợi thực thi.`
              : `Enqueued job ${data.run.id} for Local Execution Agent.`,
        });
        void fetchAll();
      }
    } catch (err: unknown) {
      setActionMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to dispatch job.',
      });
    } finally {
      setDispatching(false);
    }
  };

  const handleCancel = async (runId: string) => {
    setActionMessage(null);
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/cancel`, {
        method: 'POST',
        headers: {
          ...(controlToken.trim() ? { Authorization: `Bearer ${controlToken.trim()}` } : {}),
        },
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionMessage({ type: 'err', text: data.error || `HTTP ${res.status}` });
      } else {
        setActionMessage({
          type: 'ok',
          text: lang === 'vi' ? `Đã gửi lệnh hủy job ${runId}.` : `Cancellation requested for ${runId}.`,
        });
        void fetchAll();
      }
    } catch (err: unknown) {
      setActionMessage({ type: 'err', text: err instanceof Error ? err.message : 'Cancel request failed.' });
    }
  };

  const visibleRuns =
    statusFilter === 'all' ? runs : runs.filter((r) => r.status === statusFilter);
  const inspectedRun = runs.find((r) => r.id === selectedRunId) ?? visibleRuns[0] ?? runs[0];
  const rowPad = density === 'compact' ? 'py-2.5' : 'py-3.5';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {lang === 'vi'
              ? 'OCodeJS AutoRun Control Center & Execution Engine'
              : 'OCodeJS AutoRun Control Center & Execution Engine'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            {lang === 'vi'
              ? 'Hàng đợi công việc, Local Workspace Execution Agent có giới hạn timeout, cầu nối Remote D1 staging và webhook GitHub HMAC-SHA256.'
              : 'Job queue, timeout-bounded Local Workspace Execution Agent, Remote D1 staging persistence bridge, and HMAC-verified GitHub webhook integration.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchAll()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{lang === 'vi' ? 'Làm mới trạng thái' : 'Refresh State'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {lang === 'vi' ? 'Cầu nối D1 Staging' : 'Remote D1 Bridge'}
          </p>
          <p
            className={`font-mono text-lg font-semibold mt-1.5 ${
              statusData?.d1.reachable
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {statusData?.d1.reachable
              ? 'Connected'
              : statusData?.d1.configured
                ? 'Unreachable'
                : 'Not Configured'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
            {statusData?.d1.databaseId || 'ocodejs-autorun-staging'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {lang === 'vi' ? 'Local Runner Agent' : 'Execution Agent Heartbeat'}
          </p>
          <p className="font-mono text-lg font-semibold text-emerald-700 dark:text-emerald-400 mt-1.5">
            {statusData?.runner.status === 'busy' ? 'Busy (Running)' : 'Online'}
          </p>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 truncate tabular-nums">
            load {statusData?.runner.loadAvg1m ?? 0} · {statusData?.runner.freeMemMb ?? 0} MB free
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {lang === 'vi' ? 'Xác thực Control API' : 'Bearer Auth Guard'}
          </p>
          <p
            className={`font-mono text-lg font-semibold mt-1.5 ${
              statusData?.authConfigured
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {statusData?.authConfigured ? 'Enforced' : 'Token Unset'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            AUTORUN_CONTROL_TOKEN
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {lang === 'vi' ? 'GitHub Webhook HMAC' : 'GitHub Webhook HMAC'}
          </p>
          <p
            className={`font-mono text-lg font-semibold mt-1.5 ${
              statusData?.githubWebhookConfigured
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {statusData?.githubWebhookConfigured ? 'SHA-256 Active' : 'Secret Unset'}
          </p>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1 truncate">
            POST /api/github/webhook
          </p>
        </div>
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <KeyRound className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'vi'
                ? 'Phiên xác thực Bearer cho lệnh điều khiển Runner & Cảnh báo'
                : 'Operator Bearer Token Session (Protects Dispatch, Cancel & Alert Endpoints)'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {statusData?.d1.lastError ||
                (lang === 'vi'
                  ? 'Khớp với biến môi trường AUTORUN_CONTROL_TOKEN trên máy chủ.'
                  : 'Must match server-side AUTORUN_CONTROL_TOKEN environment variable.')}
            </p>
          </div>
        </div>
        <input
          type="password"
          value={controlToken}
          onChange={(e) => onChangeControlToken(e.target.value)}
          placeholder="Bearer token..."
          aria-label="Operator Control Bearer Token"
          className="w-full sm:w-72 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
        />
      </section>

      {actionMessage && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            actionMessage.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button type="button" onClick={() => setActionMessage(null)} className="underline font-medium shrink-0">
            {lang === 'vi' ? 'Đóng' : 'Dismiss'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'vi' ? 'Gửi Job tới Execution Agent' : 'Dispatch CI Job to Execution Agent'}
            </h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('local-check')}
                className="px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Workspace Check
              </button>
              <button
                type="button"
                onClick={() => applyPreset('ocodejs-pr17')}
                className="px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                OCodeJS PR #17
              </button>
            </div>
          </div>

          <form onSubmit={handleDispatch} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Repository
                </label>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">PR #</label>
                <input
                  type="number"
                  value={prNumber}
                  onChange={(e) => setPrNumber(e.target.value)}
                  placeholder="17"
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Commit SHA</label>
                <input
                  type="text"
                  value={commitSha}
                  onChange={(e) => setCommitSha(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                {lang === 'vi' ? 'Các bước CI được phép (Allowlist, shell: false)' : 'Allowlisted CI Steps (shell: false)'}
              </p>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800 max-h-56 overflow-y-auto">
                {(statusData?.allowlist ?? []).map((rule) => (
                  <label
                    key={rule.id}
                    className="px-3 py-2 flex items-start justify-between gap-3 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedSteps.includes(rule.id)}
                        onChange={() => toggleStep(rule.id)}
                        className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{rule.label}</p>
                        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {rule.command}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                      {Math.round(rule.timeoutMs / 1000)}s
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={dispatching}
              className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg disabled:opacity-60 ${BTN_MAP[accent]}`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Đưa Job vào hàng đợi thực thi' : 'Enqueue Job Run'}</span>
            </button>
          </form>
        </section>

        <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                {lang === 'vi' ? 'Hàng đợi & Lịch sử Job (autorun_runs)' : 'Job Queue & Execution History (autorun_runs)'}
              </h2>
              {d1RunsNote && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">{d1RunsNote}</p>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | JobStatus)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Run ID</th>
                  <th className="px-3 py-2.5 font-medium">Repo / PR</th>
                  <th className="px-3 py-2.5 font-medium">Commit</th>
                  <th className="px-3 py-2.5 font-medium">D1 Sync</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                {visibleRuns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center font-sans text-slate-500 dark:text-slate-400">
                      {lang === 'vi'
                        ? 'Chưa có job nào trong hàng đợi thực thi.'
                        : 'No jobs have been dispatched to the execution queue yet.'}
                    </td>
                  </tr>
                ) : (
                  visibleRuns.map((run) => (
                    <tr
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      className={`cursor-pointer ${
                        inspectedRun?.id === run.id
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className={`px-4 ${rowPad} text-slate-900 dark:text-slate-100 whitespace-nowrap`}>
                        {run.id}
                      </td>
                      <td className={`px-3 ${rowPad} font-sans text-slate-700 dark:text-slate-300 whitespace-nowrap`}>
                        {run.repo}
                        {run.prNumber ? ` #${run.prNumber}` : ''}
                      </td>
                      <td className={`px-3 ${rowPad} text-slate-500 dark:text-slate-400 whitespace-nowrap`}>
                        {run.commitSha}
                      </td>
                      <td
                        className={`px-3 ${rowPad} whitespace-nowrap ${
                          run.d1SyncStatus === 'synced'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {run.d1SyncStatus}
                      </td>
                      <td
                        className={`px-3 ${rowPad} font-sans font-semibold whitespace-nowrap ${
                          run.status === 'succeeded'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : run.status === 'failed'
                              ? 'text-red-700 dark:text-red-400'
                              : run.status === 'running'
                                ? 'text-blue-700 dark:text-blue-400'
                                : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {run.status}
                      </td>
                      <td className={`px-4 ${rowPad} text-right whitespace-nowrap`} onClick={(e) => e.stopPropagation()}>
                        {(run.status === 'queued' || run.status === 'running') && (
                          <button
                            type="button"
                            onClick={() => void handleCancel(run.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-sans font-medium rounded border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            <Ban className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-500" />
              <span>{lang === 'vi' ? 'Log từng bước & Artifact đầu ra' : 'Step Logs (stdout/stderr) & Artifacts'}</span>
            </h2>
            {inspectedRun?.artifacts.map((art) => (
              <button
                key={art.name}
                type="button"
                onClick={() => downloadTextFile(art.name, art.content, art.mimeType)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{art.name}</span>
              </button>
            ))}
          </div>

          {!inspectedRun ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
              {lang === 'vi'
                ? 'Chọn một job trong bảng phía trên hoặc khởi chạy job mới để xem stdout/stderr thực tế.'
                : 'Select a run above or dispatch a new job to inspect live stdout/stderr and exit codes.'}
            </p>
          ) : (
            <div className="space-y-3">
              {inspectedRun.steps.map((step) => (
                <div
                  key={step.stepId}
                  className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
                >
                  <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{step.label}</span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {step.status}
                      {step.exitCode !== null ? ` · exit ${step.exitCode}` : ''}
                      {step.durationMs > 0 ? ` · ${step.durationMs}ms` : ''}
                    </span>
                  </div>
                  {(step.stdout || step.stderr) && (
                    <pre className="p-3 bg-slate-950 text-slate-200 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-48">
                      <code>
                        {step.stdout}
                        {step.stderr ? `\n[stderr]\n${step.stderr}` : ''}
                      </code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'vi' ? 'Nhật ký D1 autorun_events' : 'D1 autorun_events Audit Stream'}
            </h2>
          </div>
          <div className="p-4">
            {eventsError ? (
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">{eventsError}</p>
            ) : events.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">No events recorded in D1 yet.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-80 overflow-y-auto font-mono text-xs">
                {events.map((ev) => (
                  <div key={ev.id} className="py-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{ev.type}</span>
                      <span className="tabular-nums">{ev.timestamp}</span>
                    </div>
                    <p className="font-sans text-xs text-slate-800 dark:text-slate-200 mt-0.5">{ev.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
