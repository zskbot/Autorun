import React, { useState } from 'react';
import { Copy, Eye, EyeOff, KeyRound, Lock, Plus, ShieldCheck, Unlock } from 'lucide-react';
import { Translations } from '../i18n/translations';
import { AccentTheme, EnvSecret, Language, RunnerConfig } from '../types/ops';
import { encryptWithAesGcm } from '../utils/exporters';

interface SecurityVaultViewProps {
  t: Translations;
  lang: Language;
  accent: AccentTheme;
  mfaVerified: boolean;
  onVerifyMfa: (code: string) => boolean;
  onLockMfa: () => void;
  secrets: EnvSecret[];
  onAddSecret: (key: string, plainValue: string, scope: EnvSecret['scope']) => Promise<void>;
  runnerConfig: RunnerConfig;
}

const BTN_CLASSES: Record<AccentTheme, string> = {
  cobalt: 'bg-blue-600 hover:bg-blue-700 text-white',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  indigo: 'bg-indigo-600 hover:bg-indigo-700 text-white',
};

export const SecurityVaultView: React.FC<SecurityVaultViewProps> = ({
  t,
  lang,
  accent,
  mfaVerified,
  onVerifyMfa,
  onLockMfa,
  secrets,
  onAddSecret,
  runnerConfig,
}) => {
  const [totpInput, setTotpInput] = useState('482910');
  const [totpError, setTotpError] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newScope, setNewScope] = useState<EnvSecret['scope']>('staging');
  const [e2eePlain, setE2eePlain] = useState('DB_PASS=kinetix_bank_grade_secret_2026');
  const [e2eeResult, setE2eeResult] = useState<{
    ciphertextBase64: string;
    ivHex: string;
    sha256Hex: string;
  } | null>(null);
  const [sshKeyPreview, setSshKeyPreview] = useState<string>(
    'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKinetixRunnerProd2026Ed25519 deploy@aws-ap1-runner-01',
  );

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onVerifyMfa(totpInput);
    if (!ok) {
      setTotpError(lang === 'vi' ? 'Vui lòng nhập đúng 6 chữ số TOTP.' : 'Please enter a valid 6-digit TOTP code.');
    } else {
      setTotpError(null);
    }
  };

  const handleAddSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newVal.trim()) return;
    await onAddSecret(newKey.trim().toUpperCase(), newVal.trim(), newScope);
    setNewKey('');
    setNewVal('');
  };

  const handleGenerateSshKey = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes)
      .map((b) => b.toString(36))
      .join('')
      .slice(0, 24);
    setSshKeyPreview(`ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI${token} ${runnerConfig.sshUser}@${runnerConfig.runnerName}`);
  };

  const handleEncryptTest = async () => {
    if (!e2eePlain.trim()) return;
    const res = await encryptWithAesGcm(e2eePlain);
    setE2eeResult(res);
  };

  const sshHardeningScript = `# /etc/ssh/sshd_config.d/99-kinetix-hardening.conf
Port ${runnerConfig.stagingPort}
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
MaxAuthTries 3
AllowUsers ${runnerConfig.sshUser}
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com
# Verify & reload: sudo sshd -t && sudo systemctl reload ssh`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {t.security.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">{t.security.subtitle}</p>
      </div>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3 max-w-2xl">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 shrink-0">
            {mfaVerified ? <Unlock className="w-5 h-5 text-emerald-600" /> : <Lock className="w-5 h-5 text-amber-600" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {mfaVerified ? t.topBar.mfaVerified : t.topBar.mfaLocked}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {mfaVerified ? t.security.mfaBannerUnlocked : t.security.mfaBannerLocked}
            </p>
            {totpError && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{totpError}</p>}
          </div>
        </div>

        {mfaVerified ? (
          <button
            type="button"
            onClick={onLockMfa}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{t.security.lockSession}</span>
          </button>
        ) : (
          <form onSubmit={handleMfaSubmit} className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totpInput}
              onChange={(e) => setTotpInput(e.target.value)}
              placeholder={t.security.totpHint}
              className="w-32 px-3 py-2 text-xs font-mono tracking-widest rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg whitespace-nowrap ${BTN_CLASSES[accent]}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t.security.verifyMfa}</span>
            </button>
          </form>
        )}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <section className="xl:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.security.secretsTitle}
            </h2>
          </div>

          <form onSubmit={handleAddSecret} className="p-4 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="ENV_KEY_NAME"
              className="sm:col-span-4 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <input
              type="password"
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              placeholder="Secret value"
              className="sm:col-span-4 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <select
              value={newScope}
              onChange={(e) => setNewScope(e.target.value as EnvSecret['scope'])}
              className="sm:col-span-2 px-2 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            >
              <option value="runner">runner</option>
              <option value="staging">staging</option>
              <option value="production">production</option>
            </select>
            <button
              type="submit"
              className={`sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap ${BTN_CLASSES[accent]}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{lang === 'vi' ? 'Lưu' : 'Save'}</span>
            </button>
          </form>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {secrets.map((sec) => {
              const revealed = mfaVerified && !!revealedIds[sec.id];
              return (
                <div key={sec.id} className="px-5 py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{sec.key}</span>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{sec.scope}</span>
                    </div>
                    <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {revealed ? sec.plainPreview : sec.encryptedValue}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!mfaVerified}
                    onClick={() => setRevealedIds((prev) => ({ ...prev, [sec.id]: !prev[sec.id] }))}
                    className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 shrink-0"
                    title={mfaVerified ? 'Toggle visibility' : 'Verify 2FA first'}
                  >
                    {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <div className="xl:col-span-5 space-y-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                {t.security.sshHardeningTitle}
              </h2>
              <button
                type="button"
                onClick={handleGenerateSshKey}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{t.security.generateKey}</span>
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-800 dark:text-slate-200 break-all">
              {sshKeyPreview}
            </div>

            <pre className="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto">
              <code>{sshHardeningScript}</code>
            </pre>
          </section>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
              {t.security.e2eeTitle}
            </h2>
            <textarea
              rows={2}
              value={e2eePlain}
              onChange={(e) => setE2eePlain(e.target.value)}
              placeholder={t.security.encryptInput}
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={handleEncryptTest}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg ${BTN_CLASSES[accent]}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t.security.encryptBtn}</span>
            </button>
            {e2eeResult && (
              <div className="p-3 rounded-lg bg-slate-950 text-slate-200 font-mono text-[11px] space-y-1 break-all">
                <div>IV (96-bit): {e2eeResult.ivHex}</div>
                <div>Ciphertext: {e2eeResult.ciphertextBase64}</div>
                <div className="text-emerald-400 flex items-center justify-between gap-2">
                  <span>SHA-256: {e2eeResult.sha256Hex}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(e2eeResult.ciphertextBase64)}
                    className="text-slate-300 hover:text-white shrink-0"
                    title="Copy Ciphertext"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
