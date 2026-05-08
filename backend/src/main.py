import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Any
import sqlite3
from database import get_db, init_db, pwd_context
from auth import create_token, get_usuario_atual, exigir_perfil  # noqa

app = FastAPI(title="Charutos Premium API")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def rows_to_list(rows):
    return [dict(r) for r in rows]


def row_or_404(row, msg="Não encontrado"):
    if not row:
        raise HTTPException(404, msg)
    return dict(row)


@app.on_event("startup")
def startup():
    init_db()


# ─── AUTH ────────────────────────────────────────────────────────────────────

@app.post("/api/auth/login")
def login(body: dict = Body(...)):
    email = body.get("email")
    senha = body.get("senha")
    conn = get_db()
    u = conn.execute("SELECT * FROM usuarios WHERE email=? AND ativo=1", (email,)).fetchone()
    conn.close()
    if not u or not pwd_context.verify(senha, u["senha"]):
        raise HTTPException(401, "Credenciais inválidas")
    token = create_token({"id": u["id"], "nome": u["nome"], "email": u["email"], "perfil": u["perfil"]})
    return {"token": token, "usuario": {"id": u["id"], "nome": u["nome"], "email": u["email"], "perfil": u["perfil"]}}


@app.get("/api/auth/me")
def me(usuario=Depends(get_usuario_atual)):
    return usuario


@app.get("/api/auth/usuarios")
def listar_usuarios(usuario=Depends(exigir_perfil("admin"))):
    conn = get_db()
    rows = conn.execute("SELECT id,nome,email,perfil,ativo,criado_em FROM usuarios").fetchall()
    conn.close()
    return rows_to_list(rows)


@app.post("/api/auth/usuarios")
def criar_usuario(body: dict = Body(...), usuario=Depends(exigir_perfil("admin"))):
    conn = get_db()
    hashed = pwd_context.hash(body["senha"])
    try:
        cur = conn.execute("INSERT INTO usuarios (nome,email,senha,perfil) VALUES (?,?,?,?)",
                           (body["nome"], body["email"], hashed, body.get("perfil", "vendas")))
        conn.commit()
        return {"id": cur.lastrowid}
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Email já cadastrado")
    finally:
        conn.close()


@app.put("/api/auth/usuarios/{uid}")
def atualizar_usuario(uid: int, body: dict = Body(...), usuario=Depends(exigir_perfil("admin"))):
    conn = get_db()
    if body.get("senha"):
        hashed = pwd_context.hash(body["senha"])
        conn.execute("UPDATE usuarios SET nome=?,email=?,perfil=?,ativo=?,senha=? WHERE id=?",
                     (body["nome"], body["email"], body["perfil"], body.get("ativo", 1), hashed, uid))
    else:
        conn.execute("UPDATE usuarios SET nome=?,email=?,perfil=?,ativo=? WHERE id=?",
                     (body["nome"], body["email"], body["perfil"], body.get("ativo", 1), uid))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── PRODUTOS ────────────────────────────────────────────────────────────────

@app.get("/api/produtos")
def listar_produtos(busca: str = "", usuario=Depends(get_usuario_atual)):
    conn = get_db()
    if busca:
        rows = conn.execute(
            "SELECT *, (preco_fob+frete_unit+impostos_unit+outros_custos) AS custo_total FROM produtos WHERE sku LIKE ? OR descricao LIKE ? OR marca LIKE ? ORDER BY sku",
            (f"%{busca}%",) * 3).fetchall()
    else:
        rows = conn.execute("SELECT *, (preco_fob+frete_unit+impostos_unit+outros_custos) AS custo_total FROM produtos ORDER BY sku").fetchall()
    conn.close()
    return rows_to_list(rows)


@app.get("/api/produtos/{sku}")
def get_produto(sku: str, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    row = conn.execute("SELECT *, (preco_fob+frete_unit+impostos_unit+outros_custos) AS custo_total FROM produtos WHERE sku=?", (sku,)).fetchone()
    conn.close()
    return row_or_404(row)


@app.post("/api/produtos")
def criar_produto(body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    try:
        cur = conn.execute("""
            INSERT INTO produtos (sku,descricao,marca,dimensoes,origem,unidade,preco_fob,frete_unit,impostos_unit,outros_custos,preco_venda,estoque_minimo,observacoes,link_imagem)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (body["sku"], body["descricao"], body.get("marca"), body.get("dimensoes"), body.get("origem"),
              body.get("unidade", 1), body.get("preco_fob", 0), body.get("frete_unit", 0),
              body.get("impostos_unit", 0), body.get("outros_custos", 0), body.get("preco_venda", 0),
              body.get("estoque_minimo", 0), body.get("observacoes"), body.get("link_imagem")))
        conn.execute("INSERT OR IGNORE INTO estoque_inicial (produto_sku, quantidade) VALUES (?,0)", (body["sku"],))
        conn.commit()
        return {"id": cur.lastrowid}
    except sqlite3.IntegrityError:
        raise HTTPException(409, "SKU já cadastrado")
    finally:
        conn.close()


@app.put("/api/produtos/{sku}")
def atualizar_produto(sku: str, body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("""
        UPDATE produtos SET descricao=?,marca=?,dimensoes=?,origem=?,unidade=?,preco_fob=?,frete_unit=?,
        impostos_unit=?,outros_custos=?,preco_venda=?,estoque_minimo=?,observacoes=?,link_imagem=?,atualizado_em=CURRENT_TIMESTAMP
        WHERE sku=?
    """, (body.get("descricao"), body.get("marca"), body.get("dimensoes"), body.get("origem"),
          body.get("unidade", 1), body.get("preco_fob", 0), body.get("frete_unit", 0),
          body.get("impostos_unit", 0), body.get("outros_custos", 0), body.get("preco_venda", 0),
          body.get("estoque_minimo", 0), body.get("observacoes"), body.get("link_imagem"), sku))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/produtos/{sku}")
def deletar_produto(sku: str, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("DELETE FROM produtos WHERE sku=?", (sku,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── CLIENTES ────────────────────────────────────────────────────────────────

@app.get("/api/clientes")
def listar_clientes(busca: str = "", usuario=Depends(get_usuario_atual)):
    conn = get_db()
    if busca:
        rows = conn.execute(
            "SELECT * FROM clientes WHERE nome LIKE ? OR telefone LIKE ? OR email LIKE ? OR cidade LIKE ? ORDER BY nome",
            (f"%{busca}%",) * 4).fetchall()
    else:
        rows = conn.execute("SELECT * FROM clientes ORDER BY nome").fetchall()
    conn.close()
    return rows_to_list(rows)


@app.get("/api/clientes/{cid}")
def get_cliente(cid: int, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    cliente = conn.execute("SELECT * FROM clientes WHERE id=?", (cid,)).fetchone()
    if not cliente:
        raise HTTPException(404)
    vendas = conn.execute("""
        SELECT v.*, p.descricao AS produto_nome FROM vendas v JOIN produtos p ON v.produto_sku=p.sku
        WHERE v.cliente_id=? ORDER BY v.data_venda DESC LIMIT 20
    """, (cid,)).fetchall()
    consig = conn.execute("""
        SELECT c.*, p.descricao AS produto_nome FROM consignacoes c JOIN produtos p ON c.produto_sku=p.sku
        WHERE c.cliente_id=? ORDER BY c.data_envio DESC
    """, (cid,)).fetchall()
    conn.close()
    return {**dict(cliente), "vendas": rows_to_list(vendas), "consignacoes": rows_to_list(consig)}


@app.post("/api/clientes")
def criar_cliente(body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    cur = conn.execute("""
        INSERT INTO clientes (nome,cpf_cnpj,contato,telefone,email,endereco,cidade,estado,cep,observacoes)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (body["nome"], body.get("cpf_cnpj"), body.get("contato"), body.get("telefone"), body.get("email"),
          body.get("endereco"), body.get("cidade"), body.get("estado"), body.get("cep"), body.get("observacoes")))
    lid = cur.lastrowid
    conn.execute("UPDATE clientes SET codigo = 'CLI-' || printf('%04d', id) WHERE id=?", (lid,))
    conn.commit()
    conn.close()
    return {"id": lid}


@app.put("/api/clientes/{cid}")
def atualizar_cliente(cid: int, body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("""
        UPDATE clientes SET nome=?,cpf_cnpj=?,contato=?,telefone=?,email=?,endereco=?,cidade=?,estado=?,cep=?,observacoes=?
        WHERE id=?
    """, (body.get("nome"), body.get("cpf_cnpj"), body.get("contato"), body.get("telefone"), body.get("email"),
          body.get("endereco"), body.get("cidade"), body.get("estado"), body.get("cep"), body.get("observacoes"), cid))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/clientes/{cid}")
def deletar_cliente(cid: int, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("DELETE FROM clientes WHERE id=?", (cid,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── ESTOQUE ─────────────────────────────────────────────────────────────────

@app.get("/api/estoque")
def listar_estoque(usuario=Depends(get_usuario_atual)):
    conn = get_db()
    rows = conn.execute("""
        SELECT
            p.sku, p.descricao, p.marca, p.preco_venda,
            (p.preco_fob+p.frete_unit+p.impostos_unit+p.outros_custos) AS custo_unit,
            p.estoque_minimo,
            COALESCE(ei.quantidade,0) AS estoque_inicial,
            COALESCE((SELECT SUM(quantidade) FROM estoque_movimentacoes WHERE produto_sku=p.sku AND tipo='entrada'),0) AS entradas,
            COALESCE((SELECT SUM(qtd_vendida) FROM vendas WHERE produto_sku=p.sku AND origem='Estoque'),0) AS saidas_venda,
            COALESCE((SELECT SUM(qtd_enviada) FROM consignacoes WHERE produto_sku=p.sku),0) AS enviado_consignacao,
            COALESCE((SELECT SUM(qtd_devolvida) FROM consignacoes WHERE produto_sku=p.sku),0) AS retorno_consignacao,
            COALESCE((SELECT SUM(qtd_vendida) FROM consignacoes WHERE produto_sku=p.sku),0) AS vendido_consignacao
        FROM produtos p
        LEFT JOIN estoque_inicial ei ON ei.produto_sku=p.sku
        ORDER BY p.sku
    """).fetchall()
    conn.close()

    result = []
    for r in rows:
        d = dict(r)
        d["saldo_em_maos"] = d["estoque_inicial"] + d["entradas"] - d["saidas_venda"] - d["enviado_consignacao"] + d["retorno_consignacao"]
        d["saldo_com_clientes"] = d["enviado_consignacao"] - d["retorno_consignacao"] - d["vendido_consignacao"]
        d["estoque_total"] = d["saldo_em_maos"] + d["saldo_com_clientes"]
        d["valor_estoque"] = d["estoque_total"] * d["custo_unit"]
        d["alerta"] = "SEM PARÂMETRO" if not d["estoque_minimo"] else ("REPOR" if d["estoque_total"] <= d["estoque_minimo"] else "OK")
        result.append(d)
    return result


@app.post("/api/estoque/entrada")
def registrar_entrada(body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("INSERT INTO estoque_movimentacoes (produto_sku,tipo,quantidade,observacoes) VALUES (?,'entrada',?,?)",
                 (body["produto_sku"], body["quantidade"], body.get("observacoes")))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/estoque/estoque-inicial")
def set_estoque_inicial(body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO estoque_inicial (produto_sku,quantidade) VALUES (?,?)",
                 (body["produto_sku"], body["quantidade"]))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/estoque/movimentacoes")
def listar_movimentacoes(sku: str = "", usuario=Depends(get_usuario_atual)):
    conn = get_db()
    if sku:
        rows = conn.execute("SELECT m.*,p.descricao FROM estoque_movimentacoes m JOIN produtos p ON m.produto_sku=p.sku WHERE m.produto_sku=? ORDER BY m.data DESC LIMIT 100", (sku,)).fetchall()
    else:
        rows = conn.execute("SELECT m.*,p.descricao FROM estoque_movimentacoes m JOIN produtos p ON m.produto_sku=p.sku ORDER BY m.data DESC LIMIT 100").fetchall()
    conn.close()
    return rows_to_list(rows)


# ─── CONSIGNAÇÕES ────────────────────────────────────────────────────────────

@app.get("/api/consignacoes")
def listar_consignacoes(status: str = "", cliente_id: str = "", usuario=Depends(get_usuario_atual)):
    conn = get_db()
    where, params = [], []
    if cliente_id:
        where.append("c.cliente_id=?"); params.append(int(cliente_id))
    if status == "aberto":
        where.append("(c.qtd_enviada-c.qtd_vendida-c.qtd_devolvida)>0")
    elif status == "fechado":
        where.append("(c.qtd_enviada-c.qtd_vendida-c.qtd_devolvida)<=0")
    w = " WHERE " + " AND ".join(where) if where else ""
    rows = conn.execute(f"""
        SELECT c.*, cl.nome AS cliente_nome, cl.telefone AS cliente_telefone,
            p.descricao AS produto_nome, (p.preco_fob+p.frete_unit+p.impostos_unit+p.outros_custos) AS custo_unit,
            (c.qtd_enviada-c.qtd_vendida-c.qtd_devolvida) AS qtd_em_aberto,
            (c.qtd_enviada*c.preco_unit+c.frete) AS valor_potencial,
            CASE WHEN (c.qtd_enviada-c.qtd_vendida-c.qtd_devolvida)<=0 THEN 'Fechado' ELSE 'Aberto' END AS status,
            CASE WHEN (c.qtd_enviada-c.qtd_vendida-c.qtd_devolvida)<=0 THEN 'Fechado'
                 WHEN julianday('now')-julianday(c.data_envio)>30 THEN 'CRÍTICO'
                 WHEN julianday('now')-julianday(c.data_envio)>15 THEN 'ATENÇÃO'
                 ELSE 'OK' END AS alerta,
            CAST(julianday('now')-julianday(c.data_envio) AS INTEGER) AS dias_em_aberto
        FROM consignacoes c
        JOIN clientes cl ON c.cliente_id=cl.id
        JOIN produtos p ON c.produto_sku=p.sku
        {w} ORDER BY c.data_envio DESC
    """, params).fetchall()
    conn.close()
    return rows_to_list(rows)


@app.post("/api/consignacoes")
def criar_consignacao(body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    cur = conn.execute("""
        INSERT INTO consignacoes (data_envio,cliente_id,produto_sku,qtd_enviada,preco_unit,frete,observacoes)
        VALUES (?,?,?,?,?,?,?)
    """, (body["data_envio"], body["cliente_id"], body["produto_sku"], body["qtd_enviada"],
          body.get("preco_unit", 0), body.get("frete", 0), body.get("observacoes")))
    lid = cur.lastrowid
    conn.execute("UPDATE consignacoes SET codigo='CON-'||printf('%04d',id) WHERE id=?", (lid,))
    conn.commit()
    conn.close()
    return {"id": lid}


@app.put("/api/consignacoes/{cid}")
def atualizar_consignacao(cid: int, body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    c = conn.execute("SELECT * FROM consignacoes WHERE id=?", (cid,)).fetchone()
    if not c:
        raise HTTPException(404)
    conn.execute("UPDATE consignacoes SET qtd_vendida=?,qtd_devolvida=?,data_fechamento=?,preco_unit=?,frete=?,observacoes=? WHERE id=?",
                 (body.get("qtd_vendida", c["qtd_vendida"]), body.get("qtd_devolvida", c["qtd_devolvida"]),
                  body.get("data_fechamento", c["data_fechamento"]), body.get("preco_unit", c["preco_unit"]),
                  body.get("frete", c["frete"]), body.get("observacoes", c["observacoes"]), cid))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/consignacoes/{cid}")
def deletar_consignacao(cid: int, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("DELETE FROM consignacoes WHERE id=?", (cid,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── VENDAS ──────────────────────────────────────────────────────────────────

@app.get("/api/vendas")
def listar_vendas(data_inicio: str = "", data_fim: str = "", cliente_id: str = "", sku: str = "", usuario=Depends(get_usuario_atual)):
    conn = get_db()
    where, params = [], []
    if data_inicio: where.append("v.data_venda>=?"); params.append(data_inicio)
    if data_fim: where.append("v.data_venda<=?"); params.append(data_fim)
    if cliente_id: where.append("v.cliente_id=?"); params.append(int(cliente_id))
    if sku: where.append("v.produto_sku=?"); params.append(sku)
    w = " WHERE " + " AND ".join(where) if where else ""
    rows = conn.execute(f"""
        SELECT v.*, cl.nome AS cliente_nome, p.descricao AS produto_nome,
            (p.preco_fob+p.frete_unit+p.impostos_unit+p.outros_custos) AS custo_unit,
            (v.qtd_vendida*(p.preco_fob+p.frete_unit+p.impostos_unit+p.outros_custos)) AS custo_total_venda,
            (v.qtd_vendida*v.preco_unit+COALESCE(v.frete,0)) AS valor_total,
            (v.qtd_vendida*v.preco_unit+COALESCE(v.frete,0)-v.qtd_vendida*(p.preco_fob+p.frete_unit+p.impostos_unit+p.outros_custos)) AS margem_bruta
        FROM vendas v
        LEFT JOIN clientes cl ON v.cliente_id=cl.id
        JOIN produtos p ON v.produto_sku=p.sku
        {w} ORDER BY v.data_venda DESC
    """, params).fetchall()
    conn.close()
    return rows_to_list(rows)


@app.post("/api/vendas")
def criar_venda(body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    cur = conn.execute("""
        INSERT INTO vendas (data_venda,cliente_id,produto_sku,qtd_vendida,preco_unit,frete,origem,forma_pagamento,observacoes)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (body["data_venda"], body.get("cliente_id"), body["produto_sku"], body["qtd_vendida"],
          body["preco_unit"], body.get("frete", 0), body.get("origem", "Estoque"),
          body.get("forma_pagamento", "À Vista"), body.get("observacoes")))
    lid = cur.lastrowid
    conn.execute("UPDATE vendas SET codigo='VEN-'||printf('%04d',id) WHERE id=?", (lid,))

    if body.get("cliente_id"):
        valor_bruto = body["qtd_vendida"] * body["preco_unit"]
        rec = conn.execute("""
            INSERT INTO contas_receber (cliente_id,origem,documento_ref,data_emissao,vencimento,valor_bruto,frete)
            VALUES (?,?,?,?,?,?,?)
        """, (body["cliente_id"], body.get("origem", "Estoque"), f"VEN-{lid:04d}",
              body["data_venda"], body["data_venda"], valor_bruto, body.get("frete", 0)))
        conn.execute("UPDATE contas_receber SET codigo='REC-'||printf('%04d',id) WHERE id=?", (rec.lastrowid,))

    conn.commit()
    conn.close()
    return {"id": lid}


@app.put("/api/vendas/{vid}")
def atualizar_venda(vid: int, body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("""
        UPDATE vendas SET data_venda=?,cliente_id=?,produto_sku=?,qtd_vendida=?,preco_unit=?,frete=?,origem=?,forma_pagamento=?,observacoes=?
        WHERE id=?
    """, (body.get("data_venda"), body.get("cliente_id"), body.get("produto_sku"), body.get("qtd_vendida"),
          body.get("preco_unit"), body.get("frete"), body.get("origem"), body.get("forma_pagamento"),
          body.get("observacoes"), vid))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/vendas/{vid}")
def deletar_venda(vid: int, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("DELETE FROM vendas WHERE id=?", (vid,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── FLUXO CAIXA ─────────────────────────────────────────────────────────────

@app.get("/api/fluxo-caixa")
def listar_fluxo(data_inicio: str = "", data_fim: str = "", tipo: str = "", usuario=Depends(get_usuario_atual)):
    conn = get_db()
    where, params = [], []
    if data_inicio: where.append("f.data>=?"); params.append(data_inicio)
    if data_fim: where.append("f.data<=?"); params.append(data_fim)
    if tipo: where.append("f.tipo=?"); params.append(tipo)
    w = " WHERE " + " AND ".join(where) if where else ""
    rows = conn.execute(f"""
        SELECT f.*, cl.nome AS cliente_nome FROM fluxo_caixa f
        LEFT JOIN clientes cl ON f.cliente_id=cl.id {w} ORDER BY f.data ASC, f.id ASC
    """, params).fetchall()
    conn.close()
    saldo = 0
    result = []
    for r in rows:
        d = dict(r)
        d["saldo_dia"] = (d.get("entradas") or 0) - (d.get("saidas") or 0)
        saldo += d["saldo_dia"]
        d["saldo_acumulado"] = round(saldo, 2)
        result.append(d)
    return result


@app.get("/api/fluxo-caixa/resumo")
def resumo_fluxo(mes: str = "", ano: str = "", usuario=Depends(get_usuario_atual)):
    from datetime import date
    today = date.today()
    m = mes or f"{today.month:02d}"
    a = ano or str(today.year)
    conn = get_db()
    r = conn.execute("""
        SELECT COALESCE(SUM(entradas),0) AS total_entradas, COALESCE(SUM(saidas),0) AS total_saidas,
            COALESCE(SUM(entradas),0)-COALESCE(SUM(saidas),0) AS saldo
        FROM fluxo_caixa WHERE data BETWEEN ? AND ?
    """, (f"{a}-{m}-01", f"{a}-{m}-31")).fetchone()
    cat = conn.execute("""
        SELECT categoria, SUM(entradas) AS entradas, SUM(saidas) AS saidas
        FROM fluxo_caixa WHERE data BETWEEN ? AND ? AND categoria IS NOT NULL GROUP BY categoria
    """, (f"{a}-{m}-01", f"{a}-{m}-31")).fetchall()
    conn.close()
    return {**dict(r), "por_categoria": rows_to_list(cat)}


@app.post("/api/fluxo-caixa")
def criar_fluxo(body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    cur = conn.execute("""
        INSERT INTO fluxo_caixa (data,tipo,categoria,documento_ref,cliente_id,descricao,entradas,saidas,forma_pagamento,observacoes)
        VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (body["data"], body["tipo"], body.get("categoria"), body.get("documento_ref"), body.get("cliente_id"),
          body.get("descricao"), body.get("entradas", 0), body.get("saidas", 0),
          body.get("forma_pagamento"), body.get("observacoes")))
    conn.commit()
    conn.close()
    return {"id": cur.lastrowid}


@app.put("/api/fluxo-caixa/{fid}")
def atualizar_fluxo(fid: int, body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("""
        UPDATE fluxo_caixa SET data=?,tipo=?,categoria=?,documento_ref=?,cliente_id=?,descricao=?,entradas=?,saidas=?,forma_pagamento=?,observacoes=?
        WHERE id=?
    """, (body.get("data"), body.get("tipo"), body.get("categoria"), body.get("documento_ref"),
          body.get("cliente_id"), body.get("descricao"), body.get("entradas", 0), body.get("saidas", 0),
          body.get("forma_pagamento"), body.get("observacoes"), fid))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/fluxo-caixa/{fid}")
def deletar_fluxo(fid: int, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("DELETE FROM fluxo_caixa WHERE id=?", (fid,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── CONTAS A RECEBER ────────────────────────────────────────────────────────

@app.get("/api/contas-receber")
def listar_contas(status: str = "", cliente_id: str = "", usuario=Depends(get_usuario_atual)):
    conn = get_db()
    where, params = [], []
    if cliente_id: where.append("cr.cliente_id=?"); params.append(int(cliente_id))
    if status == "pendente": where.append("(cr.valor_bruto+cr.frete-COALESCE(cr.valor_recebido,0))>0")
    elif status == "atrasado": where.append("julianday('now')>julianday(cr.vencimento) AND (cr.valor_bruto+cr.frete-COALESCE(cr.valor_recebido,0))>0")
    elif status == "liquidado": where.append("(cr.valor_bruto+cr.frete-COALESCE(cr.valor_recebido,0))<=0")
    w = " WHERE " + " AND ".join(where) if where else ""
    rows = conn.execute(f"""
        SELECT cr.*, cl.nome AS cliente_nome,
            (cr.valor_bruto+cr.frete) AS valor_total,
            (cr.valor_bruto+cr.frete-COALESCE(cr.valor_recebido,0)) AS saldo_aberto,
            MAX(0,CAST(julianday('now')-julianday(cr.vencimento) AS INTEGER)) AS dias_atraso,
            CASE WHEN (cr.valor_bruto+cr.frete-COALESCE(cr.valor_recebido,0))<=0 THEN 'Liquidado'
                 WHEN julianday('now')>julianday(cr.vencimento) THEN 'Em Atraso'
                 ELSE 'A Vencer' END AS status
        FROM contas_receber cr JOIN clientes cl ON cr.cliente_id=cl.id {w} ORDER BY cr.vencimento ASC
    """, params).fetchall()
    conn.close()
    return rows_to_list(rows)


@app.get("/api/contas-receber/resumo")
def resumo_contas(usuario=Depends(get_usuario_atual)):
    conn = get_db()
    r = conn.execute("""
        SELECT COUNT(*) AS total_titulos, SUM(valor_bruto+frete) AS total_bruto,
            SUM(COALESCE(valor_recebido,0)) AS total_recebido,
            SUM(valor_bruto+frete-COALESCE(valor_recebido,0)) AS total_aberto,
            SUM(CASE WHEN julianday('now')>julianday(vencimento) AND (valor_bruto+frete-COALESCE(valor_recebido,0))>0
                     THEN valor_bruto+frete-COALESCE(valor_recebido,0) ELSE 0 END) AS total_atrasado
        FROM contas_receber
    """).fetchone()
    conn.close()
    return dict(r)


@app.post("/api/contas-receber")
def criar_conta(body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    cur = conn.execute("""
        INSERT INTO contas_receber (cliente_id,origem,documento_ref,data_emissao,vencimento,valor_bruto,frete,observacoes)
        VALUES (?,?,?,?,?,?,?,?)
    """, (body["cliente_id"], body.get("origem"), body.get("documento_ref"), body["data_emissao"],
          body["vencimento"], body["valor_bruto"], body.get("frete", 0), body.get("observacoes")))
    lid = cur.lastrowid
    conn.execute("UPDATE contas_receber SET codigo='REC-'||printf('%04d',id) WHERE id=?", (lid,))
    conn.commit()
    conn.close()
    return {"id": lid}


@app.patch("/api/contas-receber/{rid}/receber")
def registrar_recebimento(rid: int, body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conta = conn.execute("SELECT * FROM contas_receber WHERE id=?", (rid,)).fetchone()
    if not conta:
        raise HTTPException(404)
    novo_valor = (conta["valor_recebido"] or 0) + body["valor_recebido"]
    conn.execute("UPDATE contas_receber SET valor_recebido=? WHERE id=?", (novo_valor, rid))
    conn.execute("""
        INSERT INTO fluxo_caixa (data,tipo,categoria,documento_ref,cliente_id,descricao,entradas,forma_pagamento)
        VALUES (date('now'),'Entrada','Recebimento',?,?,?,?,'Transferência')
    """, (conta["codigo"], conta["cliente_id"], f"Recebimento {conta['codigo']}", body["valor_recebido"]))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.put("/api/contas-receber/{rid}")
def atualizar_conta(rid: int, body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("""
        UPDATE contas_receber SET cliente_id=?,origem=?,documento_ref=?,data_emissao=?,vencimento=?,valor_bruto=?,frete=?,valor_recebido=?,observacoes=?
        WHERE id=?
    """, (body.get("cliente_id"), body.get("origem"), body.get("documento_ref"), body.get("data_emissao"),
          body.get("vencimento"), body.get("valor_bruto"), body.get("frete"), body.get("valor_recebido"),
          body.get("observacoes"), rid))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/contas-receber/{rid}")
def deletar_conta(rid: int, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("DELETE FROM contas_receber WHERE id=?", (rid,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── DASHBOARD ───────────────────────────────────────────────────────────────

@app.get("/api/dashboard")
def dashboard(usuario=Depends(get_usuario_atual)):
    conn = get_db()

    vendas_totais = conn.execute("SELECT COALESCE(SUM(qtd_vendida*preco_unit+COALESCE(frete,0)),0) AS total FROM vendas").fetchone()["total"]
    skus = conn.execute("SELECT COUNT(*) AS t FROM produtos").fetchone()["t"]
    clientes = conn.execute("SELECT COUNT(*) AS t FROM clientes").fetchone()["t"]
    consig = conn.execute("SELECT COUNT(*) AS t, COALESCE(SUM((qtd_enviada-qtd_vendida-qtd_devolvida)*preco_unit),0) AS v FROM consignacoes WHERE (qtd_enviada-qtd_vendida-qtd_devolvida)>0").fetchone()
    consig_crit = conn.execute("SELECT COUNT(*) AS t FROM consignacoes WHERE (qtd_enviada-qtd_vendida-qtd_devolvida)>0 AND julianday('now')-julianday(data_envio)>30").fetchone()["t"]
    contas = conn.execute("SELECT COALESCE(SUM(valor_bruto+frete-COALESCE(valor_recebido,0)),0) AS ab, COALESCE(SUM(CASE WHEN julianday('now')>julianday(vencimento) AND (valor_bruto+frete-COALESCE(valor_recebido,0))>0 THEN valor_bruto+frete-COALESCE(valor_recebido,0) ELSE 0 END),0) AS at FROM contas_receber").fetchone()
    alertas = conn.execute("""
        SELECT COUNT(*) AS t FROM (
            SELECT p.sku,
                (COALESCE(ei.quantidade,0)+COALESCE((SELECT SUM(quantidade) FROM estoque_movimentacoes WHERE produto_sku=p.sku AND tipo='entrada'),0)
                -COALESCE((SELECT SUM(qtd_vendida) FROM vendas WHERE produto_sku=p.sku AND origem='Estoque'),0)
                -COALESCE((SELECT SUM(qtd_enviada) FROM consignacoes WHERE produto_sku=p.sku),0)
                +COALESCE((SELECT SUM(qtd_devolvida) FROM consignacoes WHERE produto_sku=p.sku),0)) AS et,
                p.estoque_minimo FROM produtos p LEFT JOIN estoque_inicial ei ON ei.produto_sku=p.sku WHERE p.estoque_minimo>0
        ) WHERE et<=estoque_minimo
    """).fetchone()["t"]

    vendas_mes = conn.execute("""
        SELECT strftime('%Y-%m',data_venda) AS mes,
            SUM(qtd_vendida*preco_unit+COALESCE(frete,0)) AS vendas_brutas,
            SUM(qtd_vendida*preco_unit+COALESCE(frete,0)-qtd_vendida*COALESCE((p.preco_fob+p.frete_unit+p.impostos_unit+p.outros_custos),0)) AS margem_bruta,
            SUM(qtd_vendida) AS qtd_vendida
        FROM vendas v JOIN produtos p ON v.produto_sku=p.sku
        WHERE v.data_venda>=date('now','-12 months') GROUP BY mes ORDER BY mes
    """).fetchall()

    produtos_top = conn.execute("""
        SELECT p.descricao, p.sku, SUM(v.qtd_vendida) AS qtd, SUM(v.qtd_vendida*v.preco_unit) AS receita
        FROM vendas v JOIN produtos p ON v.produto_sku=p.sku GROUP BY v.produto_sku ORDER BY qtd DESC LIMIT 10
    """).fetchall()

    clientes_top = conn.execute("""
        SELECT cl.nome, cl.id, SUM(v.qtd_vendida*v.preco_unit) AS total_compras, COUNT(*) AS num_compras
        FROM vendas v JOIN clientes cl ON v.cliente_id=cl.id GROUP BY v.cliente_id ORDER BY total_compras DESC LIMIT 10
    """).fetchall()

    status_contas = conn.execute("""
        SELECT
            SUM(CASE WHEN (valor_bruto+frete-COALESCE(valor_recebido,0))<=0 THEN 1 ELSE 0 END) AS liquidado,
            SUM(CASE WHEN julianday('now')>julianday(vencimento) AND (valor_bruto+frete-COALESCE(valor_recebido,0))>0 THEN 1 ELSE 0 END) AS atrasado,
            SUM(CASE WHEN julianday('now')<=julianday(vencimento) AND (valor_bruto+frete-COALESCE(valor_recebido,0))>0 THEN 1 ELSE 0 END) AS a_vencer
        FROM contas_receber
    """).fetchone()
    conn.close()

    return {
        "kpis": {
            "vendas_totais": vendas_totais, "skus_cadastrados": skus, "clientes_ativos": clientes,
            "consig_abertas": consig["t"], "consig_valor_aberto": consig["v"],
            "consig_criticas": consig_crit, "contas_abertas": contas["ab"],
            "contas_atrasadas": contas["at"], "alertas_estoque": alertas,
        },
        "vendas_mes": rows_to_list(vendas_mes),
        "produtos_mais_vendidos": rows_to_list(produtos_top),
        "clientes_mais_ativos": rows_to_list(clientes_top),
        "status_contas": dict(status_contas) if status_contas else {},
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
