#!/bin/bash
set -e

echo "==> Instalando dependências Python..."
cd /workspaces/charutos-sistema/backend
pip install -r requirements.txt --quiet

echo "==> Instalando dependências Node..."
cd /workspaces/charutos-sistema/frontend
npm install --silent

echo "==> Inicializando banco de dados..."
cd /workspaces/charutos-sistema/backend/src
python seed.py

echo "==> Setup concluído!"
