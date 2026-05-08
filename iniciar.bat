@echo off
title Charutos Premium - Sistema de Gestao
color 0A

echo ============================================
echo   CHARUTOS PREMIUM - Sistema de Gestao
echo ============================================
echo.

:: Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado!
    pause
    exit /b 1
)

:: Verificar Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado! Instale em nodejs.org
    pause
    exit /b 1
)

:: Instalar dependencias Python
echo [1/4] Instalando dependencias Python (backend)...
cd /d "%~dp0backend"
pip install -r requirements.txt -q

:: Inicializar banco de dados com dados de exemplo
echo [2/4] Inicializando banco de dados...
cd src
python seed.py
cd ..

:: Iniciar backend Python em segundo plano
echo [3/4] Iniciando Backend Python (porta 3001)...
start /min "Backend - Charutos API" cmd /c "cd /d "%~dp0backend\src" && python -m uvicorn main:app --host 0.0.0.0 --port 3001 --reload"
timeout /t 3 /nobreak >nul

:: Instalar e iniciar frontend
echo [4/4] Preparando Frontend React...
cd /d "%~dp0frontend"
if not exist node_modules (
    echo Instalando dependencias do Frontend (primeira vez, pode demorar)...
    call npm install
)

echo.
echo ============================================
echo   Sistema iniciando...
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:3001
echo   API Docs: http://localhost:3001/docs
echo.
echo   Login padrao:
echo   Email: admin@charutos.com
echo   Senha: admin123
echo ============================================
echo.

:: Abrir o navegador apos alguns segundos
timeout /t 4 /nobreak >nul
start http://localhost:3000

call npm run dev
pause
