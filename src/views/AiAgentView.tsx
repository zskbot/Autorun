import React, { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { Translations } from '../i18n/translations';
import { AccentTheme, Language, MetricPoint, RunnerConfig } from '../types/ops';

interface AiAgentViewProps {
  t: Translations;
  lang: Language;
  accent: AccentTheme;
  runnerConfig: RunnerConfig;
  latestMetric?: MetricPoint;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: string;
}

const BTN_CLASSES: Record<AccentTheme, string> = {
  cobalt: 'bg-blue-600 hover:bg-blue-700 text-white',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
};

export const AiAgentView: React.FC<AiAgentViewProps> = ({
  t,
  lang,
  accent,
  runnerConfig,
  latestMetric,
}) => {
  const [prompt, setPrompt] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      id: 'welcome',
      role: 'assistant',
      timestamp: new Date().toLocaleTimeString(),
      content:
        lang === 'vi'
          ? 'Xin chào. Tôi là Kinetix AI Operations Agent. Hãy đặt câu hỏi về cấu hình AWS Runner, tối ưu Dockerfile, chẩn đoán cảnh báo Prometheus, tự động hóa autorun-free hoặc xử lý sự cố Staging.'
          : 'Hello. I am the Kinetix AI Operations Agent. Ask me to troubleshoot pipeline failures, optimize Docker multi-stage builds, configure Prometheus alerts, or generate autorun-free automation playbooks.',
    },
  ]);

  const presets =
    lang === 'vi'
      ? [
          'Viết script bash autorun-free tự động kiểm tra sức khỏe Docker staging và gửi cảnh báo nếu HTTP != 200.',
          'Kiểm tra cấu hình SSH cổng 2222 và đề xuất quy tắc UFW + Fail2Ban chống dò quét mật khẩu.',
          'Đề xuất truy vấn PromQL phát hiện rò rỉ bộ nhớ và tăng độ trễ p95 bất thường trên staging.',
          'Tối ưu Dockerfile Node.js multi-stage để giảm kích thước image và chạy bằng non-root user.',
        ]
      : [
          'Write an autorun-free bash watchdog that probes staging /api/health and fires an alert on failure.',
          'Audit our SSH port 2222 hardening and provide UFW + Fail2Ban rules for the AWS runner.',
          'Recommend PromQL alert expressions for memory leaks and p95 latency spikes on staging.',
          'Optimize a multi-stage Node.js Dockerfile for minimal image footprint and non-root execution.',
        ];

  const submitQuery = async (text: string) => {
    const clean = text.trim();
    if (!clean || loading) return;

    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: clean,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userTurn]);
    setPrompt('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: clean,
          language: lang,
          mode: 'consult',
          context: includeContext
            ? {
                runner: runnerConfig,
                latestTelemetry: latestMetric ?? null,
              }
            : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.answer || '(Empty response)',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unable to reach AI Operations Agent.';
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'error',
          content: errMsg,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t.aiAgent.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">{t.aiAgent.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <aside className="xl:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t.aiAgent.presetsTitle}
            </h2>
            <div className="space-y-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => submitQuery(p)}
                  disabled={loading}
                  className="w-full text-left p-3 text-xs rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 pt-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-blue-600"
              />
              <span>{t.aiAgent.includeContext}</span>
            </label>
          </div>
        </aside>

        <section className="xl:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col h-[560px] overflow-hidden">
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-4 rounded-xl text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 ml-8'
                    : m.role === 'error'
                      ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 mr-8'
                      : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 mr-8'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold inline-flex items-center gap-1.5">
                    {m.role === 'assistant' && <Bot className="w-3.5 h-3.5" />}
                    {m.role === 'user'
                      ? lang === 'vi'
                        ? 'Kỹ sư vận hành'
                        : 'Operator'
                      : m.role === 'error'
                        ? 'Error'
                        : 'AI Ops Agent'}
                  </span>
                  <span className="font-mono tabular-nums">{m.timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap font-sans">{m.content}</div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitQuery(prompt);
            }}
            className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.aiAgent.placeholder}
              disabled={loading}
              className="flex-1 px-3.5 py-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 disabled:opacity-50 ${BTN_CLASSES[accent]}`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? t.aiAgent.sending : t.aiAgent.send}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
