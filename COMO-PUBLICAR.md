# Como Publicar — PythonAnywhere (Backend) + Netlify (Frontend)

> Ambos gratuitos, sempre online, sem precisar deixar o PC ligado.

---

## PARTE 1 — Backend no PythonAnywhere

### Passo 1 — Criar conta
Acesse **pythonanywhere.com** → clique em **"Start running Python online in less than a minute!"**  
Escolha **"Create a Beginner account"** (gratuito).

Seu usuário vira a URL: `https://SEU_USUARIO.pythonanywhere.com`

---

### Passo 2 — Abrir o console Bash
No painel do PythonAnywhere → clique em **"$ Bash"** (ou vá em **Consoles → Bash**).

---

### Passo 3 — Criar pasta e subir arquivos
No console Bash, execute:

```bash
mkdir ~/charutos
```

Agora vá em **Files** (menu do topo) → navegue até `/home/SEU_USUARIO/charutos/`.  
Clique em **"Upload a file"** e suba o arquivo `DEPLOY_backend.zip`.

Volte ao console Bash e descompacte:

```bash
cd ~/charutos
unzip DEPLOY_backend.zip
```

---

### Passo 4 — Instalar dependências
Ainda no console Bash:

```bash
cd ~/charutos
pip3.11 install -r requirements.txt --user
```

> Se Python 3.11 não existir, tente `pip3.10` ou `pip3`.

---

### Passo 5 — Inicializar o banco de dados
```bash
cd ~/charutos/src
python3.11 seed.py
```

Isso cria o banco `charutos.db` com os 20 produtos e 11 clientes.

---

### Passo 6 — Configurar o Web App
No painel → clique em **"Web"** → **"Add a new web app"** → **Next** → **"Manual configuration"** → escolha **Python 3.11** → **Next**.

Na página de configuração que abrir:

**Source code:**
```
/home/SEU_USUARIO/charutos
```

**WSGI configuration file:** clique no link do arquivo `.wsgi` → substitua TODO o conteúdo por:

```python
import sys, os

USERNAME = "SEU_USUARIO"  # ← troque pelo seu usuário real
PROJECT_PATH = f"/home/{USERNAME}/charutos/src"

sys.path.insert(0, PROJECT_PATH)
os.chdir(PROJECT_PATH)

from a2wsgi import ASGIMiddleware
from main import app

application = ASGIMiddleware(app)
```

Salve o arquivo (botão Save ou Ctrl+S).

---

### Passo 7 — Ativar o app
De volta na aba **Web** → clique no botão verde **"Reload"**.

Teste abrindo: `https://SEU_USUARIO.pythonanywhere.com/api/health`

Deve retornar: `{"status": "ok"}`

---

## PARTE 2 — Frontend no Netlify

### Passo 1 — Preparar o build
Execute o script `preparar-deploy.bat` na pasta do projeto.  
Isso gera a pasta `frontend/dist/` com todos os arquivos compilados.

### Passo 2 — Configurar a URL do backend
Antes do build, edite `frontend/.env.local`:

```
VITE_API_URL=https://SEU_USUARIO.pythonanywhere.com
```

Depois execute o `preparar-deploy.bat` para gerar o build atualizado.

### Passo 3 — Subir no Netlify
1. Acesse **netlify.com** → crie conta gratuita
2. Na página inicial, arraste a pasta `frontend/dist/` para a área indicada
3. Pronto! Em segundos você recebe uma URL como `https://abc123.netlify.app`

---

## Resultado Final

| Serviço  | URL                                          | Custo  |
|----------|----------------------------------------------|--------|
| Backend  | `https://SEU_USUARIO.pythonanywhere.com`     | Grátis |
| Frontend | `https://abc123.netlify.app`                 | Grátis |

**Login:** `admin@charutos.com` / `admin123`

---

## Limites do plano gratuito PythonAnywhere

| Recurso         | Limite gratuito        |
|-----------------|------------------------|
| Web apps        | 1                      |
| CPU/dia         | 100 segundos (suficiente para uso leve) |
| Disco           | 512 MB                 |
| Tráfego         | Ilimitado              |
| HTTPS           | Incluído               |
| Banco de dados  | SQLite (arquivo local) |

> Para uso mais intenso, o plano **Hacker** custa ~$5/mês e remove os limites de CPU.
