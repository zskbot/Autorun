import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Translations } from '../i18n/translations';
import { AccentTheme, DensityMode, Language, SyncQueueItem, ThemeMode, UiPreferences } from '../types/ops';

interface CustomizerModalProps {
  open: boolean;
  onClose: () => void;
  prefs: UiPreferences;
  onChangePrefs: (next: UiPreferences) => void;
  t: Translations;
  simulatedOffline: boolean;
  onToggleOffline: (val: boolean) => void;
  queue: SyncQueueItem[];
  onFlushSync: () => void;
  lastSyncedAt: string;
}

export const CustomizerModal: React.FC<CustomizerModalProps> = ({
  open,
  onClose,
  prefs,
  onChangePrefs,
  t,
  simulatedOffline,
  onToggleOffline,
  queue,
  onFlushSync,
  lastSyncedAt,
}) => {
  if (!open) return null;

  const setLang = (language: Language) => onChangePrefs({ ...prefs, language });
  const setTheme = (theme: ThemeMode) => onChangePrefs({ ...prefs, theme });
  const setAccent = (accent: AccentTheme) => onChangePrefs({ ...prefs, accent });
  const setDensity = (density: DensityMode) => onChangePrefs({ ...prefs, density });

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.customizer.title}
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t.customizer.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={t.customizer.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              {t.customizer.language}
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setLang('vi')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  prefs.language === 'vi'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Tiếng Việt
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  prefs.language === 'en'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                English
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              {t.customizer.theme}
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  prefs.theme === 'light'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.customizer.light}
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  prefs.theme === 'dark'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.customizer.dark}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              {t.customizer.accent}
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['cobalt', 'emerald', 'indigo'] as AccentTheme[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAccent(a)}
                  className={`px-2 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                    prefs.accent === a
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              {t.customizer.density}
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  prefs.density === 'compact'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.customizer.compact}
              </button>
              <button
                type="button"
                onClick={() => setDensity('comfortable')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  prefs.density === 'comfortable'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t.customizer.comfortable}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{t.customizer.offlineSim}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.customizer.offlineSimDesc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={simulatedOffline}
              onClick={() => onToggleOffline(!simulatedOffline)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                simulatedOffline ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  simulatedOffline ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {t.customizer.syncQueueTitle} · {lastSyncedAt}
            </span>
            <button
              type="button"
              onClick={onFlushSync}
              disabled={simulatedOffline}
              className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium hover:underline disabled:opacity-40"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t.customizer.syncNow}</span>
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-200 dark:divide-slate-800">
            {queue.length === 0 ? (
              <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                {prefs.language === 'vi' ? 'Chưa có thao tác nào trong hàng đợi.' : 'No operations queued yet.'}
              </div>
            ) : (
              queue.slice(0, 6).map((item) => (
                <div key={item.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{item.action}</span>
                    <span className="text-slate-400 mx-1.5">·</span>
                    <span className="text-slate-500 dark:text-slate-400 truncate">{item.payloadSummary}</span>
                  </div>
                  <span
                    className={`font-mono shrink-0 ${
                      item.synced ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {item.synced ? 'SYNCED' : 'QUEUED'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
