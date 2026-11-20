import React from 'react';
import { Pause, Play } from 'lucide-react';
import { TimeSeriesChart } from '../components/Charts';
import { Translations } from '../i18n/translations';
import { BackupSnapshot, DensityMode, Language, MetricPoint, PipelineRun, RunnerConfig } from '../types/ops';

interface OverviewViewProps {
  t: Translations;
  lang: Language;
  density: DensityMode;
  metrics: MetricPoint[];
  streaming: boolean;
  onToggleStreaming: () => void;
  runnerConfig: RunnerConfig;
  pipelines: PipelineRun[];
  backups: BackupSnapshot[];
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  t,
  lang,
  density,
  metrics,
  streaming,
  onToggleStreaming,
  runnerConfig,
  pipelines,
  backups,
}) => {
  const latest = metrics[metrics.length - 1] ?? {
    time: '--:--:--',
    cpuPct: 0,
    memoryPct: 0,
    p95LatencyMs: 0,
    p99LatencyMs: 0,
    requestsPerSec: 0,
    errorRatePct: 0,
    networkInMbps: 0,
    networkOutMbps: 0,
    activeUsers: 0,
  };

  const labels = metrics.map((m) => m.time);
  const rowPad = density === 'compact' ? 'py-2.5' : 'py-3.5';

  const userCohorts = [
    {
      flow: lang === 'vi' ? 'Đăng nhập 2FA & Xác thực phiên' : '2FA Sign-In & Session Auth',
      sessions: latest.activeUsers,
      avgDuration: '1.2s',
      p95Ms: Math.round(latest.p95LatencyMs * 0.6),
      completionPct: '99.4%',
    },
    {
      flow: lang === 'vi' ? 'Truy vấn API Microservices Gateway' : 'Microservices API Gateway Calls',
      sessions: Math.round(latest.activeUsers * 0.88),
      avgDuration: '0.4s',
      p95Ms: latest.p95LatencyMs,
      completionPct: '99.8%',
    },
    {
      flow: lang === 'vi' ? 'Xuất báo cáo Prometheus / PDF / Excel' : 'Prometheus / PDF / Excel Exports',
      sessions: Math.round(latest.activeUsers * 0.24),
      avgDuration: '2.8s',
      p95Ms: Math.round(latest.p95LatencyMs * 1.9),
      completionPct: '98.7%',
    },
    {
      flow: lang === 'vi' ? 'Đồng bộ Offline & Đa thiết bị' : 'Offline & Multi-Device Sync',
      sessions: Math.round(latest.activeUsers * 0.62),
      avgDuration: '0.3s',
      p95Ms: Math.round(latest.p95LatencyMs * 0.45),
      completionPct: '100.0%',
    },
  ];

  const successRuns = pipelines.filter((p) => p.status === 'success').length;
  const deploySuccessRate = pipelines.length > 0 ? ((successRuns / pipelines.length) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.overview.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">{t.overview.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onToggleStreaming}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          {streaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{streaming ? t.overview.liveStream : t.overview.paused}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.overview.kpiRunner}</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1.5 tabular-nums">
            99.98%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
            {runnerConfig.runnerName} · {runnerConfig.instanceType}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.overview.kpiDeploy}</p>
          <p className="font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-400 mt-1.5 tabular-nums">
            {deploySuccessRate}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
            {pipelines.length} runs · {runnerConfig.stagingHost}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.overview.kpiLatency}</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1.5 tabular-nums">
            {latest.p95LatencyMs} ms
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            p99: {latest.p99LatencyMs} ms · Err: {latest.errorRatePct}%
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{t.overview.kpiUsers}</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1.5 tabular-nums">
            {latest.activeUsers.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {latest.requestsPerSec} req/s · CPU {latest.cpuPct}%
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.overview.telemetryTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.overview.telemetrySubtitle}</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TimeSeriesChart
            title={lang === 'vi' ? 'Mức sử dụng CPU & Bộ nhớ AWS Host (%)' : 'AWS Host CPU & Memory Utilization (%)'}
            labels={labels}
            maxY={100}
            series={[
              { label: 'CPU', color: '#2563eb', values: metrics.map((m) => m.cpuPct), unit: '%' },
              { label: 'RAM', color: '#16a34a', values: metrics.map((m) => m.memoryPct), unit: '%' },
            ]}
          />
          <TimeSeriesChart
            title={lang === 'vi' ? 'Độ trễ API p95 / p99 (ms)' : 'API Latency p95 / p99 (ms)'}
            labels={labels}
            series={[
              { label: 'p95', color: '#0284c7', values: metrics.map((m) => m.p95LatencyMs), unit: 'ms' },
              { label: 'p99', color: '#d97706', values: metrics.map((m) => m.p99LatencyMs), unit: 'ms' },
            ]}
          />
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.overview.userAnalyticsTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.overview.userAnalyticsSubtitle}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="px-5 py-3 font-medium">{lang === 'vi' ? 'Luồng nghiệp vụ' : 'Workflow'}</th>
                  <th className="px-4 py-3 font-medium text-right">{lang === 'vi' ? 'Phiên' : 'Sessions'}</th>
                  <th className="px-4 py-3 font-medium text-right">{lang === 'vi' ? 'Trung bình' : 'Avg Time'}</th>
                  <th className="px-4 py-3 font-medium text-right">p95</th>
                  <th className="px-5 py-3 font-medium text-right">{lang === 'vi' ? 'Hoàn tất' : 'Success'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {userCohorts.map((row) => (
                  <tr key={row.flow} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className={`px-5 ${rowPad} font-medium text-slate-900 dark:text-slate-100`}>{row.flow}</td>
                    <td className={`px-4 ${rowPad} text-right font-mono tabular-nums text-slate-700 dark:text-slate-300`}>
                      {row.sessions.toLocaleString()}
                    </td>
                    <td className={`px-4 ${rowPad} text-right font-mono tabular-nums text-slate-600 dark:text-slate-400`}>
                      {row.avgDuration}
                    </td>
                    <td className={`px-4 ${rowPad} text-right font-mono tabular-nums text-slate-600 dark:text-slate-400`}>
                      {row.p95Ms} ms
                    </td>
                    <td className={`px-5 ${rowPad} text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400`}>
                      {row.completionPct}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.overview.recentActivityTitle}
            </h2>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {pipelines.slice(0, 3).map((run) => (
              <div key={run.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    Pipeline {run.id} · {run.branch}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 font-mono mt-0.5 tabular-nums">
                    {run.commitSha} · {run.startedAt}
                  </p>
                </div>
                <span
                  className={`font-medium whitespace-nowrap shrink-0 ${
                    run.status === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : run.status === 'running'
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {run.status === 'success' ? 'Success' : run.status === 'running' ? 'Running' : 'Failed'}
                </span>
              </div>
            ))}
            {backups.slice(0, 2).map((b) => (
              <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{b.id}</p>
                  <p className="text-slate-500 dark:text-slate-400 font-mono mt-0.5 tabular-nums">
                    {b.sizeGb} GB · {b.encryption}
                  </p>
                </div>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium whitespace-nowrap shrink-0">
                  Verified
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
