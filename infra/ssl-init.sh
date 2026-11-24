#!/bin/bash
# SSL عبر Let's Encrypt — يُنفَّذ بعد أول deploy ناجح
# الاستخدام: bash infra/ssl-init.sh yourdomain.com admin@yourdomain.com
set -e

DOMAIN="${1:?أدخل اسم النطاق: ./ssl-init.sh example.com admin@example.com}"
EMAIL="${2:?أدخل البريد الإلكتروني}"

cd /opt/adala/infra

# 1. احصل على شهادة
docker compose run --rm certbot \
  certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

# 2. أضف HTTPS للـ gateway
cat > nginx/gateway-ssl.conf << NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;

    client_max_body_size 20m;

    location /api/events/stream {
        proxy_pass http://api:8080;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /api/ {
        proxy_pass http://api:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://web:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto https;
    }
}
NGINX

cp nginx/gateway-ssl.conf nginx/gateway.conf
docker compose restart gateway

echo "✅ SSL مفعّل لـ $DOMAIN"
