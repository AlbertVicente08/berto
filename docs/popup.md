# La Isla Flotante (Popup de Berto)

Este documento define la arquitectura, diseño visual y comportamiento de la ventana de Berto en Windows.

---

## 1. Filosofía: Una "Isla Dinámica" en el Escritorio

Berto **no es una ventana de aplicación convencional**. No tiene barra de título, bordes rígidos ni marco clásico de Windows. 
Se inspira en el concepto de *Dynamic Island*: una **cápsula flotante translúcida** que emerge desde el borde superior central de la pantalla activa y se expande o contrae dinámicamente según lo que estés haciendo.

---

## 2. Configuración de la Ventana en Tauri 2

La ventana principal de Tauri se configura con los siguientes parámetros esenciales:
- **`decorations: false`**: Sin bordes, barra de título ni botones de minimizar/cerrar.
- **`transparent: true`**: El lienzo de la ventana permite canal alfa (transparencia total).
- **`alwaysOnTop: true`**: La isla flota siempre por encima de cualquier otra aplicación.
- **`skipTaskbar: true`**: No satura la barra de tareas de Windows; vive como una utilidad accesible vía atajo o bandeja del sistema.
- **Soporte Multi-monitor y Escala:** La posición se calcula en tiempo de ejecución obteniendo las dimensiones, escala (DPI) y posición del monitor activo (donde esté ubicado el cursor del ratón o la app enfocada).

---

## 3. Estados de la Isla

La isla cuenta con dos modos principales:

### 3.1. Estado Base (Cápsula Compacta)
- **Dimensiones reducidas:** Barra redondeada centrada en el borde superior.
- **Material visual (Cristal sin window-vibrancy):** Cápsula oscura semitransparente con degradado suave, borde sutil luminoso y sombra difusa con acento del token de color (cian `#00E5FF`).
  > **Nota de diseño crítica:** **NO** se utiliza Acrylic ni Mica nativo del sistema operativo (vía `window-vibrancy`) porque esos efectos se aplican obligatoriamente a todo el rectángulo de la ventana nativa (que es mucho más grande que la cápsula), lo que revelaría un recuadro rectangular rígido en pantalla. En su lugar, el efecto de cristal oscuro se implementa en la propia cápsula mediante CSS (`background: linear-gradient(...)`, `backdrop-filter: blur`, bordes con canal alfa y sombras multicapa), garantizando que todo el resto de la ventana sea 100% transparente.
- **Berto asomado:** La cabeza y hombros del robot 3D sobresalen por encima del borde superior de la cápsula en el centro, vigilando con sus ojos LED que siguen el cursor o miran a un punto específico.

### 3.2. Estado Expandido (Interacción y Chat)
- Se activa al hacer clic en la cápsula, al escribir o al recibir una respuesta de IA.
- La cápsula crece hacia abajo con una animación fluida de tipo "morph", alojando la caja de texto, controles y el historial de conversación.
- Las dimensiones se adaptan suavemente al contenido.

---

## 4. Animaciones y Física de Muelle (Spring Animations)

Para conseguir una sensación orgánica y premium ("vibe" moderno), las transiciones no son lineales ni rígidas.
- **Librería seleccionada:** [Framer Motion](https://motion.dev/) (`motion` para React).
  - *Justificación:* Es el estándar de oro en el ecosistema React para animaciones basadas en física real (rigidez `stiffness`, amortiguamiento `damping`, masa `mass`). Maneja transiciones de layout automáticas (`layout` prop), permitiendo que la cápsula se expanda y encoja fluidamente sin saltos bruscos.
- **Entrada de la isla:** Deslizamiento suave desde arriba hacia abajo (`translateY: -100% -> 0`) acompañado de un fundido de opacidad (`opacity: 0 -> 1`). Al mismo tiempo, Berto sube y se asoma por encima.
- **Salida de la isla:** Berto se esconde tras la cápsula y la isla se desliza hacia arriba desvaneciéndose.

---

## 5. Control del Foco y Comportamiento de Ocultación

La isla debe sentirse no intrusiva:
1. **Atajo global (`Ctrl+Alt+B`):** Por defecto se usa `Ctrl+Alt+B` (configurable mediante `BERTO_HOTKEY` en `.env`). Se eligió `Ctrl+Alt+B` (B de Berto) para **evitar conflictos** con atajos de otras apps (`Ctrl+Espacio` es el IntelliSense de VS Code y `Ctrl+Alt+Espacio` lo usa Claude). Alterna entre mostrar y ocultar la isla de inmediato, incluso con otra app en primer plano.
2. **Tecla `Esc`:** Cierra/oculta la isla de inmediato.
3. **Pérdida de foco (`blur`):** Si el usuario hace clic fuera de la isla en otra aplicación, la isla se oculta suavemente.

---

## 6. Zonas Transparentes y Clics a Través (Click-Through)

### El Reto Técnico
Para permitir que la cápsula se expanda hacia abajo y que el avatar asome por arriba, la ventana nativa de Tauri debe ser más grande que la cápsula visible en estado compacto. Sin embargo, las áreas vacías y transparentes de esa ventana **no deben bloquear los clics** del usuario hacia las ventanas que están debajo.

### Por qué el enfoque web (`mouseenter`/`mouseleave`) NO funciona
Si la ventana tiene activado `window.set_ignore_cursor_events(true)`, el sistema operativo descarta todos los eventos del ratón para esa ventana antes de que lleguen al motor web (WebView2). Por tanto, la interfaz web **nunca recibe `mouseenter`, `mouseleave` ni `mousemove`**, lo que provocaría que la cápsula quede bloqueada permanentemente sin poder volver a activarse.

### Solución nativa implementada en Rust
La detección de interacción se gestiona directamente en el proceso nativo en Rust:
1. **Sondeo global del cursor:** Un hilo ligero en segundo plano en Rust consulta periódicamente (cada 16 a 50 ms) la posición global del cursor del ratón en la pantalla utilizando la API de Windows (`GetCursorPos`).
2. **Sincronización del rectángulo visible:** La interfaz comunica a Rust el rectángulo delimitador (*bounding box*: posición `x, y`, ancho y alto) de la cápsula visible cuando esta cambia de tamaño o posición.
3. **Control dinámico de click-through:**
   - **Cursor dentro del rectángulo de la cápsula:** Rust ejecuta `window.set_ignore_cursor_events(false)`. La cápsula se vuelve interactiva: puedes hacer clic, interactuar con el chat o escribir en la caja de texto.
   - **Cursor fuera del rectángulo de la cápsula:** Rust ejecuta `window.set_ignore_cursor_events(true)`. Los clics del ratón ignoran la ventana de Berto y llegan limpiamente a las aplicaciones de debajo (VS Code, navegador, escritorio).
4. **Alimentación del `lookAt` del Avatar:** La misma posición global del cursor que Rust lee continuamente se aprovecha para calcular la orientación de la mirada (`lookAt`) del avatar 3D. Esto permite que los ojos de Berto sigan el cursor por toda la pantalla de forma fluida, incluso cuando el ratón se encuentra fuera de la cápsula visible.
5. **Eliminación del Efecto Fantasma:** Para evitar que la geometría inferior del avatar (cuerpo, patas) se transparente a través del cristal oscuro de la cápsula, se implementaron dos capas de protección:
   - Recorte inferior exacto en CSS (`clip-path: inset(-100px -60px 17px -60px)`) en el contenedor del avatar.
   - Fondo con capa base opaca (`#141724`) en la cápsula, bloqueando cualquier proyección indeseada.

---

## 7. Bandeja del Sistema (System Tray) y Autoarranque con Windows

Berto incluye integración nativa completa en la bandeja del sistema (junto al reloj de Windows):
- **Icono en la bandeja:**
  - **Clic izquierdo:** Alterna entre mostrar u ocultar la isla flotante.
  - **Menú contextual (clic derecho):**
    - `👁️ Mostrar / Ocultar`: Alterna la visibilidad.
    - `⚙️ Ajustes`: Abre directamente el modal de configuración y selector de avatares.
    - `🚀 Iniciar con Windows`: Opción con casilla de verificación (*checkmark*) para arrancar Berto al iniciar sesión.
    - `❌ Salir`: Cierre ordenado y definitivo.
- **Autoarranque con Windows:**
  - Implementado sin dependencias externas mediante el Registro de Windows del usuario (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).
  - No requiere permisos de administrador. Configurable tanto desde el menú de la bandeja como desde el interruptor en el modal de Ajustes.
- **Cierre Limpio del Sistema:**
  - Al pulsar "Salir", Rust finaliza cualquier proceso hijo que haya lanzado (como el servidor FastAPI de Python), notifica al endpoint de cierre `/shutdown` y termina la aplicación inmediatamente con código 0.

---

## 8. Futura Vinculación con Aplicaciones (El Halo)

*(Previsto para las Fases 3 y 4)*

Cuando Berto se vincule a una app activa (por ejemplo VS Code o Chrome):
1. **Halo de seguridad:** Una ventana transparente complementaria rodeará el perímetro exacto de la aplicación vinculada con un resplandor en cian eléctrico (`#00E5FF`). El halo seguirá a la ventana si se mueve o cambia de tamaño.
2. **Indicador de estado:**
   - *Vinculada en reposo:* Halo fijo, tenue.
   - *Actuando / ejecutando herramientas:* El halo pulsa rítmicamente.
3. **Mirada del avatar:** La isla permanece arriba centrada, pero Berto orientará su cabeza y ojos hacia las coordenadas de esa ventana (`lookAt`), reforzando la idea de que está "vigilando" o interactuando con dicha aplicación.
