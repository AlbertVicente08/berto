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


@app.get("/health")
def health_check():
    """Endpoint de comprobación de salud para verificar que el servicio está vivo."""
    return {"status": "ok"}


def main():
    import uvicorn
    # El servicio solo escucha en 127.0.0.1 (local) por seguridad
    uvicorn.run(app, host=HOST, port=PORT)


if __name__ == "__main__":
    main()
