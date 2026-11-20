import React, { useState } from 'react';
import { Download, HardDrive, Play, RotateCcw } from 'lucide-react';
import { Translations } from '../i18n/translations';
import { AccentTheme, AutorunTask, BackupSnapshot, Language } from '../types/ops';
import { generateAutorunSystemd, generateDailyBackupScript } from '../utils/configGenerators';
import { downloadTextFile } from '../utils/exporters';

interface AutomationBackupViewProps {
  t: Translations;
  lang: Language;
  accent: AccentTheme;
  tasks: AutorunTask[];
  onToggleTask: (id: string) => void;
  onRunTaskNow: (id: string) => void;
  backups: BackupSnapshot[];
  onTriggerBackup: () => void;
  onRestoreBackup: (id: string) => void;
}

const BTN_MAP: Record<AccentTheme, string> = {
  cobalt: 'bg-blue-600 hover:bg-blue-700 text-white',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
};

export const AutomationBackupView: React.FC<AutomationBackupViewProps> = ({
  t,
  lang,
  accent,
  tasks,
  onToggleTask,
  onRunTaskNow,
  backups,
  onTriggerBackup,
  onRestoreBackup,
}) => {
  const [scriptTab, setScriptTab] = useState<'systemd' | 'backup'>('systemd');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t.automation.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">{t.automation.subtitle}</p>
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.automation.autorunTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.automation.autorunDesc}</p>
          </div>
          <button
            type="button"
            onClick={() => downloadTextFile('kinetix-autorun.service', generateAutorunSystemd())}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>systemd unit</span>
          </button>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {tasks.map((task) => (
            <div key={task.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {lang === 'vi' ? task.nameVi : task.nameEn}
                  </span>
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{task.scheduleCron}</span>
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{task.systemdUnit}</span>
                </div>
                <p className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 overflow-x-auto">
                  {task.command}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {lang === 'vi' ? task.savedCostNoteVi : task.savedCostNoteEn} · Last run: {task.lastRunAt}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => onRunTaskNow(task.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <Play className="w-3 h-3" />
                  <span>{t.automation.runNow}</span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={task.enabled}
                  onClick={() => onToggleTask(task.id)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                    task.enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      task.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.automation.backupTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.automation.backupDesc} · {t.automation.rpoRtoSummary}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadTextFile('backup-daily.sh', generateDailyBackupScript())}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>backup-daily.sh</span>
            </button>
            <button
              type="button"
              onClick={onTriggerBackup}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap ${BTN_MAP[accent]}`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{t.automation.triggerBackup}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3 font-medium">Snapshot ID</th>
                <th className="px-4 py-3 font-medium">Created At</th>
                <th className="px-4 py-3 font-medium text-right">Size</th>
                <th className="px-4 py-3 font-medium">Encryption</th>
                <th className="px-4 py-3 font-medium">SHA-256</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
              {backups.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">{b.id}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {b.createdAt}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {b.sizeGb.toFixed(2)} GB
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{b.encryption}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {b.checksumSha256.slice(0, 14)}...
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={
                        b.status === 'restoring'
                          ? 'text-blue-700 dark:text-blue-400 font-semibold'
                          : 'text-emerald-700 dark:text-emerald-400 font-semibold'
                      }
                    >
                      {b.status === 'restoring' ? 'RESTORING...' : t.automation.verifiedLabel}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onRestoreBackup(b.id)}
                      disabled={b.status === 'restoring'}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-sans font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{t.automation.restoreBtn}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScriptTab('systemd')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              scriptTab === 'systemd'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            kinetix-autorun.timer
          </button>
          <button
            type="button"
            onClick={() => setScriptTab('backup')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md ${
              scriptTab === 'backup'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            backup-daily.sh
          </button>
        </div>
        <pre className="p-5 bg-slate-950 text-slate-200 font-mono text-xs overflow-x-auto max-h-80">
          <code>{scriptTab === 'systemd' ? generateAutorunSystemd() : generateDailyBackupScript()}</code>
        </pre>
      </section>
    </div>
  );
};
