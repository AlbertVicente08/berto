import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Cargar variables de entorno desde el archivo .env en la raíz del proyecto
root_dir = Path(__file__).resolve().parents[2]
dotenv_path = root_dir / ".env"
load_dotenv(dotenv_path=dotenv_path)

HOST = os.getenv("BERTO_HOST", "127.0.0.1")
PORT = int(os.getenv("BERTO_PORT", "8765"))

app = FastAPI(title="Berto Agent Core", version="0.0.1")

# Orígenes específicos de la interfaz Tauri (Vite en desarrollo y Tauri en producción)
ALLOWED_ORIGINS = [
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "tauri://localhost",
    "https://tauri.localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


import secrets
from fastapi import Header, HTTPException, status

# Token secreto generado aleatoriamente en cada arranque, compartido solo localmente con Berto
SHUTDOWN_TOKEN = secrets.token_urlsafe(32)
TOKEN_DIR = root_dir / "data"
TOKEN_DIR.mkdir(parents=True, exist_ok=True)
TOKEN_FILE = TOKEN_DIR / "shutdown_token.txt"
TOKEN_FILE.write_text(SHUTDOWN_TOKEN, encoding="utf-8")


@app.get("/health")
def health_check():
    """Endpoint de comprobación de salud para verificar que el servicio está vivo."""
    return {"status": "ok"}


@app.post("/shutdown")
def shutdown(x_shutdown_token: str | None = Header(default=None, alias="X-Shutdown-Token")):
    """Permite el cierre ordenado del servidor Python desde la app de forma protegida."""
    if not x_shutdown_token or x_shutdown_token != SHUTDOWN_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: token de apagado no valido o ausente",
        )

    import threading
    import time

    def stop():
        time.sleep(0.3)
        try:
            if TOKEN_FILE.exists():
                TOKEN_FILE.unlink()
        except Exception:
            pass
        os._exit(0)

    threading.Thread(target=stop).start()
    return {"status": "shutting_down"}


def main():
    import uvicorn
    # El servicio solo escucha en 127.0.0.1 (local) por seguridad
    uvicorn.run(app, host=HOST, port=PORT)


if __name__ == "__main__":
    main()
