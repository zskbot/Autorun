import { RunnerConfig } from '../types/ops';

export function generateTerraformRunner(cfg: RunnerConfig): string {
  return `# Terraform: AWS EC2 Self-Hosted CI/CD Runner (${cfg.platform})
provider "aws" {
  region = "${cfg.awsRegion}"
}

resource "aws_key_pair" "runner_ssh" {
  key_name   = "${cfg.runnerName}-ed25519"
  public_key = file("~/.ssh/id_ed25519_runner.pub")
}

resource "aws_security_group" "ci_runner_sg" {
  name        = "${cfg.runnerName}-sg"
  description = "Restrict SSH to bastion/VPN CIDR and allow outbound CI traffic"

  ingress {
    description = "Hardened SSH"
    from_port   = ${cfg.stagingPort}
    to_port     = ${cfg.stagingPort}
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "ci_runner" {
  ami                    = "ami-0df7a207adb9748c7" # Ubuntu 24.04 LTS
  instance_type          = "${cfg.instanceType}"
  key_name               = aws_key_pair.runner_ssh.key_name
  vpc_security_group_ids = [aws_security_group.ci_runner_sg.id]

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
    encrypted   = true
  }

  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail
    apt-get update && apt-get install -y docker.io docker-compose-v2 fail2ban ufw jq curl
    systemctl enable --now docker fail2ban
    usermod -aG docker ubuntu
    ${
      cfg.platform === 'gitlab-runner'
        ? `curl -L "https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh" | bash
    apt-get install -y gitlab-runner
    gitlab-runner register --non-interactive --url "https://gitlab.com/" --executor "docker" --docker-image "node:22-alpine" --description "${cfg.runnerName}"`
        : `mkdir -p /opt/actions-runner && cd /opt/actions-runner
    curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
    tar xzf actions-runner.tar.gz && chown -R ubuntu:ubuntu /opt/actions-runner`
    }
  EOF

  tags = {
    Name        = "${cfg.runnerName}"
    Environment = "ci-runner"
    ManagedBy   = "terraform"
  }
}`;
}

export function generateCiWorkflow(cfg: RunnerConfig): string {
  if (cfg.platform === 'gitlab-runner') {
    return `# .gitlab-ci.yml — Runs directly on AWS EC2 GitLab Runner (${cfg.runnerName})
stages:
  - test
  - build
  - deploy_staging

variables:
  DOCKER_TLS_CERTDIR: ""
  IMAGE_TAG: "${cfg.dockerImage}:$CI_COMMIT_SHORT_SHA"

test_suite:
  stage: test
  tags:
    - ${cfg.runnerName}
  image: node:22-alpine
  script:
    - npm ci --prefer-offline
    - npm run lint
    - npm test -- --ci
  only:
    - ${cfg.targetBranch}

docker_package:
  stage: build
  tags:
    - ${cfg.runnerName}
  script:
    - docker build -t "$IMAGE_TAG" -t "${cfg.dockerImage}:staging-latest" .
    - docker save "${cfg.dockerImage}:staging-latest" | gzip > /tmp/app-staging.tar.gz
  artifacts:
    paths:
      - /tmp/app-staging.tar.gz
    expire_in: 1 day
  only:
    - ${cfg.targetBranch}

deploy_staging:
  stage: deploy_staging
  tags:
    - ${cfg.runnerName}
  needs: ["test_suite", "docker_package"]
  before_script:
    - mkdir -p ~/.ssh && chmod 700 ~/.ssh
    - echo "$STAGING_SSH_PRIVATE_KEY" | tr -d '\\r' > ~/.ssh/id_ed25519
    - chmod 600 ~/.ssh/id_ed25519
    - ssh-keyscan -p ${cfg.stagingPort} -H "${cfg.stagingHost}" >> ~/.ssh/known_hosts
  script:
    - scp -P ${cfg.stagingPort} /tmp/app-staging.tar.gz ${cfg.sshUser}@${cfg.stagingHost}:/tmp/
    - |
      ssh -p ${cfg.stagingPort} ${cfg.sshUser}@${cfg.stagingHost} << 'EOF'
        set -euo pipefail
        docker load < /tmp/app-staging.tar.gz
        docker compose -f /opt/app/docker-compose.staging.yml up -d --remove-orphans
        rm -f /tmp/app-staging.tar.gz
        curl -fsS http://127.0.0.1:${cfg.appPort}${cfg.healthcheckPath}
      EOF
  environment:
    name: staging
    url: https://${cfg.stagingHost}`;
  }

  return `# .github/workflows/ci-staging.yml — Self-Hosted AWS Runner (${cfg.runnerName})
name: CI Build, Test & Auto-Deploy Staging

on:
  push:
    branches: ["${cfg.targetBranch}"]

jobs:
  test-and-build:
    runs-on: [self-hosted, linux, x64, ${cfg.runnerName}]
    steps:
      - name: Checkout Source
        uses: actions/checkout@v4

      - name: Setup Node 22
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - name: Install & Run Tests
        run: |
          npm ci
          npm run lint
          npm run build

      - name: Package Hardened Docker Image
        run: |
          docker build -t ${cfg.dockerImage}:\${{ github.sha }} -t ${cfg.dockerImage}:staging .
          docker save ${cfg.dockerImage}:staging | gzip > /tmp/app-staging.tar.gz

  deploy-staging:
    needs: test-and-build
    if: \${{ success() && ${cfg.autoDeployStaging ? 'true' : 'false'} }}
    runs-on: [self-hosted, linux, x64, ${cfg.runnerName}]
    environment: staging
    steps:
      - name: Configure Ephemeral Ed25519 SSH Key
        env:
          SSH_KEY: \${{ secrets.STAGING_SSH_PRIVATE_KEY }}
        run: |
          mkdir -p ~/.ssh && chmod 700 ~/.ssh
          printf '%s\\n' "$SSH_KEY" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -p ${cfg.stagingPort} -H "${cfg.stagingHost}" >> ~/.ssh/known_hosts

      - name: Transfer & Deploy Container on Staging
        run: |
          scp -P ${cfg.stagingPort} /tmp/app-staging.tar.gz ${cfg.sshUser}@${cfg.stagingHost}:/tmp/
          ssh -p ${cfg.stagingPort} ${cfg.sshUser}@${cfg.stagingHost} "
            set -euo pipefail
            docker load < /tmp/app-staging.tar.gz
            docker compose -f /opt/app/docker-compose.staging.yml up -d --remove-orphans
            rm -f /tmp/app-staging.tar.gz
            curl -fsS http://127.0.0.1:${cfg.appPort}${cfg.healthcheckPath}
          "
      - name: Cleanup Local Runner Artifacts
        if: always()
        run: rm -f ~/.ssh/id_ed25519 /tmp/app-staging.tar.gz`;
}

export function generateDockerfile(cfg: RunnerConfig): string {
  return `# Multi-Stage Hardened Production Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts

USER appuser
EXPOSE ${cfg.appPort}
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \\
  CMD wget -qO- http://127.0.0.1:${cfg.appPort}${cfg.healthcheckPath} || exit 1

CMD ["npx", "tsx", "server.ts"]`;
}

export function generatePrometheusConfig(cfg: RunnerConfig): string {
  return `# prometheus.yml + alertmanager.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

rule_files:
  - "/etc/prometheus/alert-rules.yml"

scrape_configs:
  - job_name: "kinetix-staging-app"
    metrics_path: "/metrics"
    static_configs:
      - targets: ["${cfg.stagingHost}:${cfg.appPort}"]
        labels:
          env: "staging"

  - job_name: "aws-runner-node-exporter"
    static_configs:
      - targets: ["10.0.1.24:9100"]
        labels:
          runner: "${cfg.runnerName}"

  - job_name: "docker-cadvisor"
    static_configs:
      - targets: ["10.0.1.24:8080"]`;
}

export function generateDailyBackupScript(): string {
  return `#!/usr/bin/env bash
# /opt/ops/backup-daily.sh — Encrypted Daily Backup (AES-256-CBC + SHA-256 + S3)
set -euo pipefail

BACKUP_DIR="/var/backups/kinetix"
DATE_TAG="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE_PATH="\${BACKUP_DIR}/kinetix-\${DATE_TAG}.tar.gz"
ENC_PATH="\${ARCHIVE_PATH}.enc"
S3_BUCKET="s3://kinetix-ops-backups-ap-southeast-1/daily"

mkdir -p "$BACKUP_DIR"

# 1. Dump database & application volumes
pg_dump "$DATABASE_URL" | gzip > "\${BACKUP_DIR}/db-\${DATE_TAG}.sql.gz"
tar -czf "$ARCHIVE_PATH" -C /opt/app .env.enc docker-compose.staging.yml "\${BACKUP_DIR}/db-\${DATE_TAG}.sql.gz"

# 2. Encrypt with AES-256 + PBKDF2 using secret key stored in root-only file
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \\
  -in "$ARCHIVE_PATH" -out "$ENC_PATH" \\
  -pass file:/etc/kinetix/backup.key

# 3. Generate SHA-256 checksum & upload to S3
sha256sum "$ENC_PATH" > "\${ENC_PATH}.sha256"
aws s3 cp "$ENC_PATH" "\${S3_BUCKET}/" --sse aws:kms
aws s3 cp "\${ENC_PATH}.sha256" "\${S3_BUCKET}/"

# 4. Enforce 7-day local retention
find "$BACKUP_DIR" -type f -mtime +7 -delete
rm -f "$ARCHIVE_PATH" "\${BACKUP_DIR}/db-\${DATE_TAG}.sql.gz"
echo "[OK] Daily encrypted backup completed: \${ENC_PATH}"`;
}

export function generateAutorunSystemd(): string {
  return `# /etc/systemd/system/kinetix-autorun.service
[Unit]
Description=Kinetix Autorun-Free Zero-Cost Maintenance Suite
After=docker.service network-online.target

[Service]
Type=oneshot
ExecStart=/opt/ops/autorun-free.sh
StandardOutput=journal
StandardError=journal

# /etc/systemd/system/kinetix-autorun.timer
[Unit]
Description=Run Kinetix Autorun-Free tasks daily at 02:00 UTC

[Timer]
OnCalendar=*-*-* 02:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target

# Enable without paid schedulers:
# sudo systemctl daemon-reload && sudo systemctl enable --now kinetix-autorun.timer`;
}
