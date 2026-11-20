import React from 'react';
import { Translations } from '../i18n/translations';
import { DensityMode, Language, MicroserviceNode, OpsPlugin } from '../types/ops';

interface ArchitecturePluginsViewProps {
  t: Translations;
  lang: Language;
  density: DensityMode;
  microservices: MicroserviceNode[];
  plugins: OpsPlugin[];
  onTogglePlugin: (id: string) => void;
}

export const ArchitecturePluginsView: React.FC<ArchitecturePluginsViewProps> = ({
  t,
  lang,
  density,
  microservices,
  plugins,
  onTogglePlugin,
}) => {
  const rowPad = density === 'compact' ? 'py-2.5' : 'py-3.5';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t.architecture.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">{t.architecture.subtitle}</p>
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.architecture.microservicesTitle}
          </h2>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {microservices.length} services · mTLS 1.3 Mesh
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="px-5 py-3 font-medium">Microservice</th>
                <th className="px-4 py-3 font-medium">Transport</th>
                <th className="px-4 py-3 font-medium text-right">Pods / Replicas</th>
                <th className="px-4 py-3 font-medium text-right">Throughput</th>
                <th className="px-4 py-3 font-medium text-right">p95 Latency</th>
                <th className="px-4 py-3 font-medium text-right">Error %</th>
                <th className="px-5 py-3 font-medium text-right">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
              {microservices.map((svc) => (
                <tr key={svc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className={`px-5 ${rowPad} font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap`}>
                    {svc.name}
                  </td>
                  <td className={`px-4 ${rowPad} text-slate-600 dark:text-slate-400 whitespace-nowrap`}>
                    {svc.protocol}
                  </td>
                  <td className={`px-4 ${rowPad} text-right tabular-nums text-slate-700 dark:text-slate-300`}>
                    {svc.instances}
                  </td>
                  <td className={`px-4 ${rowPad} text-right tabular-nums text-slate-700 dark:text-slate-300`}>
                    {svc.rps} req/s
                  </td>
                  <td className={`px-4 ${rowPad} text-right tabular-nums text-slate-700 dark:text-slate-300`}>
                    {svc.p95Ms} ms
                  </td>
                  <td className={`px-4 ${rowPad} text-right tabular-nums text-slate-700 dark:text-slate-300`}>
                    {svc.errorPct.toFixed(2)}%
                  </td>
                  <td
                    className={`px-5 ${rowPad} text-right font-sans font-semibold whitespace-nowrap ${
                      svc.status === 'healthy'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {svc.status === 'healthy' ? 'Healthy' : 'Degraded'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
          {t.architecture.pluginsTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plugins.map((plg) => (
            <div
              key={plg.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {plg.category} · {plg.provider}
                </p>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">{plg.name}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {lang === 'vi' ? plg.descriptionVi : plg.descriptionEn}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <span
                  className={`text-xs font-medium ${
                    plg.enabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {plg.enabled ? t.architecture.enabled : t.architecture.disabled}
                </span>

                <button
                  type="button"
                  role="switch"
                  aria-checked={plg.enabled}
                  onClick={() => onTogglePlugin(plg.id)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                    plg.enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      plg.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
