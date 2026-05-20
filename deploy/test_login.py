import urllib.request, json

data = json.dumps({"email": "admin@charutos.com", "senha": "admin123"}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:3001/api/auth/login",
    data=data,
    headers={"Content-Type": "application/json"}
)
try:
    res = urllib.request.urlopen(req)
    print("SUCESSO:", res.read().decode())
except Exception as e:
    print("ERRO:", e.read().decode() if hasattr(e, 'read') else str(e))
