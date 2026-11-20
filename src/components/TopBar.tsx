import React from 'react';
import { Play, SlidersHorizontal } from 'lucide-react';
import { Translations } from '../i18n/translations';
import { AccentTheme, NavSection } from '../types/ops';

interface TopBarProps {
  activeSection: NavSection;
  t: Translations;
  accent: AccentTheme;
  isOnline: boolean;
  pendingCount: number;
  mfaVerified: boolean;
  pipelineRunning: boolean;
  onQuickRunPipeline: () => void;
  onOpenCustomizer: () => void;
}

const ACCENT_BTN_MAP: Record<AccentTheme, string> = {
  cobalt: 'bg-blue-600 hover:bg-blue-700 text-white',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  t,
  accent,
  isOnline,
  pendingCount,
  mfaVerified,
  pipelineRunning,
  onQuickRunPipeline,
  onOpenCustomizer,
}) => {
  const sectionLabels: Record<NavSection, string> = {
    overview: t.nav.overview,
    pipeline: t.nav.pipeline,
    observability: t.nav.observability,
    automation: t.nav.automation,
    'auto-running': t.nav.autoRunning,
    security: t.nav.security,
    architecture: t.nav.architecture,
    runbook: t.nav.runbook,
    'ai-agent': t.nav.aiAgent,
  };

  return (
    <header className="no-print h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-8 shrink-0">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">AWS ap-southeast-1</span>
        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
          /
        </span>
        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
          {sectionLabels[activeSection]}
        </span>
        <span className="hidden md:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
          ·
        </span>
        <span
          className={`hidden md:inline text-xs font-medium whitespace-nowrap shrink-0 ${
            isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
          }`}
        >
          {isOnline ? t.topBar.syncOnline : `${t.topBar.syncOffline} (${pendingCount} ${t.topBar.pendingSync})`}
        </span>
        <span className="hidden xl:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
          ·
        </span>
        <span
          className={`hidden xl:inline text-xs font-medium whitespace-nowrap shrink-0 ${
            mfaVerified ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {mfaVerified ? t.topBar.mfaVerified : t.topBar.mfaLocked}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenCustomizer}
          className="lg:hidden inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{t.topBar.customize}</span>
        </button>

        <button
          type="button"
          onClick={onQuickRunPipeline}
          disabled={pipelineRunning}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${ACCENT_BTN_MAP[accent]}`}
        >
          <Play className="w-3.5 h-3.5 shrink-0" />
          <span>{pipelineRunning ? t.pipeline.running : t.topBar.runPipeline}</span>
        </button>
      </div>
    </header>
  );
};
