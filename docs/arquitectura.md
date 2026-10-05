# Arquitectura

Berto se divide en tres piezas que hablan entre sí:

```
┌──────────────────────┐   mensajes    ┌───────────────────────┐
│  app/  (Tauri+React) │ ◄───────────► │  agent/  (Python)     │
│  Popup, avatar, chat │  local (HTTP/ │  Cerebro: LiteLLM,    │
│  atajo de teclado    │  WebSocket)   │  permisos, memoria    │
└──────────────────────┘               └──────────┬────────────┘
                                                  │ MCP
                                       ┌──────────▼────────────┐
                                       │  plugins/             │
                                       │  VS Code, navegador,  │
                                       │  Spotify, Discord...  │
                                       └───────────────────────┘
```

## app/: lo que ves
Ventana flotante creada con Tauri. Muestra el avatar y el chat, y captura el atajo global. No piensa: solo muestra y envía lo que escribes al cerebro.

## agent/: el cerebro
Servicio en Python que:
1. Recibe tu mensaje y el contexto (app activa, texto seleccionado).
2. Llama al modelo de IA elegido mediante LiteLLM.
3. Decide si necesita una herramienta (un plugin).
4. **Pasa por el sistema de permisos**: las acciones peligrosas esperan tu confirmación.
5. Devuelve la respuesta a la interfaz.

## plugins/: las manos
Cada plugin es un programa pequeño que expone herramientas mediante MCP (por ejemplo, "abrir pestaña" o "reproducir canción"). Añadir una app nueva significa añadir una carpeta nueva, sin tocar el núcleo.

## Decisiones clave
- **Sin Docker:** necesita acceso directo a ventanas y teclado de Windows.
- **Todo local por defecto:** tus datos no salen del PC salvo la llamada al modelo que elijas.
- **Confirmación obligatoria** en acciones sensibles (pagos, borrados, mensajes).
