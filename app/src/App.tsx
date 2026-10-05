import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "framer-motion";
import { AvatarInfo, AvatarState, CursorData } from "./types/avatar";
import { AvatarRenderer } from "./components/AvatarRenderer";
import { SettingsModal } from "./components/SettingsModal";
import "./App.css";

const BACKEND_URL = "http://127.0.0.1:8765";

function App() {
  const islandRef = useRef<HTMLDivElement>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Estados de visibilidad, expansión, cursor y backend
  const [isVisible, setIsVisible] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [pythonOk, setPythonOk] = useState(false);
  const [cursorData, setCursorData] = useState<CursorData | null>(null);
  const [isExcited, setIsExcited] = useState(false);

  // Sistema de sueño tras 20s de inactividad
  const lastActivityRef = useRef<number>(Date.now());
  const [isAsleep, setIsAsleep] = useState(false);
  const [isWakingUp, setIsWakingUp] = useState(false);

  // Estados del avatar: los 4 estados requeridos
  const [avatarStatus, setAvatarStatus] = useState<AvatarState>("reposo");

  // Sistema de avatares intercambiables
  const [activeAvatar, setActiveAvatar] = useState<AvatarInfo | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Modo depuración: solo activo si BERTO_DEBUG=1 en .env (se consulta a Rust al arrancar)
  const [isDebug, setIsDebug] = useState(false);

  // La cápsula se expande si tiene foco o texto escrito
  const isExpanded = isFocused || query.trim().length > 0;

  // Registrar actividad y despertar a Berto si estaba dormido
  const notifyActivity = () => {
    lastActivityRef.current = Date.now();
    if (isAsleep) {
      setIsAsleep(false);
      setIsWakingUp(true);
      setTimeout(() => setIsWakingUp(false), 500);
    }
  };

  // Comprobar si BERTO_DEBUG=1 está configurado en .env desde Rust
  useEffect(() => {
    invoke<boolean>("is_debug_mode")
      .then((debug) => {
        if (debug) setIsDebug(true);
      })
      .catch(console.error);
  }, []);

  // Cargar lista de avatares sin duplicados y recordar la última elección del usuario
  useEffect(() => {
    invoke<AvatarInfo[]>("list_available_avatars")
      .then((list) => {
        const savedId = localStorage.getItem("berto_selected_avatar_id");
        if (savedId) {
          const match = list.find((a) => a.id === savedId);
          if (match) {
            setActiveAvatar(match);
            return;
          }
        }
        // Por defecto: Berto Clásico
        const defaultAv = list.find((a) => a.id === "berto-classic") || list[0] || null;
        setActiveAvatar(defaultAv);
      })
      .catch(console.error);
  }, []);

  const handleSelectAvatar = (av: AvatarInfo) => {
    setActiveAvatar(av);
    localStorage.setItem("berto_selected_avatar_id", av.id);
    setIsSettingsOpen(false);
    notifyActivity();
  };

  // Temporizador de inactividad (20 segundos) para dormirse en estado reposo
  useEffect(() => {
    const timer = setInterval(() => {
      if (avatarStatus === "reposo" && !isAsleep && isVisible) {
        if (Date.now() - lastActivityRef.current >= 20000) {
          setIsAsleep(true);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [avatarStatus, isAsleep, isVisible]);

  // Sincronizar las dimensiones de TODO el popup (isla completa) con Rust para el click-through
  const syncBounds = () => {
    if (isVisible && islandRef.current) {
      const islandRect = islandRef.current.getBoundingClientRect();
      const avRect = avatarRef.current?.getBoundingClientRect();

      if (islandRect.width > 0 && islandRect.height > 0) {
        invoke("update_interactive_bounds", {
          capsule: {
            x: Math.max(0, islandRect.left - 12),
            y: Math.max(0, islandRect.top - 6),
            width: islandRect.width + 24,
            height: islandRect.height + 24,
          },
          avatar: avRect
            ? {
                x: avRect.left,
                y: avRect.top,
                width: avRect.width,
                height: avRect.height,
              }
            : null,
        }).catch(console.error);
      }
    }
  };

  // Solicitar ocultación suave con animación
  const handleRequestHide = () => {
    setIsVisible(false);
    setIsSettingsOpen(false);
  };

  // Al terminar la animación de salida, avisamos a Rust para ocultar la ventana nativa
  const handleExitComplete = () => {
    invoke("clear_interactive_bounds").catch(console.error);
    invoke("hide_window").catch(console.error);
  };

  // Reacción al hacer clic directamente en Berto
  const handleAvatarClick = () => {
    notifyActivity();
    setIsExcited(true);
    setTimeout(() => setIsExcited(false), 900);
  };

  // Desactivar menú contextual nativo salvo si BERTO_DEBUG=1
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (!isDebug) {
        e.preventDefault();
      }
    };
    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, [isDebug]);

  // Sondeo continuo de salud del backend Python (pausado cuando la isla está oculta)
  useEffect(() => {
    if (!isVisible) return;

    const checkHealth = () => {
      fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(1500) })
        .then((res) => {
          if (!res.ok) throw new Error("HTTP error");
          return res.json();
        })
        .then((data) => {
          setPythonOk(data.status === "ok");
        })
        .catch(() => {
          setPythonOk(false);
        });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 2500);
    return () => clearInterval(interval);
  }, [isVisible]);

  useEffect(() => {
    syncBounds();
    window.addEventListener("resize", syncBounds);

    // Tecla Escape para cerrar
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else {
          handleRequestHide();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Eventos enviados desde Rust
    let unlistenShow: (() => void) | undefined;
    let unlistenHide: (() => void) | undefined;
    let unlistenCursor: (() => void) | undefined;
    let unlistenSettings: (() => void) | undefined;

    listen("request-show", () => {
      setIsVisible(true);
      notifyActivity();
      setTimeout(() => inputRef.current?.focus(), 80);
    }).then((unsub) => (unlistenShow = unsub));

    listen("request-hide", () => {
      handleRequestHide();
    }).then((unsub) => (unlistenHide = unsub));

    listen("open-settings", () => {
      setIsVisible(true);
      setIsSettingsOpen(true);
      notifyActivity();
    }).then((unsub) => (unlistenSettings = unsub));

    listen<CursorData>("cursor-moved", (event) => {
      setCursorData(event.payload);
      if (event.payload.is_inside) {
        notifyActivity();
      }
    }).then((unsub) => (unlistenCursor = unsub));

    return () => {
      window.removeEventListener("resize", syncBounds);
      window.removeEventListener("keydown", handleKeyDown);
      if (unlistenShow) unlistenShow();
      if (unlistenHide) unlistenHide();
      if (unlistenCursor) unlistenCursor();
      if (unlistenSettings) unlistenSettings();
    };
  }, [isSettingsOpen, isAsleep]);

  // Actualizar bounds en Rust inmediatamente cuando cambia la forma
  useEffect(() => {
    syncBounds();
    const timer = setTimeout(syncBounds, 60);
    return () => clearTimeout(timer);
  }, [isExpanded, isVisible, isSettingsOpen, isDebug, activeAvatar]);

  return (
    <div className="island-viewport">
      <AnimatePresence onExitComplete={handleExitComplete}>
        {isVisible && (
          <motion.div
            ref={islandRef}
            className="island-root"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{
              y: -80,
              opacity: 0,
              transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] },
            }}
            transition={{
              y: { type: "spring", stiffness: 360, damping: 26, mass: 0.8 },
              opacity: { duration: 0.2 },
            }}
            onLayoutAnimationComplete={syncBounds}
            onAnimationComplete={syncBounds}
          >
            {/* Avatar 3D (Berto nativo o modelo .glb externo) */}
            <motion.div
              ref={avatarRef}
              className="avatar-stage"
              initial={{ y: 32, opacity: 0, scale: 0.85 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 32, opacity: 0, scale: 0.85 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 24,
                delay: 0.04,
              }}
              onClick={handleAvatarClick}
              title={`Avatar activo: ${activeAvatar?.name || "Berto"}`}
            >
              {/* Partículas flotantes de sueño si está dormido */}
              {isAsleep && (
                <div className="sleep-particles">
                  <span className="sleep-z z1">z</span>
                  <span className="sleep-z z2">z</span>
                  <span className="sleep-z z3">Z</span>
                </div>
              )}

              <AvatarRenderer
                activeAvatar={activeAvatar}
                cursorData={cursorData}
                isVisible={isVisible}
                status={avatarStatus}
                isExcited={isExcited}
                isAsleep={isAsleep}
                isWakingUp={isWakingUp}
              />
            </motion.div>

            {/* Cápsula de entrada y chat */}
            <motion.div
              ref={capsuleRef}
              layout
              onLayoutAnimationComplete={syncBounds}
              onAnimationComplete={syncBounds}
              className={`capsule ${isFocused ? "focused" : ""}`}
              style={{
                width: isExpanded
                  ? "var(--capsule-width-expanded)"
                  : "var(--capsule-width-compact)",
                borderRadius: "var(--capsule-radius-compact)",
              }}
              transition={{
                layout: { type: "spring", stiffness: 420, damping: 28, mass: 0.8 },
              }}
            >
              {/* Barra principal compacta (44px con borde) */}
              <div
                className="capsule-bar"
                onClick={() => {
                  notifyActivity();
                  inputRef.current?.focus();
                }}
              >
                <span
                  className={`status-dot ${pythonOk ? "online" : "offline"}`}
                  title={
                    pythonOk
                      ? "Cerebro Python conectado (127.0.0.1:8765)"
                      : "Sin conexión con el cerebro Python (127.0.0.1:8765)"
                  }
                />

                <input
                  ref={inputRef}
                  className="capsule-input"
                  type="text"
                  value={query}
                  onChange={(e) => {
                    notifyActivity();
                    setQuery(e.target.value);
                  }}
                  onFocus={() => {
                    notifyActivity();
                    setIsFocused(true);
                    if (avatarStatus === "reposo") {
                      setAvatarStatus("escuchando");
                    }
                  }}
                  onBlur={() => {
                    setIsFocused(false);
                    if (avatarStatus === "escuchando") {
                      setAvatarStatus("reposo");
                    }
                  }}
                  placeholder="Pregunta a Berto..."
                  spellCheck={false}
                />

                {query.length > 0 && (
                  <button
                    type="button"
                    className="capsule-action-btn"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      notifyActivity();
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                    title="Limpiar"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}

                {/* Botón de Ajustes / Selector de Avatar (Engranaje) */}
                <button
                  type="button"
                  className="capsule-settings-btn"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    notifyActivity();
                    setIsSettingsOpen((prev) => !prev);
                  }}
                  title="Ajustes / Cambiar Avatar 3D"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
              </div>

              {/* Contenido expandido: sugerencias y acciones */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    key="expanded-content"
                    className="capsule-expanded-content"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <div className="quick-prompts">
                      <span
                        className="prompt-chip"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          notifyActivity();
                          setQuery("¿Qué app tengo abierta?");
                          setAvatarStatus("pensando");
                          inputRef.current?.focus();
                        }}
                      >
                        <svg
                          className="chip-icon"
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="3" width="20" height="14" rx="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        ¿Qué app tengo abierta?
                      </span>
                      <span
                        className="prompt-chip"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          notifyActivity();
                          setQuery("Explícame este código");
                          setAvatarStatus("hablando");
                          inputRef.current?.focus();
                        }}
                      >
                        <svg
                          className="chip-icon"
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="16 18 22 12 16 6" />
                          <polyline points="8 6 2 12 8 18" />
                        </svg>
                        Explícame este código
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Modal de Ajustes (Selector de Avatar en cuadrícula compacta) */}
            <AnimatePresence>
              {isSettingsOpen && (
                <SettingsModal
                  isOpen={isSettingsOpen}
                  onClose={() => setIsSettingsOpen(false)}
                  activeAvatarId={activeAvatar?.id || "berto-classic"}
                  onSelectAvatar={handleSelectAvatar}
                />
              )}
            </AnimatePresence>

            {/* Panel de depuración: 4 estados visibles directamente para prueba */}
            {isDebug && (
              <div
                className="debug-overlay"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="debug-header">
                  <span>🛠️ Panel de Estados (BERTO_DEBUG=1)</span>
                  <span>Avatar: <strong>{activeAvatar?.name}</strong></span>
                </div>

                <div className="debug-state-bar">
                  <button
                    type="button"
                    className={`debug-state-btn ${avatarStatus === "reposo" && !isAsleep ? "active" : ""}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      notifyActivity();
                      setAvatarStatus("reposo");
                    }}
                    title="Vigilando, despierto y siguiendo el cursor"
                  >
                    💤 Reposo
                  </button>
                  <button
                    type="button"
                    className={`debug-state-btn ${isAsleep ? "active" : ""}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setAvatarStatus("reposo");
                      setIsAsleep(true);
                    }}
                    title="Dormir inmediatamente (ojos cerrados y z z Z)"
                  >
                    😴 Dormir (z z Z)
                  </button>
                  <button
                    type="button"
                    className={`debug-state-btn ${avatarStatus === "escuchando" ? "active" : ""}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      notifyActivity();
                      setAvatarStatus("escuchando");
                    }}
                    title="Ojos aqua brillantes y cabeza inclinada atenta"
                  >
                    👂 Escuchando
                  </button>
                  <button
                    type="button"
                    className={`debug-state-btn ${avatarStatus === "pensando" ? "active" : ""}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      notifyActivity();
                      setAvatarStatus("pensando");
                    }}
                    title="Ojos lavanda pulsantes y mirada reflexiva"
                  >
                    💭 Pensando
                  </button>
                  <button
                    type="button"
                    className={`debug-state-btn ${avatarStatus === "hablando" ? "active" : ""}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      notifyActivity();
                      setAvatarStatus("hablando");
                    }}
                    title="Ojos menta modulando vocalización y cabeceo"
                  >
                    💬 Hablando
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
