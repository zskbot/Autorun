import React, { useState } from 'react';
import { Check, Copy, Download, Play } from 'lucide-react';
import { Translations } from '../i18n/translations';
import { AccentTheme, Language, PipelineRun, RunnerConfig, RunnerPlatform } from '../types/ops';
import { generateCiWorkflow, generateDockerfile, generateTerraformRunner } from '../utils/configGenerators';
import { downloadTextFile } from '../utils/exporters';

interface PipelineRunnerViewProps {
  t: Translations;
  lang: Language;
  accent: AccentTheme;
  config: RunnerConfig;
  onChangeConfig: (next: RunnerConfig) => void;
  pipelines: PipelineRun[];
  pipelineRunning: boolean;
  onTriggerPipeline: () => void;
}

type ManifestTab = 'workflow' | 'terraform' | 'dockerfile';

const BTN_CLASSES: Record<AccentTheme, string> = {
  cobalt: 'bg-blue-600 hover:bg-blue-700 text-white',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
};

export const PipelineRunnerView: React.FC<PipelineRunnerViewProps> = ({
  t,
  lang,
  accent,
  config,
  onChangeConfig,
  pipelines,
  pipelineRunning,
  onTriggerPipeline,
}) => {
  const [manifestTab, setManifestTab] = useState<ManifestTab>('workflow');
  const [selectedRunId, setSelectedRunId] = useState<string>(pipelines[0]?.id ?? '');
  const [copied, setCopied] = useState(false);

  const activeRun = pipelines.find((p) => p.id === selectedRunId) ?? pipelines[0];

  const getManifestContent = (): { filename: string; content: string } => {
    if (manifestTab === 'terraform') {
      return { filename: 'aws-runner.tf', content: generateTerraformRunner(config) };
    }
    if (manifestTab === 'dockerfile') {
      return { filename: 'Dockerfile', content: generateDockerfile(config) };
    }
    return {
      filename: config.platform === 'gitlab-runner' ? '.gitlab-ci.yml' : 'ci-staging.yml',
      content: generateCiWorkflow(config),
    };
  };

  const manifest = getManifestContent();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(manifest.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  const updateField = <K extends keyof RunnerConfig>(key: K, val: RunnerConfig[K]) => {
    onChangeConfig({ ...config, [key]: val });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.pipeline.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">{t.pipeline.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onTriggerPipeline}
          disabled={pipelineRunning}
          className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${BTN_CLASSES[accent]}`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>{pipelineRunning ? t.pipeline.running : t.pipeline.triggerRun}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.pipeline.runnerConfig}
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              {t.pipeline.platformLabel}
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['github-actions', 'gitlab-runner'] as RunnerPlatform[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateField('platform', p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    config.platform === p
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {p === 'github-actions' ? 'GitHub Actions' : 'GitLab Runner'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t.pipeline.awsRegion}
              </label>
              <select
                value={config.awsRegion}
                onChange={(e) => updateField('awsRegion', e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                <option value="ap-northeast-1">ap-northeast-1 (Tokyo)</option>
                <option value="us-east-1">us-east-1 (Virginia)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t.pipeline.instanceType}
              </label>
              <select
                value={config.instanceType}
                onChange={(e) => updateField('instanceType', e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              >
                <option value="t3.medium">t3.medium (2 vCPU · 4 GB)</option>
                <option value="c6i.large">c6i.large (2 vCPU · 4 GB Compute)</option>
                <option value="c6i.xlarge">c6i.xlarge (4 vCPU · 8 GB Compute)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t.pipeline.runnerName}
              </label>
              <input
                type="text"
                value={config.runnerName}
                onChange={(e) => updateField('runnerName', e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t.pipeline.branch}
              </label>
              <input
                type="text"
                value={config.targetBranch}
                onChange={(e) => updateField('targetBranch', e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t.pipeline.stagingHost}
            </label>
            <input
              type="text"
              value={config.stagingHost}
              onChange={(e) => updateField('stagingHost', e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t.pipeline.sshUser}
              </label>
              <input
                type="text"
                value={config.sshUser}
                onChange={(e) => updateField('sshUser', e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t.pipeline.sshPort}
              </label>
              <input
                type="number"
                value={config.stagingPort}
                onChange={(e) => updateField('stagingPort', Number(e.target.value) || 2222)}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t.pipeline.dockerImage}
            </label>
            <input
              type="text"
              value={config.dockerImage}
              onChange={(e) => updateField('dockerImage', e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
          </div>

          <label className="flex items-center gap-2.5 pt-1 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoDeployStaging}
              onChange={(e) => updateField('autoDeployStaging', e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-blue-600"
            />
            <span>{t.pipeline.autoDeploy}</span>
          </label>
        </section>

        <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.pipeline.stagesTitle}
            </h2>
            <select
              value={activeRun?.id ?? ''}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.branch} ({p.commitSha})
                </option>
              ))}
            </select>
          </div>

          {activeRun && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono">{activeRun.commitSha}</span>
                <span aria-hidden="true">·</span>
                <span>{activeRun.author}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{activeRun.startedAt}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={`font-semibold ${
                    activeRun.status === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : activeRun.status === 'running'
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {activeRun.status.toUpperCase()}
                </span>
              </div>

              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                {activeRun.stages.map((st, idx) => (
                  <div key={st.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {idx + 1}. {st.name}
                      </span>
                      <div className="flex items-center gap-3 font-mono tabular-nums">
                        <span className="text-slate-500 dark:text-slate-400">{st.durationSec}s</span>
                        <span
                          className={
                            st.status === 'success'
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : st.status === 'running'
                                ? 'text-blue-700 dark:text-blue-400'
                                : st.status === 'failed'
                                  ? 'text-red-700 dark:text-red-400'
                                  : 'text-slate-400'
                          }
                        >
                          {st.status === 'success'
                            ? 'PASS'
                            : st.status === 'running'
                              ? 'RUNNING'
                              : st.status === 'failed'
                                ? 'FAIL'
                                : 'WAIT'}
                        </span>
                      </div>
                    </div>
                    <div className="bg-slate-950 text-slate-200 rounded-md p-2.5 font-mono text-[11px] leading-relaxed space-y-1 overflow-x-auto">
                      {st.logs.map((line, i) => (
                        <div key={i} className="whitespace-pre">
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.pipeline.generatedConfigsTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'vi'
                ? 'Cập nhật tự động theo thông số AWS Runner & Staging phía trên.'
                : 'Dynamically compiled from your live AWS Runner and Staging configuration above.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(
                [
                  { id: 'workflow', label: config.platform === 'gitlab-runner' ? '.gitlab-ci.yml' : 'GitHub Actions' },
                  { id: 'terraform', label: 'Terraform AWS' },
                  { id: 'dockerfile', label: 'Dockerfile' },
                ] as Array<{ id: ManifestTab; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setManifestTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    manifestTab === tab.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t.pipeline.copied : t.pipeline.copyCode}</span>
            </button>

            <button
              type="button"
              onClick={() => downloadTextFile(manifest.filename, manifest.content)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.pipeline.downloadFile}</span>
            </button>
          </div>
        </div>

        <pre className="p-5 bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed overflow-x-auto max-h-96">
          <code>{manifest.content}</code>
        </pre>
      </section>
    </div>
  );
};
