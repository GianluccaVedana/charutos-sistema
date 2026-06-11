#!/bin/bash
# Executar na sua MAQUINA LOCAL (ou Codespace)
# Envia o projeto para o servidor e roda o setup automaticamente

set -e
SERVER="root@200.234.218.15"
APP_DIR="/opt/charutos-sistema"

echo "Enviando projeto para o servidor..."
rsync -avz --exclude 'node_modules' --exclude '__pycache__' --exclude '*.pyc' \
    --exclude 'frontend/dist' --exclude '.git' \
    /workspaces/charutos-sistema/ "$SERVER:$APP_DIR/"

echo "Executando setup no servidor..."
ssh "$SERVER" "bash $APP_DIR/deploy/setup-servidor.sh"
