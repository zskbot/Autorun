import React from 'react';
import {
  Activity,
  BookOpen,
  Bot,
  Cpu,
  GitBranch,
  HardDriveDownload,
  LayoutDashboard,
  Network,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
} from 'lucide-react';
import { Translations } from '../i18n/translations';
import { AccentTheme, NavSection } from '../types/ops';

interface SidebarProps {
  active: NavSection;
  onSelect: (section: NavSection) => void;
  t: Translations;
  accent: AccentTheme;
  onOpenCustomizer: () => void;
  isOnline: boolean;
  pendingCount: number;
}

const ACCENT_ACTIVE_MAP: Record<AccentTheme, string> = {
  cobalt: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
};

export const Sidebar: React.FC<SidebarProps> = ({
  active,
  onSelect,
  t,
  accent,
  onOpenCustomizer,
  isOnline,
  pendingCount,
}) => {
  const items: Array<{ id: NavSection; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: t.nav.overview, icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
    { id: 'pipeline', label: t.nav.pipeline, icon: <GitBranch className="w-4 h-4 shrink-0" /> },
    { id: 'observability', label: t.nav.observability, icon: <Activity className="w-4 h-4 shrink-0" /> },
    { id: 'automation', label: t.nav.automation, icon: <HardDriveDownload className="w-4 h-4 shrink-0" /> },
    { id: 'auto-running', label: t.nav.autoRunning, icon: <Timer className="w-4 h-4 shrink-0" /> },
    { id: 'security', label: t.nav.security, icon: <ShieldCheck className="w-4 h-4 shrink-0" /> },
    { id: 'architecture', label: t.nav.architecture, icon: <Network className="w-4 h-4 shrink-0" /> },
    { id: 'runbook', label: t.nav.runbook, icon: <BookOpen className="w-4 h-4 shrink-0" /> },
    { id: 'ai-agent', label: t.nav.aiAgent, icon: <Bot className="w-4 h-4 shrink-0" /> },
  ];

  return (
    <aside className="no-print w-full lg:w-64 shrink-0 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
      <div>
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <span className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {t.brandName}
          </span>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible" aria-label="Primary Navigation">
          {items.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive
                    ? ACCENT_ACTIVE_MAP[accent]
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="hidden lg:block p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-display font-semibold text-xs flex items-center justify-center shrink-0"
            aria-label="Lead Operator Avatar"
          >
            HK
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">Huynh Thuong</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {isOnline ? t.topBar.syncOnline : `${t.topBar.syncOffline} (${pendingCount})`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenCustomizer}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span>{t.topBar.customize}</span>
        </button>
      </div>
    </aside>
  );
};
