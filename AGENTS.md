# AGENTS.md: guía para IAs que trabajen en Berto

> Este archivo es para **cualquier IA o persona** que continúe el proyecto (Claude Code, Antigravity, Cursor, Codex...).
> Léelo entero antes de tocar nada. Es la fuente de verdad del plan.

## 1. Qué es Berto

Agente de IA de código abierto con **avatar** que aparece como **popup en Windows** con un atajo de teclado (por defecto `Ctrl+Alt+B`). Se adapta a la app activa (VS Code, navegador, Spotify, Discord, Claude...). Cada usuario elige su modelo de IA (local o nube). Licencia MIT, sin suscripciones, donaciones voluntarias.

Es un proyecto **para aprender** (el autor hace "vibe coding").

## 2. Reglas de trabajo (obligatorias)

1. **Explica en español sencillo** qué hace cada paso, comando o archivo, antes o mientras lo haces. El autor quiere aprender.
2. **Trabaja una fase cada vez**, en orden. No empieces la siguiente sin haber cerrado la anterior.
3. **Una fase solo está "hecha"** cuando se cumplen **todas** sus comprobaciones (sección "Hecho cuando"). Si una falla, la fase NO está hecha. Dilo claramente y no la marques.
4. **Al cerrar una fase**: marca sus casillas en [docs/roadmap.md](docs/roadmap.md), actualiza el apartado "Estado actual" de este archivo, haz commit en inglés (`Phase N: <summary>`) y explica al autor qué se hizo y qué aprendió.
5. **Seguridad:** nunca escribas claves reales en el código, en `.env.example` ni en commits. `.env` está en `.gitignore`: no lo subas.
6. **Confirmación obligatoria en acciones peligrosas** (pagar, borrar, enviar mensajes, ejecutar comandos): es un requisito de diseño de Berto.
7. **Pregunta antes de** instalar programas globales, subir a GitHub (`git push`) o borrar cosas.
8. **Mantén las cosas simples.** Nada de librerías o abstracciones que la fase no necesite.
9. **Sin Docker.** Berto necesita acceso directo al escritorio de Windows.
10. Sistema del autor: **Windows 11, PowerShell**. Usa comandos de PowerShell (no `&&`; usa `;`).

## 3. Estado actual

> **Actualiza esta sección al cerrar cada fase.**

| Fase | Nombre | Estado |
|---|---|---|
| 0 | Cimientos | Hecha |
| 1 | El popup y el avatar | Hecha |
| 2 | Cerebro con cualquier modelo | En curso |
| 3 | Conciencia del contexto | Pendiente |
| 4 | Herramientas y acciones con permisos | Pendiente |
| 5 | Plugins por aplicación | Pendiente |
| 6 | Voz y avatar avanzado | Pendiente (opcional) |
| 7 | Apertura y comunidad | Pendiente |

Estados posibles: `Pendiente` · `En curso` · `Hecha`.

## 4. Stack y estructura

| Parte | Tecnología |
|---|---|
| Popup/ventana | Tauri 2 (Rust) |
| Interfaz y avatar | React + TypeScript + Vite; avatar 3D con Three.js + React Three Fiber |
| Cerebro | Python 3.12+ |
| Modelos | LiteLLM (OpenAI, Claude, Gemini, Ollama...) |
| Navegador | Playwright |
| Ventanas de Windows | pywinauto / UI Automation |
| Plugins | MCP (Model Context Protocol) |

```
berto/
├─ app/       Tauri + React (popup, avatar, chat)
├─ agent/     Python: cerebro (paquete en agent/berto/)
├─ plugins/   Un plugin por aplicación
├─ docs/      arquitectura.md, roadmap.md, avatar.md, popup.md
├─ data/      Datos locales (no se suben)
└─ AGENTS.md  Este archivo
```

Arquitectura: [docs/arquitectura.md](docs/arquitectura.md). La interfaz (`app/`) solo muestra y envía mensajes; el cerebro (`agent/`) piensa, decide y pasa por los permisos; los plugins (`plugins/`) ejecutan acciones.

---

## 5. Fases

### Fase 0: Cimientos

**Objetivo:** tener el entorno listo y comprobar que la interfaz y Python se hablan.

**Tareas**
- [x] Estructura de carpetas, README, LICENSE (MIT), `.gitignore`, `.env.example`, docs.
- [x] Instalar **Python 3.12+** (el `python` actual de Windows es solo un acceso directo a la Microsoft Store), **Rust** (`rustup`) y los requisitos de Tauri en Windows (WebView2 y Visual Studio C++ Build Tools).
- [x] Crear el entorno virtual: `python -m venv agent\.venv` y un `agent/requirements.txt` (o `pyproject.toml`).
- [x] Crear la app Tauri 2 + React + TypeScript dentro de `app/`.
- [x] Crear un servicio Python mínimo en `agent/berto/` (por ejemplo FastAPI) con un endpoint `/health` que responda `{"status": "ok"}`.
- [x] Hacer que la interfaz llame a `/health` y muestre el resultado.

**Hecho cuando** (comprobaciones)
- `python --version` muestra 3.12 o superior.
- `rustc --version` y `cargo --version` funcionan.
- En `app/`: `npm run tauri dev` abre una ventana sin errores.
- Con el servicio Python arrancado, visitar `http://127.0.0.1:<puerto>/health` devuelve `{"status": "ok"}`.
- La ventana de la app muestra "Python conectado" (o similar) leyendo `/health`.
- `git status` limpio y `.env` no aparece en el repo.

**Qué debe aprender el autor:** qué es un entorno virtual, qué es Tauri (Rust + web), cómo habla una interfaz con un servicio local.

---

### Fase 1: El popup y el avatar

**Objetivo:** pulsar un atajo y que aparezca la isla flotante con el avatar 3D de Berto asomado.

**Tareas**
- [x] Ventana de isla flotante estilo "Dynamic Island": centrada en el borde superior del monitor activo, sin bordes (`decorations: false`), fondo transparente, siempre encima (`alwaysOnTop`), sin icono en la barra de tareas (`skipTaskbar`). Cápsula oscura semitransparente con degradado, borde y sombra (sin Acrylic/Mica nativo de window-vibrancy para no revelar el rectángulo de la ventana).
- [x] Soporte para hacer que las zonas transparentes no bloqueen los clics hacia las apps de debajo (clic a través), implementado en Rust con sondeo periódico de la posición global del cursor (`GetCursorPos`) vs rectángulo de la cápsula visible (`set_ignore_cursor_events`).
- [x] Atajo global (por defecto `Ctrl+Alt+B`, configurable con `BERTO_HOTKEY`) que muestra/oculta la isla, incluso con otra app enfocada.
- [x] Ocultación rápida con tecla `Esc` y al perder el foco (`blur`).
- [x] Icono en la bandeja del sistema (menú: Mostrar, Ajustes, Salir) y opción de arrancar con Windows.
- [x] Definición del token de diseño de color único (cian eléctrico `#00E5FF`) aplicado a ojos, brillo y acentos.
- [x] Avatar 3D minimalista por defecto en Three.js (@react-three/fiber + @react-three/drei): robot asomado por encima de la cápsula, ojos LED que siguen el cursor del ratón (alimentados por la posición global leída por Rust) o miran a un punto arbitrario, y animaciones para los 4 estados: reposo, escuchando, pensando, hablando.
- [x] Sistema de avatares intercambiables: modelos `.glb` cargables en tiempo de ejecución desde `%APPDATA%\Berto\avatars\` o `app/avatars/` sin recompilar; avatares de tipo `code` en R3F integrados. Segundo avatar de prueba en formato `.glb`.
- [x] Selector de avatar en Ajustes que conserva la elección del usuario.
- [x] Cápsula con animación fluida de tipo "morph" y física de muelle (Framer Motion) que se expande hacia abajo al interactuar/escribir.
- [x] Caja de texto para escribir (aún sin IA) y botones de depuración para alternar los 4 estados del avatar.
- [x] Optimización de rendimiento: pausar el bucle de render 3D cuando la isla está oculta (0% GPU).

**Hecho cuando**
- Con otra aplicación en primer plano, `Ctrl+Alt+B` hace aparecer la isla desde arriba centrada; pulsarlo de nuevo, pulsar `Esc` o perder el foco la oculta.
- No hay barra de título, no aparece en la barra de tareas y la cápsula se funde con el escritorio (captura de pantalla del monitor real).
- Los clics en las zonas transparentes de la ventana llegan a las apps de debajo (controlado por Rust).
- La cápsula se expande y contrae con animación fluida tipo muelle al escribir/interactuar.
- Berto en 3D se asoma sobre la cápsula y sus ojos siguen el cursor del ratón en toda la pantalla.
- Se aprecian los 4 estados del robot; cambiar el color del token de diseño actualiza el color en toda la aplicación.
- Se puede cambiar al avatar `.glb` de prueba desde Ajustes sin reiniciar ni tocar código, y la elección persiste.
- El icono de bandeja aparece y "Salir" cierra la app de verdad.
- Con la isla oculta, el consumo de CPU/GPU desciende (medición comprobada).
- `docs/avatar.md` y `docs/popup.md` documentan fielmente el sistema.

**Qué debe aprender el autor:** Dynamic Island en escritorio, ventanas transparentes y clics a través en Tauri 2, gráficos 3D en React (Three.js / React Three Fiber), formato .glb, animaciones basadas en física de muelle (Framer Motion).

---

### Fase 2: Cerebro con cualquier modelo

**Objetivo:** conversar con el modelo que cada usuario elija.

**Tareas**
- [ ] Integrar **LiteLLM** en `agent/`.
- [ ] Endpoint de chat con **streaming** (la respuesta aparece palabra a palabra).
- [ ] Pantalla de ajustes: proveedor/modelo, clave API, personalidad (prompt del sistema).
- [ ] Guardar la clave API de forma segura (administrador de credenciales de Windows / keyring), nunca en texto plano en el repo.
- [ ] Memoria básica de la conversación (en `data/`, ignorada por Git).
- [ ] Soportar al menos: un modelo local con **Ollama** y un modelo en la nube.

**Hecho cuando**
- Escribir "hola" en el popup produce respuesta en streaming del modelo elegido.
- Cambiar de modelo en ajustes cambia realmente el modelo usado, sin tocar código.
- Funciona con Ollama (sin internet) y con al menos un proveedor en la nube.
- Cerrar y abrir Berto conserva ajustes y recuerda el contexto reciente.
- Buscar la clave API en el código y en el historial de Git no encuentra nada.

**Qué debe aprender el autor:** qué es LiteLLM y por qué abstrae proveedores, streaming, cómo se guardan secretos.

---

### Fase 3: Conciencia del contexto

**Objetivo:** que Berto sepa en qué aplicación estás y se adapte.

**Tareas**
- [ ] Detectar la aplicación activa (nombre del proceso y título de ventana) con pywinauto / API de Windows.
- [ ] Leer contexto de forma **controlada y con permiso**: texto seleccionado, y captura de pantalla opcional.
- [ ] Sistema de **perfiles por aplicación** (archivo de configuración por app: instrucciones y herramientas propias).
- [ ] Mostrar en el popup qué app detecta Berto.
- [ ] Ajustes para desactivar la lectura de contexto por app (privacidad).
- [ ] **Vinculación visual con halo**: ventana complementaria transparente en cian eléctrico (`#00E5FF`) que rodea la app vinculada y sigue su posición/tamaño como indicador de seguridad de acceso.
- [ ] Berto orienta su mirada (`lookAt`) hacia la ventana de la aplicación supervisada.

**Hecho cuando**
- Estando en VS Code, Chrome y otra app, Berto muestra correctamente cuál es cada una.
- La respuesta cambia según el perfil de la app activa (se puede comprobar con un perfil de prueba).
- Con la app vinculada, el halo cian eléctrico rodea su ventana y pulsa cuando Berto actúa; Berto la mira directamente.
- Con la lectura de contexto desactivada, Berto **no** lee nada de esa app.
- Ningún dato de contexto se guarda ni se sube sin que el usuario lo sepa.

**Qué debe aprender el autor:** APIs de ventanas de Windows, privacidad por diseño.

---

### Fase 4: Herramientas y acciones con permisos

**Objetivo:** que Berto actúe, no solo hable, **de forma segura**.

**Tareas**
- [ ] Sistema de herramientas basado en **MCP** (cliente MCP en `agent/`).
- [ ] **Sistema de permisos**: cada herramienta tiene nivel de riesgo (leer / modificar / peligrosa). Las peligrosas muestran un diálogo "¿Permitir?" en el popup y esperan al usuario.
- [ ] Herramienta de navegador con **Playwright** (abrir páginas, buscar, leer contenido, comparar precios).
- [ ] Herramientas de archivos y comandos con **límites claros** (carpetas permitidas, lista de comandos).
- [ ] Registro (log) de las acciones realizadas.

**Hecho cuando**
- Pedir "busca X en el navegador" abre el navegador y devuelve el resultado.
- Una acción peligrosa (por ejemplo borrar un archivo de prueba) **no se ejecuta** hasta que el usuario pulsa "Permitir"; con "Denegar" no ocurre nada.
- Berto no puede salir de las carpetas permitidas (probar con una ruta fuera).
- Cada acción queda en el log.
- Pruebas automáticas del sistema de permisos pasan.

**Qué debe aprender el autor:** qué es MCP, diseño de permisos, por qué un agente necesita límites.

---

### Fase 5: Plugins por aplicación

**Objetivo:** que cualquiera pueda añadir una app nueva sin tocar el núcleo.

**Tareas**
- [ ] **Plantilla de plugin** en `plugins/_template/` y guía en `docs/plugins.md`.
- [ ] Cargador de plugins (detecta carpetas en `plugins/`).
- [ ] Plugin **Navegador** (usando Playwright).
- [ ] Plugin **VS Code** (abrir proyectos, leer archivo activo).
- [ ] Plugin **Spotify** (reproducir/pausar/buscar).
- [ ] Plugin **Discord** y plugin **Claude** (según viabilidad; documentar límites).

**Hecho cuando**
- Copiar la plantilla, renombrarla y añadir una herramienta hace que Berto la use sin cambiar el núcleo.
- Cada plugin incluido tiene una prueba manual documentada y funciona.
- Los plugins respetan el sistema de permisos de la Fase 4.

**Qué debe aprender el autor:** diseño de plugins, estándares abiertos, documentar para otros.

---

### Fase 6: Voz y avatar avanzado (opcional)

**Tareas**
- [ ] Reconocimiento de voz (hablarle) y síntesis de voz (que responda hablando), con opción local.
- [ ] Avatar 3D/VRM con emociones y labios sincronizados.
- [ ] Personalización del avatar por el usuario.

**Hecho cuando**
- Se puede mantener una conversación completa por voz.
- El avatar reacciona al estado emocional/tono de la respuesta.
- Se puede cambiar de avatar sin tocar código.

---

### Fase 7: Apertura y comunidad

**Tareas**
- [ ] Documentación completa (instalación, uso, plugins) y `CONTRIBUTING.md`.
- [ ] Plantillas de issues y pull requests.
- [ ] Empaquetar el servicio Python con la aplicación (sidecar / PyInstaller o embebido en el instalador de Tauri).
- [ ] Instalador `.exe` (Tauri bundle) y primera *release* en GitHub.
- [ ] Donaciones voluntarias (GitHub Sponsors / Ko-fi) enlazadas en el README.
- [ ] Revisión de seguridad: ningún secreto en el historial, permisos revisados.

**Hecho cuando**
- Una persona nueva puede instalar Berto desde el `.exe` y usarlo siguiendo solo el README.
- La *release* está publicada y el enlace de donaciones funciona.
- Auditoría de secretos limpia (ninguna clave en el historial de Git).

---

## 6. Cómo cerrar una fase (checklist para la IA)

1. Ejecuta **todas** las comprobaciones de "Hecho cuando" y anota el resultado real (pasa/falla).
2. Si alguna falla: arréglala o informa al autor. **No marques la fase como hecha.**
3. Marca las casillas en [docs/roadmap.md](docs/roadmap.md) y en esta guía.
4. Cambia el estado de la fase a `Hecha` en la tabla de "Estado actual" y pon la siguiente en `En curso`.
5. `git add` + `git commit -m "Phase N: <summary>"` (en inglés).
6. Dile al autor, en español sencillo: qué se hizo, cómo se comprobó y qué se aprendió. **Pregunta antes de hacer `git push`.**
