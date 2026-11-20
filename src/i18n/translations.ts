import { Language } from '../types/ops';

export interface Translations {
  brandName: string;
  nav: {
    overview: string;
    pipeline: string;
    observability: string;
    automation: string;
    autoRunning: string;
    security: string;
    architecture: string;
    runbook: string;
    aiAgent: string;
  };
  topBar: {
    customize: string;
    runPipeline: string;
    syncOnline: string;
    syncOffline: string;
    pendingSync: string;
    mfaLocked: string;
    mfaVerified: string;
  };
  overview: {
    title: string;
    subtitle: string;
    kpiRunner: string;
    kpiDeploy: string;
    kpiLatency: string;
    kpiUsers: string;
    telemetryTitle: string;
    telemetrySubtitle: string;
    userAnalyticsTitle: string;
    userAnalyticsSubtitle: string;
    recentActivityTitle: string;
    liveStream: string;
    paused: string;
  };
  pipeline: {
    title: string;
    subtitle: string;
    runnerConfig: string;
    platformLabel: string;
    awsRegion: string;
    instanceType: string;
    runnerName: string;
    repoUrl: string;
    branch: string;
    stagingHost: string;
    sshPort: string;
    sshUser: string;
    dockerImage: string;
    autoDeploy: string;
    triggerRun: string;
    running: string;
    stagesTitle: string;
    generatedConfigsTitle: string;
    copyCode: string;
    copied: string;
    downloadFile: string;
  };
  observability: {
    title: string;
    subtitle: string;
    windowLabel: string;
    exportPdf: string;
    exportExcel: string;
    exportCsv: string;
    logsTitle: string;
    searchLogs: string;
    alertsTitle: string;
    testEmailAlert: string;
    testSmsAlert: string;
    enableBrowserPush: string;
    prometheusEndpoint: string;
  };
  automation: {
    title: string;
    subtitle: string;
    autorunTitle: string;
    autorunDesc: string;
    runNow: string;
    backupTitle: string;
    backupDesc: string;
    triggerBackup: string;
    restoreBtn: string;
    verifiedLabel: string;
    rpoRtoSummary: string;
  };
  security: {
    title: string;
    subtitle: string;
    mfaBannerLocked: string;
    mfaBannerUnlocked: string;
    verifyMfa: string;
    lockSession: string;
    totpHint: string;
    sshHardeningTitle: string;
    generateKey: string;
    secretsTitle: string;
    addSecret: string;
    e2eeTitle: string;
    encryptInput: string;
    encryptBtn: string;
  };
  architecture: {
    title: string;
    subtitle: string;
    microservicesTitle: string;
    pluginsTitle: string;
    enabled: string;
    disabled: string;
  };
  runbook: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    sopSection: string;
    troubleshootingSection: string;
  };
  aiAgent: {
    title: string;
    subtitle: string;
    placeholder: string;
    send: string;
    sending: string;
    presetsTitle: string;
    includeContext: string;
  };
  customizer: {
    title: string;
    language: string;
    theme: string;
    light: string;
    dark: string;
    accent: string;
    density: string;
    compact: string;
    comfortable: string;
    offlineSim: string;
    offlineSimDesc: string;
    syncQueueTitle: string;
    syncNow: string;
    close: string;
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  vi: {
    brandName: 'Kinetix Ops',
    nav: {
      overview: 'Tổng quan & Hiệu suất',
      pipeline: 'CI/CD & AWS Runner',
      observability: 'Giám sát & Báo cáo',
      automation: 'Autorun Free & Sao lưu',
      autoRunning: 'Giám sát Auto Running',
      security: 'Bảo mật SSH, E2EE & 2FA',
      architecture: 'Microservices & Plugin',
      runbook: 'Tài liệu & Xử lý sự cố',
      aiAgent: 'AI Ops Agent',
    },
    topBar: {
      customize: 'Tùy chỉnh & Đồng bộ',
      runPipeline: 'Chạy Pipeline',
      syncOnline: 'Đồng bộ thời gian thực',
      syncOffline: 'Chế độ Offline (Hàng đợi)',
      pendingSync: 'chờ đồng bộ',
      mfaLocked: '2FA Chưa mở khóa',
      mfaVerified: '2FA Đã xác thực',
    },
    overview: {
      title: 'Bảng điều khiển Hạ tầng & Phân tích Hiệu suất',
      subtitle:
        'Giám sát runner AWS EC2, triển khai Docker staging, Prometheus/Grafana và hiệu suất người dùng theo thời gian thực.',
      kpiRunner: 'Sẵn sàng Runner AWS',
      kpiDeploy: 'Triển khai Staging',
      kpiLatency: 'Độ trễ API p95',
      kpiUsers: 'Phiên người dùng trực tuyến',
      telemetryTitle: 'Dữ liệu hiệu năng Prometheus & Grafana',
      telemetrySubtitle: 'Cập nhật mỗi 3 giây từ cụm staging và host runner AWS',
      userAnalyticsTitle: 'Phân tích hiệu suất người dùng chuyên sâu',
      userAnalyticsSubtitle: 'Theo dõi tương tác thực tế, tốc độ phản hồi và tỷ lệ hoàn tất luồng',
      recentActivityTitle: 'Nhật ký triển khai & Sao lưu gần đây',
      liveStream: 'Đang thu thập trực tiếp',
      paused: 'Đã tạm dừng',
    },
    pipeline: {
      title: 'Cấu hình AWS Runner, Docker & Tự động Deploy Staging',
      subtitle:
        'Thiết lập máy chủ ảo AWS EC2, kết nối trực tiếp GitLab Runner hoặc GitHub Actions, đóng gói Docker và đẩy tự động lên Staging qua SSH.',
      runnerConfig: 'Thông số Host AWS & Runner',
      platformLabel: 'Nền tảng CI/CD',
      awsRegion: 'Vùng AWS',
      instanceType: 'Loại máy ảo EC2',
      runnerName: 'Tên Runner',
      repoUrl: 'Repository URL',
      branch: 'Nhánh kích hoạt',
      stagingHost: 'Địa chỉ Staging Host',
      sshPort: 'Cổng SSH',
      sshUser: 'Tài khoản SSH Deploy',
      dockerImage: 'Tên Docker Image',
      autoDeploy: 'Tự động deploy Staging khi kiểm thử đạt',
      triggerRun: 'Thực thi Pipeline ngay',
      running: 'Đang chạy Pipeline...',
      stagesTitle: 'Tiến trình thực thi CI/CD',
      generatedConfigsTitle: 'Mã cấu hình Infrastructure-as-Code & Pipeline tự sinh',
      copyCode: 'Sao chép mã',
      copied: 'Đã sao chép',
      downloadFile: 'Tải tệp cấu hình',
    },
    observability: {
      title: 'Giám sát Log, Prometheus/Grafana & Xuất Báo cáo',
      subtitle:
        'Biểu đồ thời gian thực, luồng log tập trung, cảnh báo qua Email/SMS/Push và xuất báo cáo định kỳ PDF hoặc Excel.',
      windowLabel: 'Khung thời gian',
      exportPdf: 'Xuất báo cáo PDF',
      exportExcel: 'Xuất Excel (.xls)',
      exportCsv: 'Xuất CSV',
      logsTitle: 'Luồng Log Hệ thống Tập trung',
      searchLogs: 'Lọc theo từ khóa, trace ID hoặc service...',
      alertsTitle: 'Quy tắc Cảnh báo & Thông báo Đa kênh',
      testEmailAlert: 'Gửi thử Email Alert',
      testSmsAlert: 'Gửi thử SMS Alert',
      enableBrowserPush: 'Bật Push Notification',
      prometheusEndpoint: 'Điểm cuối Prometheus Scrape',
    },
    automation: {
      title: 'Quy trình Autorun Free & Sao lưu Dữ liệu Hàng ngày',
      subtitle:
        'Tự động hóa tác vụ quản trị không tốn phí bằng systemd timer/cron và sao lưu mã hóa hàng ngày kèm kiểm thử khôi phục.',
      autorunTitle: 'Tác vụ Quản trị Autorun Free (Zero-Cost)',
      autorunDesc:
        'Chạy tự động trên chính AWS Runner/Staging thông qua systemd timers và bash watchdog, không cần dịch vụ scheduler trả phí.',
      runNow: 'Chạy ngay',
      backupTitle: 'Hệ thống Sao lưu Tự động Hàng ngày & Khôi phục Nhanh',
      backupDesc:
        'Chụp snapshot lúc 02:00 UTC hàng ngày, mã hóa AES-256-GCM và kiểm tra toàn vẹn SHA-256.',
      triggerBackup: 'Sao lưu thủ công ngay',
      restoreBtn: 'Khôi phục điểm này',
      verifiedLabel: 'Đã xác minh SHA-256',
      rpoRtoSummary: 'Mục tiêu khôi phục: RPO <= 24 giờ · RTO <= 8 phút',
    },
    security: {
      title: 'Bảo mật Cấp độ Ngân hàng: SSH, E2EE, Biến Môi trường & 2FA',
      subtitle:
        'Khóa cứng kết nối SSH Ed25519, quản lý biến môi trường mã hóa đầu cuối AES-256-GCM và xác thực hai lớp TOTP.',
      mfaBannerLocked: 'Phiên nhạy cảm đang khóa. Xác thực mã 2FA (mã demo: 482910 hoặc 6 chữ số bất kỳ) để giải mã biến môi trường.',
      mfaBannerUnlocked: 'Xác thực 2FA đang hoạt động. Bạn có thể xem giá trị giải mã và xoay vòng khóa.',
      verifyMfa: 'Xác thực 2FA',
      lockSession: 'Khóa phiên Vault',
      totpHint: 'Mã TOTP 6 số (ví dụ 482910)',
      sshHardeningTitle: 'Bảo mật Kết nối SSH & Tạo Khóa Ed25519',
      generateKey: 'Sinh cặp khóa Ed25519 mới',
      secretsTitle: 'Kho Biến Môi trường & Secrets (Mã hóa AES-256-GCM)',
      addSecret: 'Thêm biến môi trường',
      e2eeTitle: 'Kiểm thử Mã hóa Đầu cuối (Web Crypto AES-256-GCM)',
      encryptInput: 'Nhập chuỗi dữ liệu nhạy cảm để kiểm thử mã hóa E2EE...',
      encryptBtn: 'Mã hóa & Xác minh',
    },
    architecture: {
      title: 'Kiến trúc Microservices API & Hệ sinh thái Plugin',
      subtitle:
        'Giám sát các dịch vụ phân tán qua API Gateway và bật/tắt plugin mở rộng cho hệ thống quản trị.',
      microservicesTitle: 'Sơ đồ Trạng thái Microservices & API Gateway',
      pluginsTitle: 'Quản lý Plugin Mở rộng Linh hoạt',
      enabled: 'Đang bật',
      disabled: 'Đang tắt',
    },
    runbook: {
      title: 'Tài liệu Hướng dẫn Kỹ thuật & Quy trình Xử lý Sự cố',
      subtitle:
        'Cẩm nang vận hành chuẩn hóa cho đội ngũ kỹ sư: cài đặt runner AWS, triển khai Docker, bảo trì và xử lý sự cố khẩn cấp.',
      searchPlaceholder: 'Tìm kiếm hướng dẫn hoặc mã lỗi (vd: SSH, OOM, Rollback, Backup)...',
      sopSection: 'Quy trình Vận hành Chuẩn (SOP)',
      troubleshootingSection: 'Hướng dẫn Xử lý Sự cố Cơ bản & Khẩn cấp',
    },
    aiAgent: {
      title: 'AI Operations Agent — Tư vấn & Tự động hóa Tác vụ Phức tạp',
      subtitle:
        'Tác nhân AI gắn ngữ cảnh hạ tầng thực tế giúp chẩn đoán lỗi pipeline, tối ưu Dockerfile, viết playbook Ansible/Bash và đề xuất kiến trúc.',
      placeholder: 'Mô tả sự cố hoặc tác vụ cần tự động hóa (ví dụ: Tối ưu Dockerfile multi-stage và cấu hình cảnh báo Prometheus)...',
      send: 'Gửi yêu cầu',
      sending: 'Đang phân tích...',
      presetsTitle: 'Tác vụ mẫu nhanh',
      includeContext: 'Đính kèm trạng thái cụm hiện tại vào ngữ cảnh AI',
    },
    customizer: {
      title: 'Tùy chỉnh Giao diện, Ngôn ngữ & Đồng bộ Offline',
      language: 'Ngôn ngữ hiển thị',
      theme: 'Chế độ giao diện',
      light: 'Sáng (Light)',
      dark: 'Tối (Dark)',
      accent: 'Màu nhấn chủ đạo',
      density: 'Mật độ bảng dữ liệu',
      compact: 'Gọn (Compact)',
      comfortable: 'Thoáng (Comfortable)',
      offlineSim: 'Mô phỏng mất kết nối mạng (Offline Mode)',
      offlineSimDesc: 'Kiểm tra quy trình làm việc offline: thay đổi sẽ vào hàng đợi và tự động đồng bộ khi có mạng.',
      syncQueueTitle: 'Hàng đợi đồng bộ đa thiết bị',
      syncNow: 'Đồng bộ ngay',
      close: 'Đóng',
    },
  },
  en: {
    brandName: 'Kinetix Ops',
    nav: {
      overview: 'Overview & Analytics',
      pipeline: 'CI/CD & AWS Runner',
      observability: 'Monitoring & Reports',
      automation: 'Autorun Free & Backups',
      autoRunning: 'Auto Running Monitor',
      security: 'SSH, E2EE & 2FA Vault',
      architecture: 'Microservices & Plugins',
      runbook: 'Runbook & Troubleshooting',
      aiAgent: 'AI Ops Agent',
    },
    topBar: {
      customize: 'Customize & Sync',
      runPipeline: 'Run Pipeline',
      syncOnline: 'Real-Time Synced',
      syncOffline: 'Offline Queue Mode',
      pendingSync: 'pending sync',
      mfaLocked: '2FA Locked',
      mfaVerified: '2FA Verified',
    },
    overview: {
      title: 'Infrastructure Control & Real-Time Performance Analytics',
      subtitle:
        'Monitor AWS EC2 runners, Docker staging deployments, Prometheus/Grafana telemetry, and live user performance metrics.',
      kpiRunner: 'AWS Runner Availability',
      kpiDeploy: 'Staging Deploy Success',
      kpiLatency: 'API p95 Latency',
      kpiUsers: 'Active User Sessions',
      telemetryTitle: 'Prometheus & Grafana Live Telemetry',
      telemetrySubtitle: 'Streaming every 3 seconds from staging cluster and AWS runner host',
      userAnalyticsTitle: 'Deep User Performance Analytics',
      userAnalyticsSubtitle: 'Track real-time session latency, workflow completion, and throughput',
      recentActivityTitle: 'Recent Deployment & Backup Ledger',
      liveStream: 'Live Streaming',
      paused: 'Paused',
    },
    pipeline: {
      title: 'AWS Runner Provisioning, Docker & Automated Staging Deploy',
      subtitle:
        'Provision virtual hosts on AWS EC2, bind GitLab Runner or GitHub Actions directly, package with Docker, and deploy to Staging over hardened SSH.',
      runnerConfig: 'AWS Host & Runner Parameters',
      platformLabel: 'CI/CD Platform',
      awsRegion: 'AWS Region',
      instanceType: 'EC2 Instance Type',
      runnerName: 'Runner Name',
      repoUrl: 'Repository URL',
      branch: 'Trigger Branch',
      stagingHost: 'Staging Host',
      sshPort: 'SSH Port',
      sshUser: 'SSH Deploy User',
      dockerImage: 'Docker Image Tag',
      autoDeploy: 'Auto-deploy to Staging after tests pass',
      triggerRun: 'Execute Pipeline',
      running: 'Pipeline Running...',
      stagesTitle: 'CI/CD Execution Stages',
      generatedConfigsTitle: 'Generated Infrastructure-as-Code & Pipeline Manifests',
      copyCode: 'Copy Code',
      copied: 'Copied',
      downloadFile: 'Download File',
    },
    observability: {
      title: 'Logs, Prometheus/Grafana & Periodic Reports',
      subtitle:
        'Real-time performance charts, centralized log stream, multi-channel Email/SMS/Push alerts, and PDF or Excel report exports.',
      windowLabel: 'Time Window',
      exportPdf: 'Export PDF Report',
      exportExcel: 'Export Excel (.xls)',
      exportCsv: 'Export CSV',
      logsTitle: 'Centralized System Log Stream',
      searchLogs: 'Filter by keyword, trace ID, or service...',
      alertsTitle: 'Alert Rules & Instant Notifications',
      testEmailAlert: 'Test Email Alert',
      testSmsAlert: 'Test SMS Alert',
      enableBrowserPush: 'Enable Push Alerts',
      prometheusEndpoint: 'Prometheus Scrape Target',
    },
    automation: {
      title: 'Autorun-Free Engine & Automated Daily Backups',
      subtitle:
        'Zero-cost automated administrative maintenance via systemd/cron and daily encrypted backups with rapid point-in-time recovery.',
      autorunTitle: 'Autorun-Free Administrative Tasks (Zero-Cost)',
      autorunDesc:
        'Runs autonomously on your AWS Runner and Staging host using native systemd timers and bash watchdogs without paid schedulers.',
      runNow: 'Run Now',
      backupTitle: 'Automated Daily Backup & Rapid Recovery',
      backupDesc:
        'Daily 02:00 UTC encrypted snapshots (AES-256-GCM) with SHA-256 integrity verification.',
      triggerBackup: 'Run Backup Now',
      restoreBtn: 'Restore Snapshot',
      verifiedLabel: 'SHA-256 Verified',
      rpoRtoSummary: 'Recovery SLA: RPO <= 24 hours · RTO <= 8 minutes',
    },
    security: {
      title: 'Bank-Grade Security: SSH, E2EE, Secrets & 2FA',
      subtitle:
        'Hardened Ed25519 SSH connectivity, strict AES-256-GCM environment secret management, and Time-based Two-Factor Authentication.',
      mfaBannerLocked: 'Sensitive vault locked. Verify 2FA code (demo: 482910 or any 6 digits) to decrypt environment secrets.',
      mfaBannerUnlocked: '2FA session verified. Plaintext secret inspection and key rotation enabled.',
      verifyMfa: 'Verify 2FA',
      lockSession: 'Lock Vault',
      totpHint: '6-digit TOTP (e.g. 482910)',
      sshHardeningTitle: 'SSH Connection Hardening & Ed25519 Keygen',
      generateKey: 'Generate New Ed25519 Keypair',
      secretsTitle: 'Encrypted Environment Variables & Secrets Vault',
      addSecret: 'Add Secret Variable',
      e2eeTitle: 'End-to-End Encryption Inspector (Web Crypto AES-256-GCM)',
      encryptInput: 'Enter sensitive payload to test client-side E2EE encryption...',
      encryptBtn: 'Encrypt & Verify',
    },
    architecture: {
      title: 'Microservices API Architecture & Plugin Ecosystem',
      subtitle:
        'Monitor distributed services behind the API Gateway and enable modular plugins dynamically.',
      microservicesTitle: 'Microservices Health & API Gateway Topology',
      pluginsTitle: 'Modular System Plugins',
      enabled: 'Enabled',
      disabled: 'Disabled',
    },
    runbook: {
      title: 'Technical Operations Handbook & Incident Troubleshooting',
      subtitle:
        'Detailed standard operating procedures for ops teams: AWS runner setup, Docker staging deployment, and basic incident triage.',
      searchPlaceholder: 'Search runbooks or error scenarios (e.g. SSH, OOM, Rollback, Backup)...',
      sopSection: 'Standard Operating Procedures (SOP)',
      troubleshootingSection: 'Incident Troubleshooting Playbooks',
    },
    aiAgent: {
      title: 'AI Operations Agent — Advisory & Complex Task Automation',
      subtitle:
        'Context-aware SRE agent for diagnosing pipeline failures, optimizing Dockerfiles, authoring Ansible/Bash scripts, and scaling microservices.',
      placeholder: 'Describe an infrastructure issue or automation task...',
      send: 'Send Request',
      sending: 'Analyzing...',
      presetsTitle: 'Quick Operational Prompts',
      includeContext: 'Attach live cluster context to AI prompt',
    },
    customizer: {
      title: 'Workspace Customization, Language & Offline Sync',
      language: 'Display Language',
      theme: 'Interface Theme',
      light: 'Light',
      dark: 'Dark',
      accent: 'Primary Accent',
      density: 'Table Density',
      compact: 'Compact',
      comfortable: 'Comfortable',
      offlineSim: 'Simulate Offline Mode',
      offlineSimDesc: 'Test offline-first queueing: actions queue locally and auto-sync when connectivity returns.',
      syncQueueTitle: 'Multi-Device Sync Queue',
      syncNow: 'Sync Now',
      close: 'Close',
    },
  },
};
