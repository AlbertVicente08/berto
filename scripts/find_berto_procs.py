import psutil

print("Looking for Berto processes:")
for p in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        name = p.info['name'].lower()
        if 'app.exe' in name or 'berto' in name:
            print(f"  App PID {p.pid}: {name}")
        elif 'python' in name:
            cmd = " ".join(p.info['cmdline'] or [])
            if 'berto' in cmd or 'server.py' in cmd:
                print(f"  Python PID {p.pid}: {name} ({cmd})")
        elif 'msedgewebview2' in name:
            # check if parent is app.exe
            parent = p.parent()
            if parent and ('app.exe' in parent.name().lower() or 'msedgewebview2' in parent.name().lower()):
                print(f"  WebView2 PID {p.pid}: parent {parent.pid}")
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass
