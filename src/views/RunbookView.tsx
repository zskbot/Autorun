import React, { useMemo, useState } from 'react';
import { Check, Copy, Search } from 'lucide-react';
import { Translations } from '../i18n/translations';
import { Language } from '../types/ops';

interface RunbookViewProps {
  t: Translations;
  lang: Language;
}

interface RunbookItem {
  id: string;
  category: 'sop' | 'troubleshoot';
  titleVi: string;
  titleEn: string;
  summaryVi: string;
  summaryEn: string;
  stepsVi: string[];
  stepsEn: string[];
  command: string;
}

const RUNBOOK_ITEMS: RunbookItem[] = [
  {
    id: 'sop-aws-runner',
    category: 'sop',
    titleVi: '01. Khởi tạo AWS EC2 Runner & Kết nối GitHub/GitLab',
    titleEn: '01. Provision AWS EC2 Runner & Bind GitHub/GitLab',
    summaryVi: 'Quy trình chuẩn dựng máy chủ runner Ubuntu 24.04, cài Docker và đăng ký token tự động.',
    summaryEn: 'Standard onboarding for Ubuntu 24.04 EC2 runner with Docker executor and runner registration.',
    stepsVi: [
      'Áp dụng Terraform aws-runner.tf để mở VPC Security Group chỉ cho phép SSH từ Bastion/VPN.',
      'Cài đặt Docker CE và thêm user runner vào group docker.',
      'Đăng ký runner với nhãn self-hosted và kích hoạt systemd service để tự chạy lại sau reboot.',
    ],
    stepsEn: [
      'Apply Terraform aws-runner.tf restricting SSH ingress to Bastion/VPN CIDR.',
      'Install Docker CE and add runner user to the docker group.',
      'Register runner with self-hosted tags and enable systemd service persistence.',
    ],
    command: 'sudo systemctl status actions.runner.* gitlab-runner && docker info --format "{{.ServerVersion}}"',
  },
  {
    id: 'sop-staging-deploy',
    category: 'sop',
    titleVi: '02. Quy trình Deploy Staging Tự động qua Docker & SSH',
    titleEn: '02. Automated Docker Staging Deployment via Hardened SSH',
    summaryVi: 'Đóng gói image multi-stage, kiểm tra CVE và rollout không gián đoạn lên staging.',
    summaryEn: 'Package multi-stage container, verify healthcheck probe, and deploy over Ed25519 SSH.',
    stepsVi: [
      'Pipeline chỉ bước sang stage deploy_staging khi unit test và lint đạt 100%.',
      'Nạp khóa STAGING_SSH_PRIVATE_KEY từ Secrets vào ~/.ssh tạm thời với quyền chmod 600.',
      'Chạy docker compose up -d và kiểm tra HTTP 200 tại /api/health trước khi đóng job.',
    ],
    stepsEn: [
      'Gate deploy_staging behind 100% passing unit tests and TypeScript lint checks.',
      'Inject STAGING_SSH_PRIVATE_KEY ephemerally with chmod 600 and clean up in always() step.',
      'Execute docker compose up -d and probe /api/health before marking release green.',
    ],
    command: 'ssh -p 2222 deploy@staging.kinetix-ops.internal "docker compose -f /opt/app/docker-compose.staging.yml ps"',
  },
  {
    id: 'ts-ssh-refused',
    category: 'troubleshoot',
    titleVi: 'Sự cố 1: Mất kết nối SSH hoặc Fail2Ban chặn IP Runner',
    titleEn: 'Incident 1: SSH Connection Refused or Runner IP Banned by Fail2Ban',
    summaryVi: 'Xảy ra khi thay đổi cổng SSH (2222) hoặc nhập sai khóa quá 3 lần.',
    summaryEn: 'Occurs after SSH port hardening (2222) or exceeding MaxAuthTries=3.',
    stepsVi: [
      'Kiểm tra Security Group AWS và tường lửa UFW trên staging host đã mở cổng 2222 chưa.',
      'Đăng nhập qua AWS EC2 Serial Console hoặc SSM Session Manager để kiểm tra fail2ban.',
      'Gỡ ban IP của runner và kiểm tra lại fingerprint trong ~/.ssh/known_hosts.',
    ],
    stepsEn: [
      'Verify AWS Security Group and UFW allow TCP port 2222 from the runner elastic IP.',
      'Connect via AWS SSM Session Manager if SSH is locked and inspect Fail2Ban jail.',
      'Unban the runner IP and refresh ~/.ssh/known_hosts.',
    ],
    command: 'sudo fail2ban-client status sshd && sudo fail2ban-client set sshd unbanip <RUNNER_IP>',
  },
  {
    id: 'ts-disk-oom',
    category: 'troubleshoot',
    titleVi: 'Sự cố 2: Đầy ổ đĩa Runner hoặc Container bị OOMKill (Exit 137)',
    titleEn: 'Incident 2: Runner Disk Full or Container OOMKilled (Exit 137)',
    summaryVi: 'Docker layer cache tích tụ làm đầy EBS hoặc container vượt giới hạn RAM.',
    summaryEn: 'Unpruned Docker build caches fill EBS volumes or workload exceeds cgroup memory limit.',
    stepsVi: [
      'Kiểm tra dung lượng đĩa bằng df -h và dung lượng Docker bằng docker system df.',
      'Kích hoạt dọn dẹp tức thì hoặc kiểm tra timer autorun-free kinetix-docker-prune.timer.',
      'Nếu container báo Exit 137, tăng mem_limit trong docker-compose.staging.yml và xem dmesg.',
    ],
    stepsEn: [
      'Inspect disk usage via df -h and docker system df.',
      'Trigger immediate prune or verify kinetix-docker-prune.timer is active.',
      'If Exit 137 appears in docker inspect, raise memory limits in docker-compose.staging.yml.',
    ],
    command: 'df -h && docker system df && docker system prune -af --filter "until=24h"',
  },
  {
    id: 'ts-rollback',
    category: 'troubleshoot',
    titleVi: 'Sự cố 3: Lỗi Staging sau Deploy & Khôi phục Nhanh từ Backup',
    titleEn: 'Incident 3: Post-Deploy Regression & Rapid Rollback / Backup Restore',
    summaryVi: 'Đưa staging về image ổn định trước đó hoặc khôi phục dữ liệu từ snapshot S3 AES-256.',
    summaryEn: 'Revert staging container to previous SHA tag or restore encrypted S3 daily snapshot.',
    stepsVi: [
      'Xem nhật ký container bị lỗi bằng docker logs --tail 200.',
      'Roll back tag Docker về phiên bản ổn định gần nhất và kiểm tra /api/health.',
      'Nếu dữ liệu DB bị ảnh hưởng, tải snapshot .enc từ S3, kiểm tra sha256sum và giải mã OpenSSL.',
    ],
    stepsEn: [
      'Tail container logs with docker logs --tail 200 to capture stack traces.',
      'Pin previous healthy image tag in docker-compose.staging.yml and redeploy.',
      'For data corruption, verify .sha256 checksum on S3 snapshot and decrypt with OpenSSL.',
    ],
    command: 'sha256sum -c snap.tar.gz.enc.sha256 && openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in snap.tar.gz.enc -out restore.tar.gz -pass file:/etc/kinetix/backup.key',
  },
];

export const RunbookView: React.FC<RunbookViewProps> = ({ t, lang }) => {
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return RUNBOOK_ITEMS;
    const q = query.toLowerCase();
    return RUNBOOK_ITEMS.filter(
      (item) =>
        item.titleVi.toLowerCase().includes(q) ||
        item.titleEn.toLowerCase().includes(q) ||
        item.summaryVi.toLowerCase().includes(q) ||
        item.summaryEn.toLowerCase().includes(q) ||
        item.command.toLowerCase().includes(q),
    );
  }, [query]);

  const copyCommand = async (id: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  const sops = filtered.filter((i) => i.category === 'sop');
  const troubles = filtered.filter((i) => i.category === 'troubleshoot');

  const renderCard = (item: RunbookItem) => (
    <article
      key={item.id}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
    >
      <div>
        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
          {lang === 'vi' ? item.titleVi : item.titleEn}
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          {lang === 'vi' ? item.summaryVi : item.summaryEn}
        </p>
      </div>

      <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        {(lang === 'vi' ? item.stepsVi : item.stepsEn).map((step, idx) => (
          <li key={idx}>{step}</li>
        ))}
      </ol>

      <div className="flex items-center justify-between gap-2 bg-slate-950 text-slate-200 rounded-lg px-3 py-2 font-mono text-[11px] overflow-x-auto">
        <code className="whitespace-nowrap">{item.command}</code>
        <button
          type="button"
          onClick={() => copyCommand(item.id, item.command)}
          className="text-slate-400 hover:text-white shrink-0 p-1"
          title="Copy command"
        >
          {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </article>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t.runbook.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">{t.runbook.subtitle}</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.runbook.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {sops.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.runbook.sopSection}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{sops.map(renderCard)}</div>
        </section>
      )}

      {troubles.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
            {t.runbook.troubleshootingSection}
          </h2>
          <div className="grid grid-cols-1 gap-4">{troubles.map(renderCard)}</div>
        </section>
      )}
    </div>
  );
};
