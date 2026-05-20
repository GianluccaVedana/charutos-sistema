import sys, os
sys.path.insert(0, '/var/www/charutos/backend/src')

import sqlite3
import bcrypt

DB = '/var/www/charutos/backend/charutos.db'
conn = sqlite3.connect(DB)

# Mostra usuarios
rows = conn.execute('SELECT id, email, perfil, ativo FROM usuarios').fetchall()
print("Usuarios no banco:")
for r in rows:
    print(" ", r)

# Recria senha do admin
nova_senha = bcrypt.hashpw(b'admin123', bcrypt.gensalt()).decode()
conn.execute("UPDATE usuarios SET senha=? WHERE email='admin@charutos.com'", (nova_senha,))

# Garante que admin existe
if not conn.execute("SELECT id FROM usuarios WHERE email='admin@charutos.com'").fetchone():
    conn.execute("INSERT INTO usuarios (nome, email, senha, perfil, ativo) VALUES ('Administrador','admin@charutos.com',?,'admin',1)", (nova_senha,))
    print("Admin criado.")
else:
    print("Senha do admin redefinida para: admin123")

conn.commit()
conn.close()
print("Pronto!")
