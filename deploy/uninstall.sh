#!/bin/bash
set -e

echo ""
echo "======================================================"
echo "  REMOVER CHARUTOS PREMIUM DO SERVIDOR"
echo "======================================================"
echo ""

read -p "Tem certeza que deseja remover a aplicacao? (s/n): " confirm
if [ "$confirm" != "s" ] && [ "$confirm" != "S" ]; then
    echo "Operacao cancelada."
    exit 0
fi

# ── 1. Parar e remover serviço systemd ──────────────────
echo "[1/4] Parando e removendo servico..."
systemctl stop charutos 2>/dev/null && echo "  Servico parado." || echo "  Servico nao estava rodando."
systemctl disable charutos 2>/dev/null || true
rm -f /etc/systemd/system/charutos.service
systemctl daemon-reload
echo "  Servico removido."

# ── 2. Remover configuração Nginx ───────────────────────
echo "[2/4] Removendo configuracao do Nginx..."
rm -f /etc/nginx/sites-enabled/charutos
rm -f /etc/nginx/sites-available/charutos
nginx -t && systemctl reload nginx
echo "  Nginx reconfigurado."

# ── 3. Revogar certificado SSL ──────────────────────────
echo "[3/4] Verificando certificado SSL..."
if certbot certificates 2>/dev/null | grep -q "charutos.crescerassessoriapb.com"; then
    certbot delete --cert-name charutos.crescerassessoriapb.com --non-interactive
    echo "  Certificado SSL removido."
else
    echo "  Nenhum certificado SSL encontrado."
fi

# ── 4. Remover arquivos da aplicação ────────────────────
echo "[4/4] Removendo arquivos da aplicacao..."
rm -rf /var/www/charutos
echo "  Arquivos removidos."

echo ""
echo "======================================================"
echo "  APLICACAO REMOVIDA COM SUCESSO!"
echo "======================================================"
echo ""
