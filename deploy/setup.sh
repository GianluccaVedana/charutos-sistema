#!/bin/bash
set -e

APP_DIR="/var/www/charutos"
DOMAIN="charutospremium.iterlabs.com.br"
REPO="https://github.com/GianluccaVedana/charutos-sistema"

echo ""
echo "======================================================"
echo "  SETUP CHARUTOS PREMIUM - $DOMAIN"
echo "======================================================"
echo ""

# ── 1. Dependências do sistema ──────────────────────────
echo "[1/7] Instalando dependencias do sistema..."
apt-get update -qq
apt-get install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git

# ── 2. Clonar ou atualizar repositório ──────────────────
echo "[2/7] Atualizando codigo..."
if [ -d "$APP_DIR/.git" ]; then
    cd $APP_DIR && git pull
else
    rm -rf $APP_DIR
    git clone $REPO $APP_DIR
    cd $APP_DIR
fi

# ── 3. Virtual environment Python ───────────────────────
echo "[3/7] Configurando ambiente Python..."
cd $APP_DIR
python3 -m venv venv
source venv/bin/activate
pip install --quiet -r backend/requirements.txt

# ── 4. Build do frontend ─────────────────────────────────
echo "[4/7] Buildando frontend..."
cd $APP_DIR/frontend
npm install --silent
npm run build
cd $APP_DIR

# ── 5. Permissões e diretórios ───────────────────────────
echo "[5/7] Ajustando permissoes e diretorios..."
mkdir -p $APP_DIR/backend/uploads
chown -R root:root $APP_DIR
chmod 755 $APP_DIR
chmod 664 $APP_DIR/backend/charutos.db 2>/dev/null || true
chmod 755 $APP_DIR/backend/uploads

# ── 6. Systemd service ──────────────────────────────────
echo "[6/7] Configurando servico systemd..."
cat > /etc/systemd/system/charutos.service << 'SVCEOF'
[Unit]
Description=Charutos Premium API
After=network.target

[Service]
User=root
WorkingDirectory=/var/www/charutos/backend/src
ExecStart=/var/www/charutos/venv/bin/uvicorn main:app --host 127.0.0.1 --port 3001
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable charutos
systemctl restart charutos
sleep 2
systemctl is-active charutos && echo "  Backend: OK" || { echo "  ERRO: verifique 'journalctl -u charutos -n 30'"; journalctl -u charutos -n 20; exit 1; }

# ── 7. Nginx ────────────────────────────────────────────
echo "[7/7] Configurando Nginx..."
cat > /etc/nginx/sites-available/charutos << NGXEOF
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 10M;

    root $APP_DIR/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    location /uploads/ {
        alias $APP_DIR/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGXEOF

ln -sf /etc/nginx/sites-available/charutos /etc/nginx/sites-enabled/charutos
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  Nginx: OK"

echo ""
echo "======================================================"
echo "  DEPLOY CONCLUIDO!"
echo "  Acesse: http://$DOMAIN"
echo "  Login:  admin@charutos.com / admin123"
echo "======================================================"
echo ""
echo "Para ativar SSL (apos DNS apontar para este servidor):"
echo "  certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@charutos.com --redirect"
echo ""
echo "Comandos uteis:"
echo "  Status backend:  systemctl status charutos"
echo "  Logs backend:    journalctl -u charutos -f"
echo "  Reiniciar:       systemctl restart charutos"
