import sys, os, uuid, shutil
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException, Depends, Body, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from typing import Optional, Any
from pathlib import Path
from datetime import datetime
import sqlite3
from database import get_db, init_db, pwd_context
from auth import create_token, get_usuario_atual, exigir_perfil  # noqa

app = FastAPI(title="Charutos Premium API")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

UPLOAD_DIR = Path(os.path.dirname(__file__)) / ".." / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


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
    payload = {"id": u["id"], "nome": u["nome"], "email": u["email"], "perfil": u["perfil"],
               "cliente_id": u["cliente_id"] if "cliente_id" in u.keys() else None}
    token = create_token(payload)
    return {"token": token, "usuario": payload}


@app.get("/api/auth/me")
def me(usuario=Depends(get_usuario_atual)):
    return usuario


@app.get("/api/auth/usuarios")
def listar_usuarios(usuario=Depends(exigir_perfil("admin"))):
    conn = get_db()
    rows = conn.execute("SELECT id,nome,email,perfil,ativo,criado_em,cliente_id FROM usuarios").fetchall()
    conn.close()
    return rows_to_list(rows)


@app.post("/api/auth/usuarios")
def criar_usuario(body: dict = Body(...), usuario=Depends(exigir_perfil("admin"))):
    conn = get_db()
    hashed = pwd_context.hash(body["senha"])
    try:
        cur = conn.execute("INSERT INTO usuarios (nome,email,senha,perfil,cliente_id) VALUES (?,?,?,?,?)",
                           (body["nome"], body["email"], hashed, body.get("perfil", "vendas"),
                            body.get("cliente_id") or None))
        conn.commit()
        return {"id": cur.lastrowid}
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Email já cadastrado")
    finally:
        conn.close()


@app.put("/api/auth/usuarios/{uid}")
def atualizar_usuario(uid: int, body: dict = Body(...), usuario=Depends(exigir_perfil("admin"))):
    conn = get_db()
    cliente_id = body.get("cliente_id") or None
    if body.get("senha"):
        hashed = pwd_context.hash(body["senha"])
        conn.execute("UPDATE usuarios SET nome=?,email=?,perfil=?,ativo=?,senha=?,cliente_id=? WHERE id=?",
                     (body["nome"], body["email"], body["perfil"], body.get("ativo", 1), hashed, cliente_id, uid))
    else:
        conn.execute("UPDATE usuarios SET nome=?,email=?,perfil=?,ativo=?,cliente_id=? WHERE id=?",
                     (body["nome"], body["email"], body["perfil"], body.get("ativo", 1), cliente_id, uid))
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
            INSERT INTO produtos (sku,descricao,marca,dimensoes,origem,unidade,preco_fob,frete_unit,impostos_unit,outros_custos,preco_venda,estoque_minimo,observacoes,link_imagem,tipo_charuto,vitola,intensidade)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (body["sku"], body["descricao"], body.get("marca"), body.get("dimensoes"), body.get("origem"),
              body.get("unidade", 1), body.get("preco_fob", 0), body.get("frete_unit", 0),
              body.get("impostos_unit", 0), body.get("outros_custos", 0), body.get("preco_venda", 0),
              body.get("estoque_minimo", 0), body.get("observacoes"), body.get("link_imagem"),
              body.get("tipo_charuto"), body.get("vitola"), body.get("intensidade")))
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
        impostos_unit=?,outros_custos=?,preco_venda=?,estoque_minimo=?,observacoes=?,link_imagem=?,
        tipo_charuto=?,vitola=?,intensidade=?,atualizado_em=CURRENT_TIMESTAMP
        WHERE sku=?
    """, (body.get("descricao"), body.get("marca"), body.get("dimensoes"), body.get("origem"),
          body.get("unidade", 1), body.get("preco_fob", 0), body.get("frete_unit", 0),
          body.get("impostos_unit", 0), body.get("outros_custos", 0), body.get("preco_venda", 0),
          body.get("estoque_minimo", 0), body.get("observacoes"), body.get("link_imagem"),
          body.get("tipo_charuto"), body.get("vitola"), body.get("intensidade"), sku))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/produtos/{sku}")
def deletar_produto(sku: str, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    p = conn.execute("SELECT foto_filename FROM produtos WHERE sku=?", (sku,)).fetchone()
    if p and p["foto_filename"]:
        foto_path = UPLOAD_DIR / p["foto_filename"]
        if foto_path.exists():
            foto_path.unlink()
    conn.execute("DELETE FROM produtos WHERE sku=?", (sku,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/produtos/{sku}/foto")
async def upload_foto_produto(sku: str, file: UploadFile = File(...), usuario=Depends(get_usuario_atual)):
    ext = Path(file.filename).suffix.lower()
    if ext not in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
        raise HTTPException(400, "Formato inválido. Use JPG, PNG ou WebP")
    filename = f"produto_{sku}{ext}"
    filepath = UPLOAD_DIR / filename
    content = await file.read()
    filepath.write_bytes(content)
    conn = get_db()
    conn.execute("UPDATE produtos SET foto_filename=? WHERE sku=?", (filename, sku))
    conn.commit()
    conn.close()
    return {"foto_filename": filename, "foto_url": f"/uploads/{filename}"}


# ─── CLIENTES ────────────────────────────────────────────────────────────────

@app.get("/api/clientes")
def listar_clientes(busca: str = "", usuario=Depends(get_usuario_atual)):
    conn = get_db()
    if busca:
        rows = conn.execute(
            "SELECT * FROM clientes WHERE nome LIKE ? OR telefone LIKE ? OR email LIKE ? OR cidade LIKE ? OR cpf_cnpj LIKE ? ORDER BY nome",
            (f"%{busca}%",) * 5).fetchall()
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


@app.get("/api/clientes/{cid}/portal-token")
def get_portal_token(cid: int, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    row = conn.execute("SELECT portal_token FROM clientes WHERE id=?", (cid,)).fetchone()
    if not row:
        raise HTTPException(404)
    token = row["portal_token"]
    if not token:
        token = uuid.uuid4().hex
        conn.execute("UPDATE clientes SET portal_token=? WHERE id=?", (token, cid))
        conn.commit()
    conn.close()
    return {"token": token}


# ─── ESTOQUE ─────────────────────────────────────────────────────────────────

@app.get("/api/estoque")
def listar_estoque(usuario=Depends(get_usuario_atual)):
    conn = get_db()
    rows = conn.execute("""
        SELECT
            p.sku, p.descricao, p.marca, p.preco_venda, p.foto_filename,
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


# ─── REMESSAS (consignações agrupadas) ───────────────────────────────────────

@app.get("/api/remessas")
def listar_remessas(cliente_id: str = "", usuario=Depends(get_usuario_atual)):
    conn = get_db()
    where = "WHERE r.cliente_id=?" if cliente_id else ""
    params = [int(cliente_id)] if cliente_id else []
    rows = conn.execute(f"""
        SELECT r.*, cl.nome AS cliente_nome,
            COUNT(c.id) AS total_itens,
            SUM(c.qtd_enviada) AS total_unidades,
            SUM(c.qtd_enviada * c.preco_unit) AS valor_total,
            SUM(c.qtd_enviada - c.qtd_vendida - c.qtd_devolvida) AS qtd_em_aberto
        FROM remessas r
        JOIN clientes cl ON r.cliente_id = cl.id
        LEFT JOIN consignacoes c ON c.remessa_id = r.id
        {where} GROUP BY r.id ORDER BY r.data_envio DESC
    """, params).fetchall()
    conn.close()
    return rows_to_list(rows)


@app.get("/api/remessas/{rid}")
def get_remessa(rid: int, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    remessa = conn.execute("""
        SELECT r.*, cl.nome AS cliente_nome, cl.cpf_cnpj AS cliente_cpf_cnpj,
               cl.telefone AS cliente_telefone, cl.endereco AS cliente_endereco,
               cl.cidade AS cliente_cidade, cl.estado AS cliente_estado
        FROM remessas r JOIN clientes cl ON r.cliente_id = cl.id WHERE r.id=?
    """, (rid,)).fetchone()
    if not remessa:
        raise HTTPException(404)
    itens = conn.execute("""
        SELECT c.*, p.descricao AS produto_nome, p.marca AS produto_marca,
               (c.qtd_enviada - c.qtd_vendida - c.qtd_devolvida) AS qtd_em_aberto
        FROM consignacoes c JOIN produtos p ON c.produto_sku = p.sku
        WHERE c.remessa_id = ?
    """, (rid,)).fetchall()
    conn.close()
    return {**dict(remessa), "itens": rows_to_list(itens)}


@app.post("/api/remessas")
def criar_remessa(body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    itens = body.get("itens", [])
    if not itens:
        raise HTTPException(400, "Informe pelo menos um produto")
    conn = get_db()
    cur = conn.execute("INSERT INTO remessas (cliente_id,data_envio,observacoes) VALUES (?,?,?)",
                       (body["cliente_id"], body["data_envio"], body.get("observacoes")))
    rid = cur.lastrowid
    conn.execute("UPDATE remessas SET codigo='REM-'||printf('%04d',id) WHERE id=?", (rid,))
    for item in itens:
        ic = conn.execute("""
            INSERT INTO consignacoes (data_envio,cliente_id,produto_sku,qtd_enviada,preco_unit,frete,remessa_id)
            VALUES (?,?,?,?,?,?,?)
        """, (body["data_envio"], body["cliente_id"], item["produto_sku"],
              item["qtd_enviada"], item.get("preco_unit", 0), item.get("frete", 0), rid))
        conn.execute("UPDATE consignacoes SET codigo='CON-'||printf('%04d',id) WHERE id=?", (ic.lastrowid,))
    conn.commit()
    codigo = conn.execute("SELECT codigo FROM remessas WHERE id=?", (rid,)).fetchone()["codigo"]
    conn.close()
    return {"id": rid, "codigo": codigo}


@app.delete("/api/remessas/{rid}")
def deletar_remessa(rid: int, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("DELETE FROM consignacoes WHERE remessa_id=?", (rid,))
    conn.execute("DELETE FROM remessas WHERE id=?", (rid,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ─── CONSIGNAÇÕES ────────────────────────────────────────────────────────────

@app.get("/api/consignacoes")
def listar_consignacoes(status: str = "", cliente_id: str = "", usuario=Depends(get_usuario_atual)):
    conn = get_db()
    where, params = [], []
    if usuario["perfil"] == "vendas":
        where.append("c.usuario_id=?"); params.append(usuario["id"])
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
        INSERT INTO consignacoes (data_envio,cliente_id,produto_sku,qtd_enviada,preco_unit,frete,observacoes,usuario_id)
        VALUES (?,?,?,?,?,?,?,?)
    """, (body["data_envio"], body["cliente_id"], body["produto_sku"], body["qtd_enviada"],
          body.get("preco_unit", 0), body.get("frete", 0), body.get("observacoes"), usuario["id"]))
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


# ─── PDF ─────────────────────────────────────────────────────────────────────

def _pdf_header(pdf, titulo, subtitulo=""):
    from fpdf import FPDF
    pdf.set_fill_color(212, 132, 30)
    pdf.rect(0, 0, 210, 22, 'F')
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_y(6)
    pdf.cell(0, 8, titulo, align="C", new_x="LMARGIN", new_y="NEXT")
    if subtitulo:
        pdf.set_font("Helvetica", "", 9)
        pdf.cell(0, 5, subtitulo, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(4)


def _pdf_linha_info(pdf, label, valor, col_label=45):
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(col_label, 6, label + ":", new_x="RIGHT", new_y="TOP")
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(0, 6, str(valor or "—"), new_x="LMARGIN", new_y="NEXT")


def _pdf_tabela_header(pdf, colunas):
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font("Helvetica", "B", 9)
    for i, (label, w) in enumerate(colunas):
        last = i == len(colunas) - 1
        pdf.cell(w, 7, label, border=1, fill=True,
                 new_x="LMARGIN" if last else "RIGHT",
                 new_y="NEXT" if last else "TOP")


def _pdf_tabela_linha(pdf, valores_widths, fill=False):
    pdf.set_font("Helvetica", "", 9)
    if fill:
        pdf.set_fill_color(252, 248, 240)
    for i, (val, w) in enumerate(valores_widths):
        last = i == len(valores_widths) - 1
        pdf.cell(w, 6, str(val), border=1, fill=fill,
                 new_x="LMARGIN" if last else "RIGHT",
                 new_y="NEXT" if last else "TOP")


def _gerar_pdf_remessa(remessa):
    from fpdf import FPDF
    pdf = FPDF(format="A4")
    pdf.set_margins(15, 15, 15)
    pdf.add_page()
    w = 180

    _pdf_header(pdf, "ROMANEIO DE CONSIGNAÇÃO",
                f"Emitido em {datetime.now().strftime('%d/%m/%Y %H:%M')}")

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(248, 240, 225)
    pdf.cell(w, 7, "DADOS DO ENVIO", border="B", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    _pdf_linha_info(pdf, "Código", remessa["codigo"])
    _pdf_linha_info(pdf, "Data de Envio", remessa["data_envio"])
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(248, 240, 225)
    pdf.cell(w, 7, "DESTINATÁRIO", border="B", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    _pdf_linha_info(pdf, "Cliente", remessa["cliente_nome"])
    if remessa.get("cliente_cpf_cnpj"):
        _pdf_linha_info(pdf, "CPF/CNPJ", remessa["cliente_cpf_cnpj"])
    if remessa.get("cliente_telefone"):
        _pdf_linha_info(pdf, "Telefone", remessa["cliente_telefone"])
    if remessa.get("cliente_cidade"):
        end = remessa.get("cliente_cidade", "") + (" - " + remessa["cliente_estado"] if remessa.get("cliente_estado") else "")
        _pdf_linha_info(pdf, "Cidade", end)
    pdf.ln(5)

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(248, 240, 225)
    pdf.cell(w, 7, "PRODUTOS CONSIGNADOS", border="B", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    colunas = [("SKU", 25), ("Produto", 75), ("Qtd.", 18), ("Preço Unit.", 31), ("Total", 31)]
    _pdf_tabela_header(pdf, colunas)

    total_geral = 0
    for i, item in enumerate(remessa.get("itens", [])):
        total_item = item["qtd_enviada"] * item["preco_unit"]
        total_geral += total_item
        vals = [
            (item["produto_sku"], 25),
            (item["produto_nome"][:40], 75),
            (str(int(item["qtd_enviada"])), 18),
            (f"R$ {item['preco_unit']:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."), 31),
            (f"R$ {total_item:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."), 31),
        ]
        _pdf_tabela_linha(pdf, vals, fill=(i % 2 == 0))

    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 10)
    total_fmt = f"R$ {total_geral:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    pdf.cell(w - 62, 7, "VALOR TOTAL DA REMESSA:", align="R", new_x="RIGHT", new_y="TOP")
    pdf.set_fill_color(212, 132, 30)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(62, 7, total_fmt, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    if remessa.get("observacoes"):
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(0, 6, "Observações:", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        pdf.multi_cell(w, 5, remessa["observacoes"])

    pdf.ln(15)
    pdf.set_draw_color(100, 100, 100)
    pdf.line(15, pdf.get_y(), 95, pdf.get_y())
    pdf.line(110, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(80, 5, "Assinatura do Remetente", align="C", new_x="RIGHT", new_y="TOP")
    pdf.cell(30, 5, "", new_x="RIGHT", new_y="TOP")
    pdf.cell(85, 5, "Assinatura do Destinatário", align="C", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())


def _gerar_pdf_consignacao(dados):
    from fpdf import FPDF
    pdf = FPDF(format="A4")
    pdf.set_margins(15, 15, 15)
    pdf.add_page()
    w = 180

    _pdf_header(pdf, "ROMANEIO DE CONSIGNAÇÃO",
                f"Emitido em {datetime.now().strftime('%d/%m/%Y %H:%M')}")

    _pdf_linha_info(pdf, "Código", dados["codigo"])
    _pdf_linha_info(pdf, "Data de Envio", dados["data_envio"])
    pdf.ln(3)

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(248, 240, 225)
    pdf.cell(w, 7, "DESTINATÁRIO", border="B", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    _pdf_linha_info(pdf, "Cliente", dados["cliente_nome"])
    if dados.get("cliente_telefone"):
        _pdf_linha_info(pdf, "Telefone", dados["cliente_telefone"])
    pdf.ln(5)

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(248, 240, 225)
    pdf.cell(w, 7, "PRODUTO", border="B", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    _pdf_linha_info(pdf, "SKU", dados["produto_sku"])
    _pdf_linha_info(pdf, "Produto", dados["produto_nome"])
    _pdf_linha_info(pdf, "Qtd. Enviada", str(int(dados["qtd_enviada"])) + " un.")
    preco_fmt = f"R$ {dados['preco_unit']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    total_fmt = f"R$ {dados['valor_potencial']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    _pdf_linha_info(pdf, "Preço Unit.", preco_fmt)
    _pdf_linha_info(pdf, "Valor Total", total_fmt)
    if dados.get("observacoes"):
        _pdf_linha_info(pdf, "Observações", dados["observacoes"])

    pdf.ln(15)
    pdf.set_draw_color(100, 100, 100)
    pdf.line(15, pdf.get_y(), 95, pdf.get_y())
    pdf.line(110, pdf.get_y(), 195, pdf.get_y())
    pdf.ln(3)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(80, 5, "Assinatura do Remetente", align="C", new_x="RIGHT", new_y="TOP")
    pdf.cell(30, 5, "", new_x="RIGHT", new_y="TOP")
    pdf.cell(85, 5, "Assinatura do Destinatário", align="C", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())


@app.get("/api/remessas/{rid}/pdf")
def pdf_remessa(rid: int, usuario=Depends(get_usuario_atual)):
    remessa = get_remessa(rid, usuario)
    pdf_bytes = _gerar_pdf_remessa(remessa)
    codigo = remessa.get("codigo", f"REM-{rid:04d}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={codigo}.pdf"}
    )


@app.get("/api/consignacoes/{cid}/pdf")
def pdf_consignacao(cid: int, usuario=Depends(get_usuario_atual)):
    conn = get_db()
    row = conn.execute("""
        SELECT c.*, cl.nome AS cliente_nome, cl.telefone AS cliente_telefone,
            p.descricao AS produto_nome,
            (c.qtd_enviada*c.preco_unit+c.frete) AS valor_potencial
        FROM consignacoes c
        JOIN clientes cl ON c.cliente_id=cl.id
        JOIN produtos p ON c.produto_sku=p.sku
        WHERE c.id=?
    """, (cid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404)
    dados = dict(row)
    if dados.get("remessa_id"):
        remessa = get_remessa(dados["remessa_id"], usuario)
        pdf_bytes = _gerar_pdf_remessa(remessa)
        codigo = remessa.get("codigo", f"REM-{dados['remessa_id']:04d}")
    else:
        pdf_bytes = _gerar_pdf_consignacao(dados)
        codigo = dados.get("codigo", f"CON-{cid:04d}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={codigo}.pdf"}
    )


@app.get("/api/vendas/{vid}/pdf")
def pdf_venda(vid: int, usuario=Depends(get_usuario_atual)):
    from fpdf import FPDF
    conn = get_db()
    row = conn.execute("""
        SELECT v.*, cl.nome AS cliente_nome, cl.cpf_cnpj AS cliente_cpf_cnpj,
               cl.telefone AS cliente_telefone, cl.cidade AS cliente_cidade, cl.estado AS cliente_estado,
               p.descricao AS produto_nome,
               (v.qtd_vendida*v.preco_unit+COALESCE(v.frete,0)) AS valor_total
        FROM vendas v
        LEFT JOIN clientes cl ON v.cliente_id=cl.id
        JOIN produtos p ON v.produto_sku=p.sku
        WHERE v.id=?
    """, (vid,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(404)
    d = dict(row)

    pdf = FPDF(format="A4")
    pdf.set_margins(15, 15, 15)
    pdf.add_page()
    w = 180

    _pdf_header(pdf, "NOTA DE VENDA",
                f"Emitido em {datetime.now().strftime('%d/%m/%Y %H:%M')}")

    _pdf_linha_info(pdf, "Número", d.get("codigo"))
    _pdf_linha_info(pdf, "Data", d.get("data_venda"))
    _pdf_linha_info(pdf, "Forma Pgto.", d.get("forma_pagamento"))
    pdf.ln(3)

    if d.get("cliente_nome"):
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_fill_color(248, 240, 225)
        pdf.cell(w, 7, "CLIENTE", border="B", fill=True, new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)
        _pdf_linha_info(pdf, "Nome", d["cliente_nome"])
        if d.get("cliente_cpf_cnpj"):
            _pdf_linha_info(pdf, "CPF/CNPJ", d["cliente_cpf_cnpj"])
        if d.get("cliente_cidade"):
            _pdf_linha_info(pdf, "Cidade", f"{d['cliente_cidade']} - {d.get('cliente_estado','')}")
        pdf.ln(3)

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(248, 240, 225)
    pdf.cell(w, 7, "ITEM VENDIDO", border="B", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    colunas = [("SKU", 25), ("Produto", 85), ("Qtd.", 18), ("Preço Unit.", 26), ("Total", 26)]
    _pdf_tabela_header(pdf, colunas)
    total_fmt = f"R$ {d['valor_total']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    preco_fmt = f"R$ {d['preco_unit']:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    _pdf_tabela_linha(pdf, [(d["produto_sku"], 25), (d["produto_nome"][:45], 85),
                             (str(int(d["qtd_vendida"])), 18), (preco_fmt, 26), (total_fmt, 26)])

    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(w - 52, 7, "TOTAL:", align="R", new_x="RIGHT", new_y="TOP")
    pdf.set_fill_color(212, 132, 30)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(52, 7, total_fmt, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    pdf_bytes = bytes(pdf.output())
    codigo = d.get("codigo", f"VEN-{vid:04d}")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={codigo}.pdf"}
    )


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
    qtd = float(body["qtd_vendida"])
    preco = float(body["preco_unit"])
    frete = float(body.get("frete") or 0)
    valor_total = qtd * preco + frete
    origem = body.get("origem", "Estoque")
    forma_pg = body.get("forma_pagamento", "À Vista")
    cliente_id = body.get("cliente_id") or None

    cur = conn.execute("""
        INSERT INTO vendas (data_venda,cliente_id,produto_sku,qtd_vendida,preco_unit,frete,origem,forma_pagamento,observacoes)
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (body["data_venda"], cliente_id, body["produto_sku"], qtd,
          preco, frete, origem, forma_pg, body.get("observacoes")))
    lid = cur.lastrowid
    codigo_venda = f"VEN-{lid:04d}"
    conn.execute("UPDATE vendas SET codigo=? WHERE id=?", (codigo_venda, lid))

    # Auto-registrar entrada no Fluxo de Caixa
    conn.execute("""
        INSERT INTO fluxo_caixa (data,tipo,categoria,documento_ref,cliente_id,descricao,entradas,forma_pagamento)
        VALUES (?,?,?,?,?,?,?,?)
    """, (body["data_venda"], "Receita", "Venda", codigo_venda, cliente_id,
          f"Venda {body.get('produto_sku','')} — {qtd:.0f} un.", valor_total, forma_pg))

    # Contas a Receber para pagamentos a prazo ou consignado
    if cliente_id:
        rec = conn.execute("""
            INSERT INTO contas_receber (cliente_id,origem,documento_ref,data_emissao,vencimento,valor_bruto,frete)
            VALUES (?,?,?,?,?,?,?)
        """, (cliente_id, origem, codigo_venda,
              body["data_venda"], body["data_venda"], qtd * preco, frete))
        conn.execute("UPDATE contas_receber SET codigo='REC-'||printf('%04d',id) WHERE id=?", (rec.lastrowid,))

    # Reconciliar consignação: atualizar qtd_vendida na consignação correspondente
    if origem == "Consignado" and cliente_id and body.get("produto_sku"):
        consig = conn.execute("""
            SELECT id FROM consignacoes
            WHERE cliente_id=? AND produto_sku=? AND (qtd_enviada-qtd_vendida-qtd_devolvida)>0
            ORDER BY data_envio DESC LIMIT 1
        """, (cliente_id, body["produto_sku"])).fetchone()
        if consig:
            conn.execute(
                "UPDATE consignacoes SET qtd_vendida=qtd_vendida+? WHERE id=?",
                (qtd, consig["id"])
            )

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


# ─── PORTAL DO CONSIGNADO ────────────────────────────────────────────────────

@app.get("/api/portal/{token}")
def portal_info(token: str):
    conn = get_db()
    cliente = conn.execute("SELECT * FROM clientes WHERE portal_token=?", (token,)).fetchone()
    if not cliente:
        raise HTTPException(404, "Link inválido ou expirado")
    cid = cliente["id"]

    produtos = conn.execute("""
        SELECT p.sku, p.descricao, p.marca, p.preco_venda, p.dimensoes,
               p.tipo_charuto, p.vitola, p.intensidade, p.foto_filename,
               p.origem, p.observacoes,
               COALESCE(ei.quantidade,0)
               + COALESCE((SELECT SUM(quantidade) FROM estoque_movimentacoes WHERE produto_sku=p.sku AND tipo='entrada'),0)
               - COALESCE((SELECT SUM(qtd_vendida) FROM vendas WHERE produto_sku=p.sku AND origem='Estoque'),0)
               - COALESCE((SELECT SUM(qtd_enviada) FROM consignacoes WHERE produto_sku=p.sku),0)
               + COALESCE((SELECT SUM(qtd_devolvida) FROM consignacoes WHERE produto_sku=p.sku),0)
               AS estoque_disponivel
        FROM produtos p
        LEFT JOIN estoque_inicial ei ON ei.produto_sku=p.sku
        HAVING estoque_disponivel > 0
        ORDER BY p.descricao
    """).fetchall()

    consignacoes = conn.execute("""
        SELECT c.codigo, c.data_envio, c.qtd_enviada, c.qtd_vendida, c.qtd_devolvida,
               (c.qtd_enviada-c.qtd_vendida-c.qtd_devolvida) AS qtd_em_aberto,
               p.descricao AS produto_nome, p.sku AS produto_sku,
               CAST(julianday('now')-julianday(c.data_envio) AS INTEGER) AS dias_em_aberto
        FROM consignacoes c JOIN produtos p ON c.produto_sku=p.sku
        WHERE c.cliente_id=? AND (c.qtd_enviada-c.qtd_vendida-c.qtd_devolvida)>0
        ORDER BY c.data_envio DESC
    """, (cid,)).fetchall()

    pedidos = conn.execute("""
        SELECT pr.*, p.descricao AS produto_nome
        FROM pedidos_reposicao pr JOIN produtos p ON pr.produto_sku=p.sku
        WHERE pr.cliente_id=? AND pr.status='pendente'
        ORDER BY pr.criado_em DESC
    """, (cid,)).fetchall()

    conn.close()
    return {
        "cliente": dict(cliente),
        "produtos": rows_to_list(produtos),
        "consignacoes": rows_to_list(consignacoes),
        "pedidos_pendentes": rows_to_list(pedidos),
    }


@app.post("/api/portal/{token}/reposicao")
def solicitar_reposicao(token: str, body: dict = Body(...)):
    conn = get_db()
    cliente = conn.execute("SELECT id FROM clientes WHERE portal_token=?", (token,)).fetchone()
    if not cliente:
        raise HTTPException(404, "Link inválido")
    cur = conn.execute("""
        INSERT INTO pedidos_reposicao (cliente_id, produto_sku, quantidade, observacoes)
        VALUES (?, ?, ?, ?)
    """, (cliente["id"], body["produto_sku"], body["quantidade"], body.get("observacoes")))
    conn.commit()
    conn.close()
    return {"id": cur.lastrowid, "mensagem": "Pedido registrado com sucesso!"}


# ─── PEDIDOS DE REPOSIÇÃO ────────────────────────────────────────────────────

@app.get("/api/pedidos-reposicao")
def listar_pedidos_reposicao(status: str = "pendente", usuario=Depends(get_usuario_atual)):
    conn = get_db()
    where = "WHERE pr.status=?" if status else ""
    params = [status] if status else []
    rows = conn.execute(f"""
        SELECT pr.*, cl.nome AS cliente_nome, p.descricao AS produto_nome
        FROM pedidos_reposicao pr
        JOIN clientes cl ON pr.cliente_id=cl.id
        JOIN produtos p ON pr.produto_sku=p.sku
        {where} ORDER BY pr.criado_em DESC
    """, params).fetchall()
    conn.close()
    return rows_to_list(rows)


@app.patch("/api/pedidos-reposicao/{pid}")
def atualizar_status_pedido(pid: int, body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    conn = get_db()
    conn.execute("UPDATE pedidos_reposicao SET status=? WHERE id=?", (body["status"], pid))
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

    pedidos_repo = conn.execute("SELECT COUNT(*) AS t FROM pedidos_reposicao WHERE status='pendente'").fetchone()["t"]

    estoque_repor = conn.execute("""
        SELECT p.sku, p.descricao, p.estoque_minimo,
            (COALESCE(ei.quantidade,0)+COALESCE((SELECT SUM(quantidade) FROM estoque_movimentacoes WHERE produto_sku=p.sku AND tipo='entrada'),0)
            -COALESCE((SELECT SUM(qtd_vendida) FROM vendas WHERE produto_sku=p.sku AND origem='Estoque'),0)
            -COALESCE((SELECT SUM(qtd_enviada) FROM consignacoes WHERE produto_sku=p.sku),0)
            +COALESCE((SELECT SUM(qtd_devolvida) FROM consignacoes WHERE produto_sku=p.sku),0)) AS estoque_total
        FROM produtos p LEFT JOIN estoque_inicial ei ON ei.produto_sku=p.sku
        WHERE p.estoque_minimo>0
        HAVING estoque_total <= p.estoque_minimo
        ORDER BY estoque_total ASC LIMIT 10
    """).fetchall()

    consig_abertas = conn.execute("""
        SELECT c.codigo, cl.nome AS cliente_nome, p.descricao AS produto_nome,
            (c.qtd_enviada-c.qtd_vendida-c.qtd_devolvida) AS qtd_em_aberto,
            (c.qtd_enviada*c.preco_unit) AS valor,
            CAST(julianday('now')-julianday(c.data_envio) AS INTEGER) AS dias_em_aberto,
            CASE WHEN julianday('now')-julianday(c.data_envio)>30 THEN 'CRÍTICO'
                 WHEN julianday('now')-julianday(c.data_envio)>15 THEN 'ATENÇÃO'
                 ELSE 'OK' END AS alerta
        FROM consignacoes c
        JOIN clientes cl ON c.cliente_id=cl.id
        JOIN produtos p ON c.produto_sku=p.sku
        WHERE (c.qtd_enviada-c.qtd_vendida-c.qtd_devolvida)>0
        ORDER BY dias_em_aberto DESC LIMIT 10
    """).fetchall()

    contas_vencer = conn.execute("""
        SELECT cr.codigo, cl.nome AS cliente_nome, cr.vencimento,
            (cr.valor_bruto+cr.frete-COALESCE(cr.valor_recebido,0)) AS saldo_aberto,
            MAX(0,CAST(julianday('now')-julianday(cr.vencimento) AS INTEGER)) AS dias_atraso,
            CASE WHEN julianday('now')>julianday(cr.vencimento) THEN 'Em Atraso' ELSE 'A Vencer' END AS status
        FROM contas_receber cr JOIN clientes cl ON cr.cliente_id=cl.id
        WHERE (cr.valor_bruto+cr.frete-COALESCE(cr.valor_recebido,0))>0
        ORDER BY cr.vencimento ASC LIMIT 10
    """).fetchall()

    vendas_mes = conn.execute("""
        SELECT strftime('%Y-%m',data_venda) AS mes,
            SUM(qtd_vendida*preco_unit+COALESCE(frete,0)) AS vendas_brutas,
            SUM(qtd_vendida*preco_unit+COALESCE(frete,0)-qtd_vendida*COALESCE((p.preco_fob+p.frete_unit+p.impostos_unit+p.outros_custos),0)) AS margem_bruta
        FROM vendas v JOIN produtos p ON v.produto_sku=p.sku
        WHERE v.data_venda>=date('now','-6 months') GROUP BY mes ORDER BY mes
    """).fetchall()

    conn.close()
    return {
        "kpis": {
            "vendas_totais": vendas_totais, "skus_cadastrados": skus, "clientes_ativos": clientes,
            "consig_abertas": consig["t"], "consig_valor_aberto": consig["v"],
            "consig_criticas": consig_crit, "contas_abertas": contas["ab"],
            "contas_atrasadas": contas["at"], "alertas_estoque": alertas,
            "pedidos_reposicao": pedidos_repo,
        },
        "vendas_mes": rows_to_list(vendas_mes),
        "estoque_repor": rows_to_list(estoque_repor),
        "consig_abertas_lista": rows_to_list(consig_abertas),
        "contas_vencer_lista": rows_to_list(contas_vencer),
    }


@app.get("/api/consignado/minha-area")
def consignado_minha_area(usuario=Depends(get_usuario_atual)):
    if usuario.get("perfil") != "consignado" or not usuario.get("cliente_id"):
        raise HTTPException(403, "Acesso permitido apenas para usuários consignado")
    cliente_id = usuario["cliente_id"]
    conn = get_db()
    cliente = conn.execute("SELECT * FROM clientes WHERE id=?", (cliente_id,)).fetchone()
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado")

    consignacoes = conn.execute("""
        SELECT c.*, p.descricao AS produto_nome,
            (c.qtd_enviada-c.qtd_vendida-c.qtd_devolvida) AS qtd_em_aberto,
            CAST(julianday('now')-julianday(c.data_envio) AS INTEGER) AS dias_em_aberto
        FROM consignacoes c JOIN produtos p ON c.produto_sku=p.sku
        WHERE c.cliente_id=? AND (c.qtd_enviada-c.qtd_vendida-c.qtd_devolvida)>0
        ORDER BY c.data_envio DESC
    """, (cliente_id,)).fetchall()

    produtos = conn.execute("""
        SELECT p.*,
            (COALESCE(ei.quantidade,0)
             +COALESCE((SELECT SUM(quantidade) FROM estoque_movimentacoes WHERE produto_sku=p.sku AND tipo='entrada'),0)
             -COALESCE((SELECT SUM(qtd_vendida) FROM vendas WHERE produto_sku=p.sku AND origem='Estoque'),0)
             -COALESCE((SELECT SUM(qtd_enviada) FROM consignacoes WHERE produto_sku=p.sku),0)
             +COALESCE((SELECT SUM(qtd_devolvida) FROM consignacoes WHERE produto_sku=p.sku),0)) AS estoque_disponivel
        FROM produtos p LEFT JOIN estoque_inicial ei ON ei.produto_sku=p.sku
        WHERE p.preco_venda>0
        ORDER BY p.descricao
    """).fetchall()

    pedidos_pendentes = conn.execute("""
        SELECT pr.*, p.descricao AS produto_nome
        FROM pedidos_reposicao pr JOIN produtos p ON pr.produto_sku=p.sku
        WHERE pr.cliente_id=? AND pr.status='pendente'
        ORDER BY pr.criado_em DESC LIMIT 5
    """, (cliente_id,)).fetchall()

    conn.close()
    return {
        "cliente": dict(cliente),
        "consignacoes": rows_to_list(consignacoes),
        "produtos": rows_to_list(produtos),
        "pedidos_pendentes": rows_to_list(pedidos_pendentes),
    }


@app.post("/api/consignado/reposicao")
def consignado_reposicao(body: dict = Body(...), usuario=Depends(get_usuario_atual)):
    if usuario.get("perfil") != "consignado" or not usuario.get("cliente_id"):
        raise HTTPException(403, "Acesso permitido apenas para usuários consignado")
    conn = get_db()
    conn.execute("""
        INSERT INTO pedidos_reposicao (cliente_id,produto_sku,quantidade,observacoes)
        VALUES (?,?,?,?)
    """, (usuario["cliente_id"], body["produto_sku"], body["quantidade"], body.get("observacoes")))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.get("/api/health")
def health():
    return {"status": "ok"}
