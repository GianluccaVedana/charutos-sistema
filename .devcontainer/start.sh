#!/bin/bash

echo "==> Iniciando backend (porta 3001)..."
cd /workspaces/charutos-sistema/backend/src
python -m uvicorn main:app --host 0.0.0.0 --port 3001 --reload &

sleep 3

echo "==> Iniciando frontend (porta 5173)..."
cd /workspaces/charutos-sistema/frontend
npm run dev -- --host 0.0.0.0 &

echo "==> Sistema rodando!"
echo "    Backend:  http://localhost:3001"
echo "    Frontend: http://localhost:5173"
