# Publicar no Replit + UptimeRobot + Netlify

> Resultado: sistema online 24/7, grátis, sem deixar o PC ligado.

---

## ETAPA 1 — Backend no Replit (5 min)

### 1. Criar conta
Acesse **replit.com** → clique em **Sign Up** → pode entrar com Google.

### 2. Criar novo Repl
- Clique no botão **"+ Create Repl"**
- Em **Template**, escolha **Python**
- Em **Title**, coloque: `charutos-backend`
- Clique **Create Repl**

### 3. Subir os arquivos
- No painel esquerdo (Files), clique nos **3 pontinhos ⋯** → **Upload folder**
- Selecione a pasta `backend` do projeto **OU** faça assim:
  - Clique nos **3 pontinhos ⋯** → **Upload file**
  - Suba o arquivo `DEPLOY_replit.zip`
  - No Shell (aba inferior), execute: `unzip DEPLOY_replit.zip`

Ao final, você deve ter esta estrutura:
```
charutos-backend/
├── .replit
├── replit.nix
├── requirements.txt
└── src/
    ├── main.py
    ├── database.py
    ├── auth.py
    └── seed.py
```

### 4. Instalar dependências e rodar
- Clique no botão verde **▶ Run** no topo
- O Replit vai instalar tudo automaticamente e iniciar o servidor
- Aguarde aparecer no console: `Uvicorn running on http://0.0.0.0:8080`

### 5. Pegar a URL pública
- No painel direito, aparece uma janela com a URL do seu app
- Será algo como: `https://charutos-backend.seuusuario.repl.co`
- **Copie essa URL** — você vai precisar dela

### 6. Testar
Abra no navegador:
```
https://charutos-backend.seuusuario.repl.co/api/health
```
Deve retornar: `{"status":"ok"}`

Documentação automática da API:
```
https://charutos-backend.seuusuario.repl.co/docs
```

---

## ETAPA 2 — Manter online com UptimeRobot (2 min)

Sem isso, o Replit dorme após 5 minutos sem uso.

### 1. Criar conta
Acesse **uptimerobot.com** → **Register for FREE**

### 2. Adicionar monitor
- Clique em **"+ Add New Monitor"**
- **Monitor Type:** HTTP(s)
- **Friendly Name:** Charutos API
- **URL:** `https://charutos-backend.seuusuario.repl.co/api/health`
- **Monitoring Interval:** 5 minutes
- Clique **Create Monitor**

Pronto. O UptimeRobot vai pingar o servidor a cada 5 min e ele nunca vai dormir.

---

## ETAPA 3 — Frontend no Netlify (3 min)

### 1. Atualizar a URL do backend
Abra o arquivo `frontend/.env.local` e coloque a URL do Replit:
```
VITE_API_URL=https://charutos-backend.seuusuario.repl.co
```

### 2. Gerar o build do frontend
Execute o script `preparar-deploy.bat` na pasta do projeto.
Isso gera a pasta `frontend/dist/` com o site compilado.

### 3. Subir no Netlify
- Acesse **netlify.com** → faça login (pode usar Google)
- Na página inicial, **arraste a pasta `frontend/dist/`** para a área de drop
- Em segundos você recebe uma URL como: `https://charutos-premium.netlify.app`

### 4. (Opcional) Personalizar o nome
- Em **Site settings → Change site name**
- Coloque algo como `charutos-premium` → a URL fica `charutos-premium.netlify.app`

---

## Resultado Final

| O que | Onde | URL |
|-------|------|-----|
| Sistema (frontend) | Netlify | `https://charutos-premium.netlify.app` |
| API (backend) | Replit | `https://charutos-backend.seuusuario.repl.co` |
| Banco de dados | Replit (SQLite) | Arquivo local no Replit |

**Login:** `admin@charutos.com` / `admin123`

---

## Atualizar o sistema no futuro

Quando fizer mudanças e quiser publicar:

1. **Backend:** No Replit, clique nos arquivos alterados → **Upload** → **Restart** o Repl
2. **Frontend:** Rode `preparar-deploy.bat` novamente → arraste `dist/` no Netlify novamente
