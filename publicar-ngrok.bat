@echo off
title Charutos Premium - Publicar com ngrok
color 0E

echo ============================================
echo   PUBLICAR COM NGROK - Charutos Premium
echo ============================================
echo.
echo Requisitos:
echo   1. Sistema ja rodando (iniciar.bat executado)
echo   2. ngrok instalado e autenticado
echo.

:: Verificar se ngrok esta disponivel
where ngrok >nul 2>&1
if errorlevel 1 (
    echo [ERRO] ngrok nao encontrado no PATH.
    echo.
    echo Passos:
    echo   1. Baixe em: https://ngrok.com/download
    echo   2. Extraia ngrok.exe para C:\Windows ou pasta do projeto
    echo   3. Execute: ngrok config add-authtoken SEU_TOKEN
    echo   4. Crie conta gratuita em ngrok.com para obter o token
    echo.
    pause
    exit /b 1
)

echo Expondo Backend (porta 3001)...
start "ngrok-backend" ngrok http 3001 --log=stdout

echo.
echo Aguardando ngrok iniciar...
timeout /t 4 /nobreak >nul

echo.
echo ============================================
echo Verifique a URL publica do backend em:
echo   http://localhost:4040  (painel ngrok)
echo.
echo Depois atualize o arquivo:
echo   frontend\.env.local
echo.
echo Coloque a URL do ngrok assim (sem / no final):
echo   VITE_API_URL=https://abc123.ngrok-free.app
echo.
echo Depois reinicie o frontend (npm run dev)
echo ============================================
echo.

:: Abrir painel do ngrok
start http://localhost:4040

pause
