# Como fazer o Deploy

**Servidor:** 200.234.218.15  
**Usuário:** root  
**Domínio:** charutos.crescerassessoriapb.com

---

## Opção 1 — Script automático (recomendado)

Abra o **PowerShell** ou **Terminal do Windows** e execute:

```powershell
cd "C:\Users\gianl\OneDrive\Desktop\projeto\charutos-sistema\deploy"
.\deploy.ps1
```

O script vai pedir a senha do servidor em alguns momentos (senha do root). Todo o resto é automático.

---

## Opção 2 — Manual passo a passo

### No seu computador (enviar arquivos):

```bash
# Criar pastas no servidor
ssh root@200.234.218.15 "mkdir -p /var/www/charutos/backend/src /var/www/charutos/frontend/dist"

# Enviar backend
scp -r backend/src/* root@200.234.218.15:/var/www/charutos/backend/src/
scp backend/requirements.txt root@200.234.218.15:/var/www/charutos/backend/
scp backend/charutos.db root@200.234.218.15:/var/www/charutos/backend/

# Enviar frontend
scp -r frontend/dist/. root@200.234.218.15:/var/www/charutos/frontend/dist/

# Enviar script de setup
scp deploy/setup.sh root@200.234.218.15:/tmp/setup.sh
```

### No servidor:

```bash
ssh root@200.234.218.15
chmod +x /tmp/setup.sh
/tmp/setup.sh
```

---

## Antes de rodar o SSL

Configure o DNS do domínio `charutos.crescerassessoriapb.com` para apontar para o IP `200.234.218.15` no seu provedor de domínio (registro A).

---

## Após o deploy

| Item | Valor |
|------|-------|
| URL  | https://charutos.crescerassessoriapb.com |
| Login | admin@charutos.com |
| Senha | admin123 |

## Comandos úteis no servidor

```bash
# Ver status do backend
systemctl status charutos

# Ver logs em tempo real
journalctl -u charutos -f

# Reiniciar backend
systemctl restart charutos

# Renovar SSL manualmente
certbot renew
```
