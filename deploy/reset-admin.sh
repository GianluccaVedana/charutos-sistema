#!/bin/bash
# Executa NO SERVIDOR para redefinir a senha do admin
# Uso: ssh root@<servidor> "bash /opt/charutos-sistema/deploy/reset-admin.sh"

DB="/opt/charutos-sistema/backend/charutos.db"
VENV="/opt/charutos-venv"

python3 - <<'EOF'
import sys
sys.path.insert(0, "/opt/charutos-sistema/backend/src")
import bcrypt, sqlite3

DB = "/opt/charutos-sistema/backend/charutos.db"
nova_senha = "admin123"
hashed = bcrypt.hashpw(nova_senha.encode(), bcrypt.gensalt()).decode()

conn = sqlite3.connect(DB)
cur = conn.cursor()
cur.execute("UPDATE usuarios SET senha=?, ativo=1 WHERE email='admin@charutos.com'", (hashed,))
if cur.rowcount == 0:
    cur.execute("INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?,?,?,?)",
                ("Administrador", "admin@charutos.com", hashed, "admin"))
    print("Usuário admin criado com sucesso.")
else:
    print("Senha do admin redefinida com sucesso.")
conn.commit()
conn.close()
EOF
