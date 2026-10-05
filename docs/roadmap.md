# Roadmap de Berto

> Detalle de cada fase, reglas y comprobaciones para darla por hecha: [../AGENTS.md](../AGENTS.md).

Marca cada casilla cuando se complete. Cada fase deja algo que **funciona y se puede probar**.

## Fase 0: Cimientos
- [x] Estructura del repo, README, licencia MIT, `.gitignore`, `.env.example`
- [x] Instalar Python 3.12+, Rust y herramientas de Tauri
- [x] Proyecto Tauri + React funcionando ("hola mundo")
- [x] Servicio Python comunicado con la interfaz
- **Resultado:** la app arranca y la interfaz habla con Python.

## Fase 1: El popup y el avatar
- [x] Isla flotante "Dynamic Island" superior, transparente, sin bordes y con clics a través
- [x] Expansión fluida tipo "morph" con física de muelle (Framer Motion)
- [x] Atajo global (Ctrl+Alt+B), tecla Esc y ocultación por desenfoque
- [x] Icono en la bandeja del sistema y arranque con Windows
- [x] Token de diseño de color único (cian eléctrico `#00E5FF`)
- [x] Avatar 3D en Three.js/R3F asomado sobre la cápsula, ojos LED que siguen el cursor/objetivo y 4 estados
- [x] Sistema de avatares intercambiables (`.glb`) con selector en Ajustes
- [x] Pausa del render 3D al ocultarse (rendimiento eficiente)
- **Resultado:** pulsas el atajo y la isla se desliza con Berto 3D asomado y reactivo.

## Fase 2: Cerebro con cualquier modelo
- [ ] Chat con respuesta en streaming
- [ ] LiteLLM: OpenAI, Claude, Gemini, Ollama
- [ ] Pantalla de ajustes: modelo, clave API (guardada de forma segura), personalidad
- [ ] Memoria básica de conversación
- **Resultado:** conversas con el modelo que elijas.

## Fase 3: Conciencia del contexto
- [ ] Detectar la aplicación activa
- [ ] Leer contexto de forma controlada: título, texto seleccionado, captura opcional
- [ ] Perfiles por aplicación
- [ ] Vinculación visual con halo cian y mirada dirigida del avatar
- **Resultado:** Berto sabe dónde estás, se adapta y vigila la app vinculada.

## Fase 4: Herramientas y acciones
- [ ] Sistema de herramientas con MCP
- [ ] Permisos y confirmación para acciones peligrosas
- [ ] Navegador con Playwright
- [ ] Archivos y comandos con límites
- **Resultado:** Berto actúa, no solo habla.

## Fase 5: Plugins por aplicación
- [ ] Plantilla de plugin
- [ ] VS Code, navegador, Spotify, Discord, Claude
- **Resultado:** ecosistema ampliable por la comunidad.

## Fase 6: Voz y avatar avanzado (opcional)
- [ ] Reconocimiento y síntesis de voz
- [ ] Avatar 3D/VRM con emociones y personalización

## Fase 7: Apertura y comunidad
- [ ] Documentación y guía de contribución
- [ ] Empaquetar el servicio Python con la aplicación (sidecar / PyInstaller o embebido en el instalador de Tauri)
- [ ] Instalador `.exe`
- [ ] Donaciones (GitHub Sponsors / Ko-fi) y primera versión pública

