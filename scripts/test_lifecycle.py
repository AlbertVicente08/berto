import subprocess
import time
import urllib.request
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
py_exe = root / "agent" / ".venv" / "Scripts" / "python.exe"
server_py = root / "agent" / "berto" / "server.py"

print("Starting server process...")
proc = subprocess.Popen([str(py_exe), str(server_py)], cwd=str(root))
try:
    time.sleep(1.0)
    print("Checking /health endpoint...")
    req = urllib.request.urlopen("http://127.0.0.1:8765/health", timeout=2)
    data = json.loads(req.read().decode())
    print("Health response:", data)

    token_file = root / "data" / "shutdown_token.txt"
    token = token_file.read_text(encoding="utf-8").strip()
    print("Token found, length:", len(token))

    print("Checking /shutdown endpoint with token...")
    shut_req = urllib.request.Request(
        "http://127.0.0.1:8765/shutdown",
        headers={"X-Shutdown-Token": token},
        method="POST"
    )
    res = urllib.request.urlopen(shut_req, timeout=2)
    shut_data = json.loads(res.read().decode())
    print("Shutdown response:", shut_data)
    time.sleep(0.5)
finally:
    if proc.poll() is None:
        print("Terminating remaining process...")
        proc.terminate()
        proc.wait(timeout=2)
    print("Process finished with code:", proc.poll())
