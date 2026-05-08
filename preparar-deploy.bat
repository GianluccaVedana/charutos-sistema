@echo off
title Preparar arquivos para deploy
color 0B

echo ============================================
echo   PREPARAR DEPLOY - Charutos Premium
echo ============================================
echo.
echo ANTES de continuar, verifique se o arquivo
echo frontend\.env.local tem a URL do Replit:
echo.
echo   VITE_API_URL=https://SEU-REPL.repl.co
echo.
set /p confirm="Ja configurou a URL? (S/N): "
if /i not "%confirm%"=="S" (
    echo Abra o arquivo frontend\.env.local e configure a URL.
    start notepad "%~dp0frontend\.env.local"
    pause
    exit /b 0
)

echo.
echo [1/2] Gerando build do frontend...
cd /d "%~dp0frontend"
call npm run build
if errorlevel 1 (
    echo [ERRO] Build falhou!
    pause
    exit /b 1
)
echo Build concluido! Pasta: frontend\dist\
echo.

echo [2/2] Compactando backend para Replit...
cd /d "%~dp0"
Compress-Archive -Path "backend\src", "backend\requirements.txt", "backend\.replit", "backend\replit.nix" -DestinationPath "DEPLOY_replit.zip" -Force 2>nul
powershell -command "Compress-Archive -Path 'backend\src','backend\requirements.txt','backend\.replit','backend\replit.nix' -DestinationPath 'DEPLOY_replit.zip' -Force"
echo Backend compactado em DEPLOY_replit.zip
echo.

echo ============================================
echo   Pronto! Proximos passos:
echo.
echo   1. Suba DEPLOY_replit.zip no Replit
echo   2. Arraste frontend\dist\ no Netlify
echo.
echo   Guia completo: PUBLICAR-REPLIT.md
echo ============================================
pause
