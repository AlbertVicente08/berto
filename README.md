# Berto

**Tu agente de IA con avatar, siempre a un atajo de teclado.**

Berto es un asistente de código abierto que vive en tu Windows como un popup: pulsas una combinación de teclas, aparece su avatar y te ayuda en lo que estés haciendo, ya sea en VS Code, el navegador, Spotify, Discord o donde sea. Se adapta a cada aplicación, y **tú eliges el modelo de IA** (local o en la nube).

> Estado: **Fase 0, cimientos**. Berto todavía no funciona; este repositorio es el punto de partida.

## Por qué existe

Es un proyecto para **aprender** construyendo algo grande: interfaces de escritorio, agentes de IA, control del PC y sistemas de plugins. No hay suscripciones ni versión de pago. Si te gusta y quieres apoyarlo, puedes hacer una donación voluntaria (enlace pendiente).

## Ideas principales

- **Popup con avatar**: aparece y desaparece con un atajo de teclado (por defecto `Ctrl+Espacio`).
- **Cualquier modelo de IA**: OpenAI, Claude, Gemini, o modelos locales con Ollama, a través de [LiteLLM](https://github.com/BerriAI/litellm).
- **Consciente del contexto**: sabe qué aplicación tienes abierta y cambia su forma de ayudar.
- **Plugins por aplicación**: cada app (VS Code, navegador, Spotify...) es un plugin independiente que cualquiera puede crear, basado en [MCP](https://modelcontextprotocol.io).
- **Seguro por diseño**: antes de hacer algo delicado (pagar, borrar, enviar un mensaje) Berto **te pide confirmación**.

## Tecnologías

| Parte | Tecnología |
|---|---|
| Popup y ventana | Tauri 2 (Rust) |
| Interfaz y avatar | React + TypeScript + Vite, animaciones con Rive/Lottie |
| Cerebro del agente | Python |
| Modelos de IA | LiteLLM |
| Control del navegador | Playwright |
| Control de ventanas de Windows | pywinauto / UI Automation |
| Plugins | MCP (Model Context Protocol) |

No usa Docker: Berto necesita acceso directo a tu escritorio.

## Estructura del proyecto

```
berto/
├─ app/       Popup y avatar (Tauri + React)
├─ agent/     Cerebro en Python (modelos, herramientas, permisos)
├─ plugins/   Un plugin por aplicación
├─ docs/      Arquitectura y roadmap
├─ data/      Datos locales del usuario (no se suben a Git)
├─ .env       Tus claves (no se suben a Git)
└─ .env.example  Plantilla de configuración
```

## Cómo arrancarlo

Todavía no hay nada que ejecutar. Prepara tu equipo (Fase 0):

1. Instala **Python 3.12+**, **Node.js 20+** y **Rust** (`rustup`).
2. Copia `.env.example` como `.env` y rellena lo que uses.
3. Sigue el avance en [docs/roadmap.md](docs/roadmap.md).

## Hoja de ruta

Resumen (detalle en [docs/roadmap.md](docs/roadmap.md)):

0. Cimientos
1. El popup y el avatar
2. Cerebro con cualquier modelo
3. Conciencia del contexto
4. Herramientas y acciones con permisos
5. Plugins por aplicación
6. Voz y avatar avanzado
7. Apertura a la comunidad

## Cómo contribuir

Todo el mundo es bienvenido, también quien está aprendiendo. Abre un *issue* con tu idea o un *pull request* pequeño. Para crear un plugin, mira la carpeta [plugins/](plugins/).

## Licencia

[MIT](LICENSE): úsalo, modifícalo y compártelo libremente.
