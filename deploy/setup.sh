#!/bin/bash
set -e

APP_DIR="/var/www/charutos"
DOMAIN="charutos.crescerassessoriapb.com"

echo ""
echo "======================================================"
echo "  SETUP CHARUTOS PREMIUM - $DOMAIN"
echo "======================================================"
echo ""

# ── 1. Dependências do sistema ──────────────────────────
echo "[1/6] Instalando dependencias do sistema..."
apt-get update -qq
apt-get install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx

# ── 2. Virtual environment Python ───────────────────────
echo "[2/6] Configurando ambiente Python..."
cd $APP_DIR
python3 -m venv venv
source venv/bin/activate
pip install --quiet -r backend/requirements.txt

# ── 3. Permissões do banco de dados ─────────────────────
echo "[3/6] Ajustando permissoes..."
chown -R root:root $APP_DIR
chmod 755 $APP_DIR
chmod 664 $APP_DIR/backend/charutos.db 2>/dev/null || true

# ── 4. Systemd service ──────────────────────────────────
echo "[4/6] Configurando servico systemd..."
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
systemctl is-active charutos && echo "  Backend: OK" || echo "  ERRO: verifique 'journalctl -u charutos'"

# ── 5. Nginx ────────────────────────────────────────────
echo "[5/6] Configurando Nginx..."
cat > /etc/nginx/sites-available/charutos << NGXEOF
server {
    listen 80;
    server_name $DOMAIN;

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
}
NGXEOF

ln -sf /etc/nginx/sites-available/charutos /etc/nginx/sites-enabled/charutos
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  Nginx: OK"

# ── 6. SSL com Let's Encrypt ────────────────────────────
echo "[6/6] Configurando certificado SSL..."
echo "  IMPORTANTE: o DNS do dominio $DOMAIN deve apontar para $(hostname -I | awk '{print $1}') antes de continuar."
echo ""
read -p "  O DNS ja esta configurado? (s/n): " dns_ok
if [ "$dns_ok" = "s" ] || [ "$dns_ok" = "S" ]; then
    certbot --nginx -d $DOMAIN \
        --non-interactive \
        --agree-tos \
        --email admin@charutos.com \
        --redirect
    echo "  SSL: OK"
else
    echo "  SSL pulado. Execute depois: certbot --nginx -d $DOMAIN"
fi

echo ""
echo "======================================================"
echo "  DEPLOY CONCLUIDO!"
echo "  Acesse: http://$DOMAIN  (ou https:// com SSL)"
echo "  Login: admin@charutos.com / admin123"
echo "======================================================"
echo ""
echo "Comandos uteis:"
echo "  Status backend:  systemctl status charutos"
echo "  Logs backend:    journalctl -u charutos -f"
echo "  Reiniciar:       systemctl restart charutos"
