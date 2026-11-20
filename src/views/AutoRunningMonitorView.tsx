import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  FileJson,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Terminal,
  Trash2,
  Upload,
} from 'lucide-react';
import { MiniSparkline, TimeSeriesChart } from '../components/Charts';
import {
  AccentTheme,
  AutoRunningDaemon,
  AutoRunningExecutionLog,
  DaemonRunState,
  DensityMode,
  ImportedDaemonSpec,
  Language,
} from '../types/ops';
import {
  exportAutoRunningCsv,
  exportAutoRunningJsonConfig,
  parseAndValidateDaemonConfigJson,
} from '../utils/exporters';

interface AutoRunningMonitorViewProps {
  lang: Language;
  accent: AccentTheme;
  density: DensityMode;
  daemons: AutoRunningDaemon[];
  executionLogs: AutoRunningExecutionLog[];
  durationHistory: Array<{ time: string; avgMs: number; cpuPct: number }>;
  onToggleDaemon: (id: string) => void;
  onTriggerDaemonNow: (id: string) => void;
  onSimulateFailureHeal: (id: string) => void;
  onAddDaemon: (name: string, cronExpr: string, intervalSec: number, command: string, host: string) => void;
  onImportDaemons: (tasks: ImportedDaemonSpec[]) => { updatedCount: number; addedCount: number };
  onBatchPause: (ids: string[]) => void;
  onBatchResume: (ids: string[]) => void;
  onBatchDelete: (ids: string[]) => void;
}

const BTN_MAP: Record<AccentTheme, string> = {
  cobalt: 'bg-blue-600 hover:bg-blue-700 text-white',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
};

function formatCountdown(sec: number): string {
  if (sec <= 0) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const AutoRunningMonitorView: React.FC<AutoRunningMonitorViewProps> = ({
  lang,
  accent,
  density,
  daemons,
  executionLogs,
  durationHistory,
  onToggleDaemon,
  onTriggerDaemonNow,
  onSimulateFailureHeal,
  onAddDaemon,
  onImportDaemons,
  onBatchPause,
  onBatchResume,
  onBatchDelete,
}) => {
  const [selectedId, setSelectedId] = useState<string>(daemons[0]?.id ?? '');
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [hostFilter, setHostFilter] = useState<'ALL' | string>('ALL');
  const [stateFilter, setStateFilter] = useState<'ALL' | DaemonRunState>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newName, setNewName] = useState('');
  const [newCron, setNewCron] = useState('*/2 * * * *');
  const [newInterval, setNewInterval] = useState(120);
  const [newHost, setNewHost] = useState('aws-ap1-runner-01');
  const [newCommand, setNewCommand] = useState('/opt/ops/health-sync.sh --quiet');

  const activeCount = daemons.filter((d) => d.state !== 'paused').length;
  const totalRuns24h = daemons.reduce((acc, d) => acc + d.successCount24h, 0);
  const totalHealed = daemons.reduce((acc, d) => acc + d.autoHealedCount, 0);
  const avgDuration =
    daemons.length > 0
      ? Math.round(daemons.reduce((acc, d) => acc + d.lastDurationMs, 0) / daemons.length)
      : 0;

  const hosts = Array.from(new Set(daemons.map((d) => d.host)));
  const visibleDaemons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return daemons.filter((d) => {
      if (hostFilter !== 'ALL' && d.host !== hostFilter) return false;
      if (stateFilter !== 'ALL' && d.state !== stateFilter) return false;
      if (q) {
        const hay = `${d.nameVi} ${d.nameEn} ${d.unitName} ${d.host} ${d.command}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [daemons, hostFilter, stateFilter, searchQuery]);

  const selectedDaemon = daemons.find((d) => d.id === selectedId) ?? visibleDaemons[0] ?? daemons[0];
  const rowPad = density === 'compact' ? 'py-2.5' : 'py-3.5';

  const visibleIds = useMemo(() => visibleDaemons.map((d) => d.id), [visibleDaemons]);
  const validCheckedIds = useMemo(
    () => checkedIds.filter((id) => daemons.some((d) => d.id === id)),
    [checkedIds, daemons],
  );
  const allVisibleChecked =
    visibleIds.length > 0 && visibleIds.every((id) => validCheckedIds.includes(id));

  const toggleSelectAll = () => {
    if (allVisibleChecked) {
      setCheckedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setCheckedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleRowCheck = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCommand.trim()) return;
    onAddDaemon(newName.trim(), newCron.trim() || '* * * * *', Math.max(15, newInterval), newCommand.trim(), newHost);
    setNewName('');
    setShowAddForm(false);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseAndValidateDaemonConfigJson(text);
      if (!parsed.ok) {
        setImportFeedback({ type: 'err', text: parsed.error });
        return;
      }
      const { updatedCount, addedCount } = onImportDaemons(parsed.tasks);
      setImportFeedback({
        type: 'ok',
        text:
          lang === 'vi'
            ? `Đã nhập ${file.name}: cập nhật ${updatedCount} unit, thêm mới ${addedCount} unit.`
            : `Imported ${file.name}: merged ${updatedCount} unit(s), added ${addedCount} new unit(s).`,
      });
    } catch {
      setImportFeedback({
        type: 'err',
        text: lang === 'vi' ? 'Không thể đọc tệp cấu hình JSON.' : 'Failed to read JSON configuration file.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {lang === 'vi' ? 'Theo dõi & Giám sát Auto Running' : 'Auto Running Real-Time Monitor'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
            {lang === 'vi'
              ? 'Giám sát trực tiếp từng daemon systemd timer, cron job và watchdog tự phục hồi trên AWS Runner & Staging theo thời gian thực.'
              : 'Live supervision of every systemd timer, cron daemon, and self-healing watchdog across your AWS Runner and Staging nodes.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => exportAutoRunningJsonConfig(daemons)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <FileJson className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Xuất JSON' : 'Export JSON'}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Nhập JSON' : 'Import JSON'}</span>
          </button>

          <button
            type="button"
            onClick={() => exportAutoRunningCsv(daemons)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Tải báo cáo CSV' : 'Download Report'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 ${BTN_MAP[accent]}`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{lang === 'vi' ? 'Thêm tác vụ Auto Running' : 'Add Auto Running Job'}</span>
          </button>
        </div>
      </div>

      {importFeedback && (
        <div
          className={`px-4 py-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            importFeedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
          }`}
        >
          <span>{importFeedback.text}</span>
          <button
            type="button"
            onClick={() => setImportFeedback(null)}
            className="font-medium underline shrink-0"
          >
            {lang === 'vi' ? 'Đóng' : 'Dismiss'}
          </button>
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={lang === 'vi' ? 'Tên tác vụ (vd: Đồng bộ Redis)' : 'Job name'}
            className="lg:col-span-2 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            required
          />
          <input
            type="text"
            value={newCron}
            onChange={(e) => setNewCron(e.target.value)}
            placeholder="*/5 * * * *"
            className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
          <input
            type="number"
            min={15}
            value={newInterval}
            onChange={(e) => setNewInterval(Number(e.target.value) || 60)}
            placeholder="Interval (s)"
            className="px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          />
          <select
            value={newHost}
            onChange={(e) => setNewHost(e.target.value)}
            className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
          >
            <option value="aws-ap1-runner-01">aws-ap1-runner-01</option>
            <option value="staging.kinetix-ops.internal">staging.kinetix-ops.internal</option>
          </select>
          <button
            type="submit"
            className={`px-4 py-2 text-xs font-medium rounded-lg whitespace-nowrap ${BTN_MAP[accent]}`}
          >
            {lang === 'vi' ? 'Lưu & Kích hoạt' : 'Save & Activate'}
          </button>
          <input
            type="text"
            value={newCommand}
            onChange={(e) => setNewCommand(e.target.value)}
            placeholder="/opt/ops/script.sh"
            className="sm:col-span-2 lg:col-span-6 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            required
          />
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {lang === 'vi' ? 'Daemon đang hoạt động' : 'Active Auto-Run Daemons'}
          </p>
          <p className="font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-400 mt-1.5 tabular-nums">
            {activeCount} / {daemons.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'vi' ? 'systemd timers & bash watchdogs' : 'systemd timers & bash watchdogs'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {lang === 'vi' ? 'Lượt chạy thành công (24h)' : 'Successful Runs (24h)'}
          </p>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1.5 tabular-nums">
            {totalRuns24h.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'vi' ? 'Không cần can thiệp thủ công' : 'Zero manual intervention'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {lang === 'vi' ? 'Thời gian thực thi TB' : 'Avg Execution Duration'}
          </p>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1.5 tabular-nums">
            {avgDuration} ms
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'vi' ? 'Chi phí CPU phụ tải < 1.2%' : 'Daemon CPU overhead < 1.2%'}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {lang === 'vi' ? 'Sự cố tự phục hồi' : 'Self-Healed Incidents'}
          </p>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1.5 tabular-nums">
            {totalHealed}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'vi' ? 'Tự động restart & báo Email/SMS' : 'Auto-restarted with Email/SMS alert'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TimeSeriesChart
          title={lang === 'vi' ? 'Nhịp độ thực thi Auto Running (ms)' : 'Auto-Running Execution Duration (ms)'}
          labels={durationHistory.map((d) => d.time)}
          series={[
            { label: 'Duration', color: '#2563eb', values: durationHistory.map((d) => d.avgMs), unit: 'ms' },
          ]}
        />
        <TimeSeriesChart
          title={lang === 'vi' ? 'Tài nguyên CPU tiêu thụ bởi Daemon (%)' : 'Daemon Background CPU Usage (%)'}
          labels={durationHistory.map((d) => d.time)}
          maxY={20}
          series={[
            { label: 'CPU', color: '#16a34a', values: durationHistory.map((d) => d.cpuPct), unit: '%' },
          ]}
        />
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {lang === 'vi' ? 'Bảng giám sát Tiến trình Auto Running' : 'Auto-Running Daemon Supervision Grid'}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'vi' ? 'Tìm theo tên hoặc host...' : 'Search name or host...'}
                aria-label={lang === 'vi' ? 'Tìm kiếm daemon' : 'Search daemons'}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-48"
              />
            </div>

            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as 'ALL' | DaemonRunState)}
              aria-label={lang === 'vi' ? 'Lọc theo trạng thái' : 'Filter by state'}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">{lang === 'vi' ? 'Tất cả trạng thái' : 'All States'}</option>
              <option value="active">{lang === 'vi' ? 'Sẵn sàng (Active)' : 'Active'}</option>
              <option value="running">{lang === 'vi' ? 'Đang chạy (Running)' : 'Running'}</option>
              <option value="paused">{lang === 'vi' ? 'Tạm dừng (Paused)' : 'Paused'}</option>
              <option value="recovering">{lang === 'vi' ? 'Tự phục hồi (Recovering)' : 'Recovering'}</option>
            </select>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setHostFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  hostFilter === 'ALL'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {lang === 'vi' ? 'Tất cả Host' : 'All Hosts'}
              </button>
              {hosts.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHostFilter(h)}
                  className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors whitespace-nowrap ${
                    hostFilter === h
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        </div>

        {validCheckedIds.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 tabular-nums">
              {validCheckedIds.length}{' '}
              {lang === 'vi' ? 'daemon đã chọn' : 'daemon(s) selected'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onBatchPause(validCheckedIds)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Tạm dừng' : 'Pause'}</span>
              </button>
              <button
                type="button"
                onClick={() => onBatchResume(validCheckedIds)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Tiếp tục' : 'Resume'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onBatchDelete(validCheckedIds);
                  setCheckedIds([]);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Xóa' : 'Delete'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCheckedIds([])}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap"
              >
                {lang === 'vi' ? 'Bỏ chọn' : 'Clear'}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="pl-5 pr-2 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleChecked}
                    onChange={toggleSelectAll}
                    aria-label={lang === 'vi' ? 'Chọn tất cả daemon' : 'Select all daemons'}
                    className="rounded border-slate-300 dark:border-slate-700 text-blue-600 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-3 font-medium">Daemon / Unit</th>
                <th className="px-4 py-3 font-medium">Host</th>
                <th className="px-4 py-3 font-medium">Schedule</th>
                <th className="px-4 py-3 font-medium">
                  {lang === 'vi' ? 'CPU / RAM (60p)' : 'CPU / RAM (60m)'}
                </th>
                <th className="px-4 py-3 font-medium text-right">
                  {lang === 'vi' ? 'Đếm ngược' : 'Next Tick'}
                </th>
                <th className="px-4 py-3 font-medium text-right">OK / Fail</th>
                <th className="px-4 py-3 font-medium text-right">Duration</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-5 py-3 font-medium text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {visibleDaemons.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-slate-500 dark:text-slate-400">
                    {lang === 'vi'
                      ? 'Không tìm thấy daemon phù hợp với bộ lọc hiện tại.'
                      : 'No Auto Running daemons match your current search or state filter.'}
                  </td>
                </tr>
              ) : (
                visibleDaemons.map((d) => {
                  const isSelected = selectedDaemon?.id === d.id;
                  const isChecked = validCheckedIds.includes(d.id);
                  return (
                    <tr
                      key={d.id}
                      onClick={() => setSelectedId(d.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className={`pl-5 pr-2 ${rowPad}`} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRowCheck(d.id)}
                          aria-label={`Select ${d.unitName}`}
                          className="rounded border-slate-300 dark:border-slate-700 text-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className={`px-3 ${rowPad}`}>
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {lang === 'vi' ? d.nameVi : d.nameEn}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{d.unitName}</p>
                      </td>
                      <td className={`px-4 ${rowPad} font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap`}>
                        {d.host}
                      </td>
                      <td className={`px-4 ${rowPad} font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap`}>
                        {d.cronExpr}
                      </td>
                      <td className={`px-4 ${rowPad} whitespace-nowrap`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <MiniSparkline
                              values={d.cpuHistory60m}
                              color="#2563eb"
                              ariaLabel={`${d.unitName} CPU 60m trend`}
                            />
                            <span className="font-mono text-[11px] tabular-nums text-slate-700 dark:text-slate-300 w-10 text-right">
                              {d.cpuOverheadPct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MiniSparkline
                              values={d.memoryHistory60m}
                              color="#16a34a"
                              ariaLabel={`${d.unitName} memory 60m trend`}
                            />
                            <span className="font-mono text-[11px] tabular-nums text-slate-600 dark:text-slate-400 w-10 text-right">
                              {d.memoryMb}MB
                            </span>
                          </div>
                        </div>
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap`}
                      >
                        {d.state === 'paused' ? '--:--' : formatCountdown(d.nextRunInSec)}
                      </td>
                      <td className={`px-4 ${rowPad} text-right font-mono tabular-nums whitespace-nowrap`}>
                        <span className="text-emerald-700 dark:text-emerald-400">{d.successCount24h}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span
                          className={
                            d.failureCount24h > 0
                              ? 'text-red-700 dark:text-red-400 font-semibold'
                              : 'text-slate-500 dark:text-slate-400'
                          }
                        >
                          {d.failureCount24h}
                        </span>
                      </td>
                      <td
                        className={`px-4 ${rowPad} text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap`}
                      >
                        {d.lastDurationMs} ms
                      </td>
                      <td className={`px-4 ${rowPad} whitespace-nowrap font-medium`}>
                        <span
                          className={
                            d.state === 'running'
                              ? 'text-blue-700 dark:text-blue-400'
                              : d.state === 'recovering'
                                ? 'text-amber-700 dark:text-amber-400'
                                : d.state === 'paused'
                                  ? 'text-slate-500 dark:text-slate-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                          }
                        >
                          {d.state === 'running'
                            ? lang === 'vi'
                              ? 'Đang chạy'
                              : 'Running'
                            : d.state === 'recovering'
                              ? lang === 'vi'
                                ? 'Tự phục hồi'
                                : 'Self-Healing'
                              : d.state === 'paused'
                                ? lang === 'vi'
                                  ? 'Tạm dừng'
                                  : 'Paused'
                                : lang === 'vi'
                                  ? 'Sẵn sàng'
                                  : 'Active'}
                        </span>
                      </td>
                      <td
                        className={`px-5 ${rowPad} text-right whitespace-nowrap`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onTriggerDaemonNow(d.id)}
                            disabled={d.state === 'running' || d.state === 'recovering'}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                            title={lang === 'vi' ? 'Chạy ngay' : 'Run Now'}
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>{lang === 'vi' ? 'Chạy' : 'Run'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleDaemon(d.id)}
                            className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title={d.state === 'paused' ? 'Resume' : 'Pause'}
                          >
                            {d.state === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSimulateFailureHeal(d.id)}
                            disabled={d.state === 'recovering'}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-40"
                            title={lang === 'vi' ? 'Mô phỏng lỗi & tự phục hồi' : 'Test Auto-Heal'}
                          >
                            <ShieldAlert className="w-3 h-3" />
                            <span>{lang === 'vi' ? 'Thử lỗi' : 'Test Heal'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {selectedDaemon && (
          <section className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-500" />
                <span>{lang === 'vi' ? 'Chi tiết Daemon đang chọn' : 'Selected Daemon Inspector'}</span>
              </h2>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{selectedDaemon.unitName}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs border-y border-slate-200 dark:border-slate-800 py-3">
              <div>
                <p className="text-slate-500 dark:text-slate-400">CPU / RAM</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {selectedDaemon.cpuOverheadPct}% · {selectedDaemon.memoryMb} MB
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">OK / Fail (24h)</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {selectedDaemon.successCount24h} / {selectedDaemon.failureCount24h}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Auto-Healed</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {selectedDaemon.autoHealedCount}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {lang === 'vi' ? 'Kết quả thực thi gần nhất' : 'Last Execution Result'}
              </p>
              <p className="text-xs text-slate-800 dark:text-slate-200 mb-3">
                {selectedDaemon.lastExecutionResult}
              </p>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                {lang === 'vi' ? 'Lệnh thực thi systemd ExecStart' : 'systemd ExecStart Command'}
              </p>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto">
                <code>{selectedDaemon.command}</code>
              </pre>
            </div>
          </section>
        )}

        <section
          className={`${
            selectedDaemon ? 'xl:col-span-7' : 'xl:col-span-12'
          } bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden`}
        >
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'vi' ? 'Nhật ký thực thi Auto Running trực tiếp' : 'Live Auto-Running Execution Stream'}
            </h2>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-72 overflow-y-auto font-mono text-xs">
            {executionLogs.map((entry) => (
              <div key={entry.id} className="px-5 py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-slate-400 tabular-nums">{entry.timestamp}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{entry.unitName}</span>
                    <span className="text-slate-500 dark:text-slate-400">{entry.trigger}</span>
                  </div>
                  <p className="font-sans text-xs text-slate-700 dark:text-slate-300 mt-0.5">{entry.output}</p>
                </div>
                <div className="text-right shrink-0 tabular-nums text-[11px]">
                  <span
                    className={
                      entry.exitCode === 0
                        ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                        : 'text-red-700 dark:text-red-400 font-semibold'
                    }
                  >
                    exit {entry.exitCode}
                  </span>
                  <div className="text-slate-400">{entry.durationMs}ms</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
