#!/bin/bash
# Script executado NO SERVIDOR (root@200.234.218.15)
# Instala dependencias, configura nginx, SSL e inicia os servicos

set -e
DOMAIN="charutospremium.iterlabs.com.br"
APP_DIR="/opt/charutos-sistema"
VENV_DIR="/opt/charutos-venv"

echo "========================================"
echo "  Deploy: $DOMAIN"
echo "========================================"

# ── 1. Pacotes base ──────────────────────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq nginx python3 python3-pip python3-venv nodejs npm certbot python3-certbot-nginx git curl

# ── 2. Dependencias Python ───────────────────────────────────────────────────
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --quiet --upgrade pip
"$VENV_DIR/bin/pip" install --quiet -r "$APP_DIR/backend/requirements.txt"

# ── 3. Build do frontend React ───────────────────────────────────────────────
cd "$APP_DIR/frontend"
npm install --silent
npm run build

echo "Frontend compilado em: $APP_DIR/frontend/dist"

# ── 4. Permissoes para o nginx ler os arquivos ───────────────────────────────
chmod -R 755 "$APP_DIR/frontend/dist"

# ── 5. Servico systemd da API ────────────────────────────────────────────────
cp "$APP_DIR/deploy/charutos-api.service" /etc/systemd/system/charutos-api.service
systemctl daemon-reload
systemctl enable charutos-api
systemctl restart charutos-api
echo "Servico charutos-api iniciado."

# ── 6. Nginx ─────────────────────────────────────────────────────────────────
# Configuracao temporaria HTTP (para o certbot validar o dominio)
cat > /etc/nginx/sites-available/charutos <<'NGINX_TMP'
server {
    listen 80;
    server_name charutospremium.iterlabs.com.br;
    root /opt/charutos-sistema/frontend/dist;
    index index.html;
    location / { try_files $uri $uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX_TMP

ln -sf /etc/nginx/sites-available/charutos /etc/nginx/sites-enabled/charutos
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 7. Certificado SSL (Let's Encrypt) ───────────────────────────────────────
echo ""
echo "Obtendo certificado SSL para $DOMAIN ..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m gianlucca_vedana@hotmail.com --redirect

# Substitui pela config final com SSL
cp "$APP_DIR/deploy/nginx-charutos.conf" /etc/nginx/sites-available/charutos
nginx -t && systemctl reload nginx

# ── 8. Verificacao final ─────────────────────────────────────────────────────
echo ""
echo "========================================"
systemctl status charutos-api --no-pager -l
echo "----------------------------------------"
echo "Site: https://$DOMAIN"
echo "API:  https://$DOMAIN/api/docs"
echo "========================================"
