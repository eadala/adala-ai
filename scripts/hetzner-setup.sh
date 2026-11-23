#!/bin/bash
# ═══════════════════════════════════════════════════════
# إعداد سيرفر Hetzner — يُنفَّذ مرة واحدة فقط
# ssh root@YOUR_SERVER_IP 'bash -s' < scripts/hetzner-setup.sh
# ═══════════════════════════════════════════════════════
set -e

echo "🚀 إعداد سيرفر عدالة AI على Hetzner..."

# ── 1. تحديثات النظام ────────────────────────────────
apt-get update -y
apt-get upgrade -y
apt-get install -y \
  curl wget git rsync \
  ufw fail2ban \
  ca-certificates gnupg lsb-release

# ── 2. تثبيت Docker ──────────────────────────────────
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo "✅ Docker مثبت"
else
  echo "✅ Docker موجود: $(docker --version)"
fi

# ── 3. Firewall ───────────────────────────────────────
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "✅ Firewall مُفعَّل"

# ── 4. Fail2ban ───────────────────────────────────────
systemctl enable fail2ban
systemctl start fail2ban
echo "✅ Fail2ban مُفعَّل"

# ── 5. إعداد مجلد المشروع ────────────────────────────
mkdir -p /opt/adala
mkdir -p /opt/adala/infra/postgres
mkdir -p /opt/adala/infra/nginx
echo "✅ مجلد /opt/adala جاهز"

# ── 6. Swap (مهم لـ builds على خوادم صغيرة) ──────────
if [ "$(swapon --show | wc -l)" -eq 0 ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "✅ Swap 2GB مضاف"
fi

# ── 7. حدود النظام ───────────────────────────────────
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65536
* hard nofile 65536
EOF

cat >> /etc/sysctl.conf << 'EOF'
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
vm.swappiness = 10
EOF
sysctl -p

# ── 8. مجلدات الـ Observability والـ Backup ──────────
mkdir -p /opt/adala/backups
mkdir -p /opt/adala/infra/monitoring/grafana/provisioning
chmod +x /opt/adala/infra/backup/backup.sh 2>/dev/null || true
echo "✅ مجلدات Observability و Backup جاهزة"

# ── 9. Cron للنسخ الاحتياطي (يومياً 2:00 صباحاً) ────
CRON_JOB="0 2 * * * /opt/adala/infra/backup/backup.sh >> /var/log/adala-backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v "adala-backup" ; echo "$CRON_JOB" ) | crontab -
echo "✅ Cron للنسخ الاحتياطي مُجدوَل (يومياً 2:00 ص)"

# ── 10. Log rotation ─────────────────────────────────
cat > /etc/logrotate.d/adala << 'EOF'
/var/log/adala-backup.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
}
EOF
echo "✅ Log rotation مُعدّ"

echo ""
echo "═══════════════════════════════════════════"
echo "✅ السيرفر جاهز للـ deployment!"
echo ""
echo "الخطوة التالية: أضف هذه الـ Secrets في GitHub:"
echo "  HETZNER_IP        = $(curl -s ifconfig.me)"
echo "  HETZNER_SSH_KEY   = (مفتاحك الخاص)"
echo "  DB_PASSWORD       = (كلمة مرور قوية)"
echo "  CLERK_SECRET_KEY  = (من Clerk dashboard)"
echo "  CLERK_PUBLISHABLE_KEY = (من Clerk dashboard)"
echo "  STRIPE_SECRET_KEY = (من Stripe dashboard)"
echo "  GEMINI_API_KEY    = (من Google AI Studio)"
echo "  SENTRY_DSN        = (اختياري — من sentry.io)"
echo "  GRAFANA_PASSWORD  = (كلمة مرور Grafana)"
echo ""
echo "🔭 للوصول لـ Observability (SSH tunnel):"
echo "  ssh -L 9090:localhost:9090 -L 3001:localhost:3001 root@\$(curl -s ifconfig.me)"
echo "  ثم افتح: http://localhost:3001  (Grafana)"
echo "           http://localhost:9090  (Prometheus)"
echo "═══════════════════════════════════════════"
