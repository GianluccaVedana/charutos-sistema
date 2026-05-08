from database import get_db

PRODUTOS = [
    ("PQ0001","Caixa do humidor de madeira para 5 charutos","Quiteria",None,None,1,50,0,0,0,100,3),
    ("PQ0002","Caixa do humidor de madeira com medidor de umidade e cortador","Quiteria",None,None,1,100,0,0,0,180,3),
    ("PQ0003","Churchill","Quiteria","165x19 mm",None,1,18,0,0,0,28,10),
    ("PQ0004","Cinzeiro","Quiteria",None,None,1,40,0,0,0,70,2),
    ("PQ0005","Corona","Quiteria","140x18 mm",None,1,14.4,0,0,0,24,25),
    ("PQ0006","Corona Gorda","Quiteria","165x20 mm",None,1,19.8,0,0,0,28,5),
    ("PQ0007","DonNadinho","Quiteria",None,None,1,12.6,0,0,0,22,50),
    ("PQ0008","Double Corona","Quiteria","185x19.5 mm",None,1,22.5,0,0,0,33,5),
    ("PQ0009","Gran Robusto","Quiteria","150x20.5 mm",None,1,18,0,0,0,28,5),
    ("PQ0010","Nub Df","Quiteria","105x25 mm",None,1,18,0,0,0,28,5),
    ("PQ0011","Petit Corona","Quiteria","125x16 mm",None,1,9.9,0,0,0,19,50),
    ("PQ0012","Robusto","Quiteria","120x20 mm",None,1,12.6,0,0,0,26,25),
    ("PQ0013","Salomones","Quiteria","180x20.5 mm",None,1,35.1,0,0,0,47,5),
    ("PQ0014","Tierra Maestra","Quiteria","155x20.5 mm",None,1,31.5,0,0,0,43,5),
    ("PQ0015","Torpedo","Quiteria","165x20 mm",None,1,19.8,0,0,0,30,5),
    ("PQ0016","Toscanino","Quiteria","115x11 mm",None,1,3.6,0,0,0,16,50),
    ("PQ0017","Toscano","Quiteria","140x13 mm",None,1,6.3,0,0,0,19,50),
    ("PQ0018","Caixa do humidor Mostruario","Quiteria",None,None,1,160,0,0,0,160,4),
    ("PQ0019","Humidor de Vidro (Pequeno)","Quiteria",None,None,1,150,0,0,0,250,2),
    ("PQ0020","Caixa do humidor de madeira para 3 charutos","Quiteria",None,None,1,35,0,0,0,80,2),
]

CLIENTES = [
    ("Chede","Chede","(48) 99983-0807",None,"Florianópolis","SC"),
    ("Basilico","Basilio","(41) 99633-7428",None,"Curitiba","PR"),
    ("Bier Kraft 1","Alexandre","(41) 99866-7600",None,"Curitiba","PR"),
    ("Bier Kraft 2","Alexandre","(41) 99866-7600",None,"Curitiba","PR"),
    ("Sallumer","Diogo","(41) 99569-7766",None,"Curitiba","PR"),
    ("Felipe Rubert","Felipe Rubert","(21) 99509-8166","fsrubert@neogier.com.br","São Paulo","SP"),
    ("Alexandre Ruscheinsky","Alexandre Ruscheinsky","(49) 98833-2904",None,"Iporã do Oeste","SC"),
    ("Mauricio Bier Kraft","Mauricio","(41) 99292-4770",None,"Curitiba","PR"),
    ("Julien Dias","Julien Dias","(41) 99899-4105","juliendias@hotmail.com","Curitiba","PR"),
    ("Pedro Hespanha","Pedro Hespanha","(41) 98834-1244",None,"Curitiba","PR"),
    ("Campagnolo Turbinada","Campagnolo Turbinada","(41) 99997-4785",None,"Curitiba","PR"),
]

def seed():
    conn = get_db()
    cur = conn.cursor()
    for p in PRODUTOS:
        cur.execute("""
            INSERT OR IGNORE INTO produtos (sku,descricao,marca,dimensoes,origem,unidade,preco_fob,frete_unit,impostos_unit,outros_custos,preco_venda,estoque_minimo)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        """, p)
        cur.execute("INSERT OR IGNORE INTO estoque_inicial (produto_sku, quantidade) VALUES (?,0)", (p[0],))
    for c in CLIENTES:
        cur.execute("""
            INSERT OR IGNORE INTO clientes (nome,contato,telefone,email,cidade,estado)
            VALUES (?,?,?,?,?,?)
        """, c)
    cur.execute("UPDATE clientes SET codigo = 'CLI-' || printf('%04d', id) WHERE codigo IS NULL")
    conn.commit()
    conn.close()
    print("Seed concluído com sucesso!")

if __name__ == "__main__":
    import sys
    sys.path.insert(0, ".")
    from database import init_db
    init_db()
    seed()
