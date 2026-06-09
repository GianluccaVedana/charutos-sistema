import sqlite3
import os
import bcrypt as _bcrypt

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'charutos.db')


class pwd_context:
    @staticmethod
    def hash(password: str) -> str:
        return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

    @staticmethod
    def verify(password: str, hashed: str) -> bool:
        return _bcrypt.checkpw(password.encode(), hashed.encode())


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _migrate(conn):
    """Adiciona novas colunas sem quebrar dados existentes."""
    migrations = [
        "ALTER TABLE produtos ADD COLUMN tipo_charuto TEXT",
        "ALTER TABLE produtos ADD COLUMN vitola TEXT",
        "ALTER TABLE produtos ADD COLUMN intensidade TEXT",
        "ALTER TABLE produtos ADD COLUMN foto_filename TEXT",
        "ALTER TABLE clientes ADD COLUMN portal_token TEXT",
        "ALTER TABLE consignacoes ADD COLUMN remessa_id INTEGER",
        "ALTER TABLE usuarios ADD COLUMN cliente_id INTEGER",
    ]
    for sql in migrations:
        try:
            conn.execute(sql)
        except Exception:
            pass

    # Corrige registros de contas_receber com valor_bruto corrompido (bug de multiplicação string*int)
    try:
        conn.execute("""
            UPDATE contas_receber SET valor_bruto = (
                SELECT CAST(v.qtd_vendida AS REAL) * CAST(v.preco_unit AS REAL)
                FROM vendas v WHERE v.codigo = contas_receber.documento_ref
            )
            WHERE valor_bruto > 1000000
            AND EXISTS (SELECT 1 FROM vendas v WHERE v.codigo = contas_receber.documento_ref)
        """)
    except Exception:
        pass

    conn.commit()


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.executescript("""
    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        perfil TEXT NOT NULL DEFAULT 'vendas',
        ativo INTEGER DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL,
        descricao TEXT NOT NULL,
        marca TEXT,
        dimensoes TEXT,
        origem TEXT,
        unidade INTEGER DEFAULT 1,
        preco_fob REAL DEFAULT 0,
        frete_unit REAL DEFAULT 0,
        impostos_unit REAL DEFAULT 0,
        outros_custos REAL DEFAULT 0,
        preco_venda REAL DEFAULT 0,
        estoque_minimo INTEGER DEFAULT 0,
        observacoes TEXT,
        link_imagem TEXT,
        tipo_charuto TEXT,
        vitola TEXT,
        intensidade TEXT,
        foto_filename TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE,
        nome TEXT NOT NULL,
        cpf_cnpj TEXT,
        contato TEXT,
        telefone TEXT,
        email TEXT,
        endereco TEXT,
        cidade TEXT,
        estado TEXT,
        cep TEXT,
        observacoes TEXT,
        portal_token TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produto_sku TEXT NOT NULL,
        tipo TEXT NOT NULL,
        quantidade REAL NOT NULL,
        data DATETIME DEFAULT CURRENT_TIMESTAMP,
        referencia_id INTEGER,
        referencia_tipo TEXT,
        observacoes TEXT
    );

    CREATE TABLE IF NOT EXISTS estoque_inicial (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        produto_sku TEXT UNIQUE NOT NULL,
        quantidade REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS remessas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE,
        cliente_id INTEGER NOT NULL,
        data_envio DATE NOT NULL,
        observacoes TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS consignacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE,
        data_envio DATE NOT NULL,
        cliente_id INTEGER NOT NULL,
        produto_sku TEXT NOT NULL,
        qtd_enviada REAL NOT NULL,
        preco_unit REAL DEFAULT 0,
        frete REAL DEFAULT 0,
        qtd_vendida REAL DEFAULT 0,
        qtd_devolvida REAL DEFAULT 0,
        data_fechamento DATE,
        observacoes TEXT,
        remessa_id INTEGER REFERENCES remessas(id),
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE,
        data_venda DATE NOT NULL,
        cliente_id INTEGER,
        produto_sku TEXT NOT NULL,
        qtd_vendida REAL NOT NULL,
        preco_unit REAL NOT NULL,
        frete REAL DEFAULT 0,
        origem TEXT DEFAULT 'Estoque',
        forma_pagamento TEXT DEFAULT 'À Vista',
        observacoes TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fluxo_caixa (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data DATE NOT NULL,
        tipo TEXT NOT NULL,
        categoria TEXT,
        documento_ref TEXT,
        cliente_id INTEGER,
        descricao TEXT,
        entradas REAL DEFAULT 0,
        saidas REAL DEFAULT 0,
        forma_pagamento TEXT,
        observacoes TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contas_receber (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        codigo TEXT UNIQUE,
        cliente_id INTEGER NOT NULL,
        origem TEXT,
        documento_ref TEXT,
        data_emissao DATE NOT NULL,
        vencimento DATE NOT NULL,
        valor_bruto REAL DEFAULT 0,
        frete REAL DEFAULT 0,
        valor_recebido REAL DEFAULT 0,
        observacoes TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pedidos_reposicao (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_id INTEGER NOT NULL,
        produto_sku TEXT NOT NULL,
        quantidade INTEGER NOT NULL,
        observacoes TEXT,
        status TEXT DEFAULT 'pendente',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)

    _migrate(conn)

    admin = cur.execute("SELECT id FROM usuarios WHERE email='admin@charutos.com'").fetchone()
    if not admin:
        hashed = pwd_context.hash("admin123")
        cur.execute("INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?,?,?,?)",
                    ("Administrador", "admin@charutos.com", hashed, "admin"))
    conn.commit()
    conn.close()
