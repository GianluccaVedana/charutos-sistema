@echo off
title Charutos - Instalacao
color 0B
echo ============================================
echo   INSTALACAO - Charutos Premium
echo ============================================
echo.

:: Backend Python
echo [1/3] Instalando dependencias Python (Backend)...
cd /d "%~dp0backend"
pip install -r requirements.txt
echo.

:: Banco de dados
echo [2/3] Inicializando banco de dados e dados de exemplo...
cd src
python seed.py
cd ..
echo.

:: Frontend
echo [3/3] Instalando dependencias do Frontend (React)...
cd /d "%~dp0frontend"
call npm install
echo.

echo ============================================
echo   Instalacao concluida!
echo   Execute "iniciar.bat" para rodar o sistema
echo ============================================
pause
