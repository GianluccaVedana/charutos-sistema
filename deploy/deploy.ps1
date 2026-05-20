# ============================================================
#  DEPLOY - Charutos Premium
#  Servidor: 200.234.218.15 | Usuario: root
#  Dominio:  charutos.crescerassessoriapb.com
# ============================================================

$SERVER   = "200.234.218.15"
$USER     = "root"
$REMOTE   = "${USER}@${SERVER}"
$APP_DIR  = "/var/www/charutos"

# Pasta raiz do projeto (onde fica backend/ e frontend/)
$LOCAL = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  DEPLOY CHARUTOS PREMIUM" -ForegroundColor Cyan
Write-Host "  Servidor: $SERVER" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# ── Verifica se ssh esta disponivel ─────────────────────
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Host "ERRO: ssh nao encontrado. Instale o OpenSSH ou use Git Bash." -ForegroundColor Red
    exit 1
}

# ── Passo 1: Criar estrutura no servidor ────────────────
Write-Host "[1/5] Criando estrutura no servidor..." -ForegroundColor Yellow
ssh $REMOTE "mkdir -p $APP_DIR/backend/src $APP_DIR/frontend/dist"

# ── Passo 2: Enviar backend ──────────────────────────────
Write-Host "[2/5] Enviando backend..." -ForegroundColor Yellow
scp -r "$LOCAL\backend\src\*"       "${REMOTE}:${APP_DIR}/backend/src/"
scp    "$LOCAL\backend\requirements.txt" "${REMOTE}:${APP_DIR}/backend/"
# Envia o banco apenas se existir localmente
if (Test-Path "$LOCAL\backend\charutos.db") {
    scp "$LOCAL\backend\charutos.db" "${REMOTE}:${APP_DIR}/backend/"
    Write-Host "  Banco de dados enviado." -ForegroundColor Green
} else {
    Write-Host "  Banco sera criado automaticamente no servidor." -ForegroundColor DarkYellow
}

# ── Passo 3: Enviar frontend (build) ────────────────────
Write-Host "[3/5] Enviando frontend (dist/)..." -ForegroundColor Yellow
if (-not (Test-Path "$LOCAL\frontend\dist\index.html")) {
    Write-Host "  AVISO: dist/ nao encontrado. Gerando build..." -ForegroundColor DarkYellow
    Set-Location "$LOCAL\frontend"
    npm run build
    Set-Location $PSScriptRoot
}
scp -r "$LOCAL\frontend\dist\." "${REMOTE}:${APP_DIR}/frontend/dist/"

# ── Passo 4: Enviar e executar script de setup ──────────
Write-Host "[4/5] Enviando script de configuracao..." -ForegroundColor Yellow
scp "$PSScriptRoot\setup.sh" "${REMOTE}:/tmp/setup.sh"

Write-Host "[5/5] Executando setup no servidor (pode demorar alguns minutos)..." -ForegroundColor Yellow
ssh $REMOTE "chmod +x /tmp/setup.sh && /tmp/setup.sh"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  DEPLOY FINALIZADO!" -ForegroundColor Green
Write-Host "  Acesse: http://charutos.crescerassessoriapb.com" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
