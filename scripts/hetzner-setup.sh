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
echo "═══════════════════════════════════════════"
