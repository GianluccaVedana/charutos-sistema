import sys
import os

# Caminho do projeto no PythonAnywhere — ajuste USERNAME abaixo
USERNAME = "SEU_USUARIO"
PROJECT_PATH = f"/home/{USERNAME}/charutos/src"

sys.path.insert(0, PROJECT_PATH)
os.chdir(PROJECT_PATH)

from a2wsgi import ASGIMiddleware
from main import app

application = ASGIMiddleware(app)
