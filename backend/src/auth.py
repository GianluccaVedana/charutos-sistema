from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SECRET_KEY = "charutos_secret_2024_jwt"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

security = HTTPBearer()


def create_token(data: dict):
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({**data, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")


def get_usuario_atual(credentials: HTTPAuthorizationCredentials = Depends(security)):
    return decode_token(credentials.credentials)


def exigir_perfil(*perfis):
    def dep(usuario=Depends(get_usuario_atual)):
        if usuario.get("perfil") not in perfis:
            raise HTTPException(status_code=403, detail="Acesso negado")
        return usuario
    return dep
