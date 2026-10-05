# Sistema de Avatares de Berto

Este documento define la arquitectura, diseño y especificación técnica de los avatares en Berto.

---

## 1. Concepto y Estilo de Berto

Berto se concibe visualmente como un **robot minimalista en 3D**:
- **Cabeza y silueta:** Cabeza redondeada de ~90-110 px en cerámica blanco perla mate (`#EDEFF5`), visor frontal oscuro de obsidiana y manitas/patitas apoyadas sobre el borde superior de la cápsula.
- **Ojos y expresión:** Ojos LED redondeados y expresivos en color aqua pastel (`#9AE6E0`) con brillo emisivo.
- **Color característico (Design Token):** Aqua pastel (`#9AE6E0`) por defecto en `theme.css`. Modificable de forma centralizada en dicho archivo sin tocar la lógica del avatar.
- **Presencia sin huecos:** Berto se asoma justo detrás del borde superior de la cápsula (solape de 18 px) con recorte inferior exacto (`clip-path`) para evitar que el cuerpo se transparente a través del cristal ("efecto fantasma").
- **Mirada dirigida:** Sus ojos y cabeza siguen el cursor del ratón en tiempo real utilizando las coordenadas globales de pantalla enviadas continuamente por el hilo en segundo plano de Rust.
  - En las Fases 3 y 4, esta misma capacidad orientará la mirada fijamente hacia la ventana vinculada con el halo de seguridad.

---

## 2. Tecnologías

Para garantizar rendimiento, flexibilidad y soporte multiplataforma:
- **Librería 3D:** [Three.js](https://threejs.org/) a través de [React Three Fiber](https://r3f.docs.pmnd.rs/) (`@react-three/fiber`) y helpers de [Drei](https://github.com/pmndrs/drei) (`@react-three/drei`).
- **Formato estándar de modelos externos:** **glTF binario (`.glb`)**. Es el estándar abierto universal para gráficos 3D en tiempo real en la web, ligero, eficiente y autocontenido (geometría, materiales, texturas y animaciones en un solo archivo).

---

## 3. Contrato de un Avatar y Tipos de Avatar

El principio fundamental del sistema es que **la aplicación nunca depende de cómo está hecho un avatar concreto**. La app interactúa con ellos a través de un contrato desacoplado:

```typescript
export type AvatarState = 'reposo' | 'escuchando' | 'pensando' | 'hablando';

export interface CursorData {
  rel_x: number;
  rel_y: number;
  screen_x: number;
  screen_y: number;
  is_inside: boolean;
}

export interface AvatarProps {
  status: AvatarState;        // Estado operativo actual
  cursorData: CursorData | null; // Posición global del ratón
  isVisible: boolean;         // Si la isla está oculta, pausar el bucle de render (0% GPU)
  isExcited?: boolean;        // Reacción al clic directo en Berto
  isAsleep?: boolean;         // Modo sueño tras 20s de inactividad
  isWakingUp?: boolean;       // Pequeño sobresalto al despertar
}
```

Cada avatar interpreta estos estados:
- **`reposo`**: Respiración suave, parpadeo periódico y seguimiento del cursor.
  - **Modo sueño:** Tras ~20 segundos sin actividad, Berto se duerme: ojos cerrados en arcos (`⌒ ⌒`), respiración lenta y letras `z z Z` flotando en lavanda pastel (`#C3B8F5`). Se despierta con un sobresalto al mover el ratón, escribir o hacer clic.
- **`escuchando`**: Ojos aqua brillantes y cabeza inclinada atenta hacia el usuario (se activa al enfocar el campo de texto).
- **`pensando`**: Ojos en lavanda pastel (`#C3B8F5`) con parpadeo suave y mirada reflexiva hacia arriba (durante la llamada al LLM).
- **`hablando`**: Ojos en menta pastel (`#A8E6C3`) modulando vocalización y sutil cabeceo modulado (durante la respuesta en streaming).

### Distinción crítica entre tipos de avatar:

| Tipo | Formato | Carga y Recompilación | Cuándo usarlo |
|---|---|---|---|
| **`glb`** (Externo) | Modelo `.glb` + `avatar.json` | **En tiempo de ejecución (SIN recompilar).** Se pueden añadir soltando una carpeta en `%APPDATA%\Berto\avatars\`. | Avatares creados por la comunidad en Blender, modelos descargados o personalizados. |
| **`code`** (Nativo) | Componente TSX (Three.js/R3F) + `avatar.json` | **En tiempo de compilación (REQUIERE recompilar).** Forma parte del código de la app. | El avatar por defecto de Berto, que aprovecha shaders procedimentales o geometrías nativas de Three.js. |

---

## 4. Estructura de Carpetas y Descubrimiento en Tiempo de Ejecución

Berto busca avatares en dos ubicaciones:
1. **Avatares integrados en la app:** `app/avatars/` (y expuestos en el bundle web).
2. **Carpeta de datos del usuario (Runtime sin recompilar):** `%APPDATA%\Berto\avatars\` (o `data/avatars/` en desarrollo local).

```text
# En el repositorio (integrados):
app/avatars/
├── berto-default/          # Avatar nativo en código R3F
│   ├── avatar.json         # type: "code"
│   └── BertoModel.tsx
└── robot-cube/             # Avatar de prueba incluido
    ├── avatar.json         # type: "glb"
    ├── model.glb
    └── preview.png

# En el equipo del usuario (añadidos sin tocar código):
%APPDATA%\Berto\avatars\
└── mi-avatar-comunidad/
    ├── avatar.json         # type: "glb"
    ├── model.glb
    └── preview.png
```

### Formato de `avatar.json`

Cada avatar incluye obligatoriamente este manifiesto:

```json
{
  "id": "robot-cube",
  "name": "Cube Bot",
  "version": "1.0.0",
  "author": "Comunidad Berto",
  "description": "Avatar cúbico de prueba para verificar modelos externos",
  "license": "MIT",
  "type": "glb",
  "entry": "model.glb",
  "preview": "preview.png"
}
```

---

## 5. Guía para Crear un Avatar Propio (Sin tocar código)

Cualquier persona puede crear y compartir un avatar para Berto siguiendo estos pasos:

1. **Modelado en 3D:**
   - Diseña tu robot o personaje en [Blender](https://www.blender.org/) o tu software 3D preferido.
   - Mantén un número moderado de polígonos (low-poly recomendado: < 15.000 caras).
   - Opcional: define huesos o nodos para la cabeza y ojos para el seguimiento de mirada.
2. **Exportar a `.glb`:**
   - En Blender: `Archivo > Exportar > glTF 2.0 (.glb)`.
   - Incluye materiales y texturas empaquetadas en el archivo binario.
3. **Instalación instantánea:**
   - Abre la carpeta de avatares del usuario: `%APPDATA%\Berto\avatars\` (puedes crearla si no existe).
   - Crea una subcarpeta con el nombre de tu avatar (p. ej. `mi-robot/`).
   - Copia dentro el archivo `model.glb`, una imagen `preview.png` y crea tu `avatar.json`.
4. **Selección en Ajustes:**
   - Abre Ajustes en la isla flotante de Berto.
   - Tu avatar aparecerá en la lista al instante. Al seleccionarlo, se cargará inmediatamente sin reiniciar ni recompilar nada.

---

## 6. Rendimiento y Optimización

- **Pausa fuera de pantalla (0% GPU):** Cuando la isla flotante está oculta o minimizada, el bucle de render de Three.js se congela (`frameloop="demand"` o deshabilitando el renderizado de frames). Esto asegura que Berto no consuma ciclos de GPU cuando no esté visible.
- **Materiales eficientes:** Uso de materiales PBR optimizados (`MeshStandardMaterial` o equivalentes ligeros).
