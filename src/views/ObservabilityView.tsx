import React, { useMemo, useState } from 'react';
import { Bell, Download, FileSpreadsheet, Mail, MessageSquare, Printer, Search } from 'lucide-react';
import { TimeSeriesChart } from '../components/Charts';
import { Translations } from '../i18n/translations';
import {
  AlertRule,
  BackupSnapshot,
  DensityMode,
  Language,
  LogSeverity,
  MetricPoint,
  PipelineRun,
  RunnerConfig,
  SystemLogEntry,
} from '../types/ops';
import { generatePrometheusConfig } from '../utils/configGenerators';
import { exportMetricsCsv, exportPeriodicExcelReport } from '../utils/exporters';

interface ObservabilityViewProps {
  t: Translations;
  lang: Language;
  density: DensityMode;
  metrics: MetricPoint[];
  logs: SystemLogEntry[];
  alerts: AlertRule[];
  onToggleAlert: (id: string) => void;
  onDispatchAlert: (channel: 'email' | 'sms', recipient: string) => Promise<void>;
  onEnablePush: () => Promise<void>;
  pipelines: PipelineRun[];
  backups: BackupSnapshot[];
  runnerConfig: RunnerConfig;
}

export const ObservabilityView: React.FC<ObservabilityViewProps> = ({
  t,
  lang,
  density,
  metrics,
  logs,
  alerts,
  onToggleAlert,
  onDispatchAlert,
  onEnablePush,
  pipelines,
  backups,
  runnerConfig,
}) => {
  const [windowRange, setWindowRange] = useState<'15m' | '1h' | '6h' | '24h'>('1h');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | LogSeverity>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [alertRecipient, setAlertRecipient] = useState('ops-oncall@kinetix-ops.internal');
  const [smsRecipient, setSmsRecipient] = useState('+84901234567');
  const [dispatchFeedback, setDispatchFeedback] = useState<string | null>(null);
  const [showPromConfig, setShowPromConfig] = useState(false);

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      if (severityFilter !== 'ALL' && entry.severity !== severityFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          entry.message.toLowerCase().includes(q) ||
          entry.service.toLowerCase().includes(q) ||
          entry.traceId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, severityFilter, searchTerm]);

  const labels = metrics.map((m) => m.time);
  const rowPad = density === 'compact' ? 'py-2' : 'py-3';

  const handleAlertTest = async (channel: 'email' | 'sms') => {
    const target = channel === 'email' ? alertRecipient : smsRecipient;
    await onDispatchAlert(channel, target);
    setDispatchFeedback(
      lang === 'vi'
        ? `Đã gửi cảnh báo ${channel.toUpperCase()} tới ${target}`
        : `Dispatched ${channel.toUpperCase()} test alert to ${target}`,
    );
    setTimeout(() => setDispatchFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.observability.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">{t.observability.subtitle}</p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            {(['15m', '1h', '6h', '24h'] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindowRange(w)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors ${
                  windowRange === w
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => exportPeriodicExcelReport(metrics, pipelines, backups, logs)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t.observability.exportExcel}</span>
          </button>

          <button
            type="button"
            onClick={() => exportMetricsCsv(metrics)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.observability.exportCsv}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t.observability.exportPdf}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TimeSeriesChart
          title={`Prometheus Throughput & Error Rate (${windowRange})`}
          labels={labels}
          series={[
            { label: 'Req/s', color: '#2563eb', values: metrics.map((m) => m.requestsPerSec) },
            { label: 'Err % x100', color: '#dc2626', values: metrics.map((m) => Math.round(m.errorRatePct * 100)) },
          ]}
        />
        <TimeSeriesChart
          title={`Grafana Network I/O Mbps (${windowRange})`}
          labels={labels}
          series={[
            { label: 'Net In', color: '#16a34a', values: metrics.map((m) => m.networkInMbps), unit: ' Mbps' },
            { label: 'Net Out', color: '#7c3aed', values: metrics.map((m) => m.networkOutMbps), unit: ' Mbps' },
          ]}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-slate-100">{t.observability.prometheusEndpoint}:</span>{' '}
          <span className="font-mono">http://{runnerConfig.stagingHost}:{runnerConfig.appPort}/metrics</span>
        </div>
        <button
          type="button"
          onClick={() => setShowPromConfig(!showPromConfig)}
          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
        >
          {showPromConfig
            ? lang === 'vi'
              ? 'Ẩn cấu hình prometheus.yml'
              : 'Hide prometheus.yml'
            : lang === 'vi'
              ? 'Xem cấu hình prometheus.yml'
              : 'Inspect prometheus.yml'}
        </button>
        {showPromConfig && (
          <pre className="w-full mt-2 p-4 bg-slate-950 text-slate-200 rounded-lg font-mono text-xs overflow-x-auto">
            <code>{generatePrometheusConfig(runnerConfig)}</code>
          </pre>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.observability.logsTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.observability.searchLogs}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-56"
                />
              </div>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as 'ALL' | LogSeverity)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="ALL">ALL</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Time</th>
                  <th className="px-3 py-2.5 font-medium">Level</th>
                  <th className="px-3 py-2.5 font-medium">Service</th>
                  <th className="px-4 py-2.5 font-medium">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 font-sans">
                      {lang === 'vi' ? 'Không tìm thấy bản ghi log phù hợp.' : 'No matching log entries found.'}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className={`px-4 ${rowPad} tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap`}>
                        {log.timestamp}
                      </td>
                      <td
                        className={`px-3 ${rowPad} font-semibold whitespace-nowrap ${
                          log.severity === 'ERROR' || log.severity === 'CRITICAL'
                            ? 'text-red-700 dark:text-red-400'
                            : log.severity === 'WARN'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {log.severity}
                      </td>
                      <td className={`px-3 ${rowPad} text-slate-700 dark:text-slate-300 whitespace-nowrap`}>
                        {log.service}
                      </td>
                      <td className={`px-4 ${rowPad} font-sans text-slate-800 dark:text-slate-200`}>
                        {log.message}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.observability.alertsTitle}
            </h2>
            <button
              type="button"
              onClick={onEnablePush}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{t.observability.enableBrowserPush}</span>
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
            {alerts.map((rule) => (
              <div key={rule.id} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{rule.name}</p>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {rule.metric}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {rule.threshold} · {rule.channels.join(' / ').toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.enabled}
                  onClick={() => onToggleAlert(rule.id)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                    rule.enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      rule.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="email"
                value={alertRecipient}
                onChange={(e) => setAlertRecipient(e.target.value)}
                aria-label="Alert Email"
                className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => handleAlertTest('email')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{t.observability.testEmailAlert}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="tel"
                value={smsRecipient}
                onChange={(e) => setSmsRecipient(e.target.value)}
                aria-label="Alert SMS Phone"
                className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => handleAlertTest('sms')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{t.observability.testSmsAlert}</span>
              </button>
            </div>

            {dispatchFeedback && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{dispatchFeedback}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
