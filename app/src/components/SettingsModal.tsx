import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { AvatarInfo } from "../types/avatar";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAvatarId: string;
  onSelectAvatar: (avatar: AvatarInfo) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  activeAvatarId,
  onSelectAvatar,
}: SettingsModalProps) {
  const [avatars, setAvatars] = useState<AvatarInfo[]>([]);
  const [avatarsPath, setAvatarsPath] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [autostart, setAutostart] = useState(false);

  useEffect(() => {
    if (isOpen) {
      invoke<AvatarInfo[]>("list_available_avatars")
        .then(setAvatars)
        .catch(console.error);

      invoke<string>("get_appdata_avatars_path")
        .then(setAvatarsPath)
        .catch(console.error);

      invoke<boolean>("get_autostart_status")
        .then(setAutostart)
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleAutostart = () => {
    const next = !autostart;
    invoke<boolean>("set_autostart_status", { enabled: next })
      .then((ok) => {
        if (ok) setAutostart(next);
      })
      .catch(console.error);
  };

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (avatarsPath) {
      navigator.clipboard.writeText(avatarsPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <motion.div
      className="settings-modal"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      initial={{ opacity: 0, y: -10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="settings-header">
        <div className="settings-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Ajustes
        </div>
        <button
          className="settings-close-btn"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Cerrar"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Cuadrícula limpia de avatares con miniatura */}
      <div className="avatar-grid">
        {avatars.map((av) => {
          const isSelected = av.id === activeAvatarId;
          return (
            <div
              key={av.id}
              className={`avatar-grid-card ${isSelected ? "selected" : ""}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAvatar(av);
              }}
            >
              {/* Miniatura visual limpia */}
              <div className="avatar-preview-icon">
                {av.id === "berto-classic" ? (
                  <svg width="34" height="28" viewBox="0 0 34 28" fill="none">
                    <rect x="2" y="2" width="30" height="22" rx="7" fill="#EDEFF5" />
                    <rect x="6" y="5" width="22" height="14" rx="4" fill="#11141E" />
                    <rect x="9" y="8" width="5" height="7" rx="2" fill="#9AE6E0" />
                    <rect x="20" y="8" width="5" height="7" rx="2" fill="#9AE6E0" />
                    <rect x="4" y="21" width="6" height="5" rx="2" fill="#EDEFF5" />
                    <rect x="24" y="21" width="6" height="5" rx="2" fill="#EDEFF5" />
                  </svg>
                ) : (
                  <svg width="34" height="28" viewBox="0 0 34 28" fill="none">
                    <rect x="15.5" y="0" width="3" height="5" rx="1.5" fill="#BAC3E6" />
                    <circle cx="17" cy="2" r="2" fill="#9AE6E0" />
                    <rect x="4" y="4" width="26" height="20" rx="3" fill="#BAC3E6" />
                    <rect x="7" y="7" width="20" height="12" rx="2" fill="#0F121B" />
                    <rect x="10" y="10" width="5" height="6" rx="1" fill="#9AE6E0" />
                    <rect x="19" y="10" width="5" height="6" rx="1" fill="#9AE6E0" />
                  </svg>
                )}
              </div>

              {/* Nombre y estado seleccionado */}
              <div className="avatar-grid-footer">
                <span className="avatar-grid-name">{av.name}</span>
                {isSelected && (
                  <span className="avatar-check-badge">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="settings-footer">
        <div className="autostart-setting-row" onClick={handleToggleAutostart}>
          <div className="autostart-label" style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Iniciar con Windows</span>
          </div>
          <div className={`switch-toggle ${autostart ? "on" : "off"}`}>
            <div className="switch-handle" />
          </div>
        </div>

        <div className="appdata-tip">
          <span className="appdata-tip-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Carpeta de modelos .glb:
          </span>
          <div className="appdata-path-box" onClick={handleCopyPath} title="Clic para copiar ruta">
            <code>{avatarsPath || "%APPDATA%\\Berto\\avatars"}</code>
            <button className="copy-btn">{copied ? "¡Copiado!" : "Copiar"}</button>
          </div>
        </div>

        <button
          className="exit-berto-btn"
          onClick={(e) => {
            e.stopPropagation();
            invoke("exit_app").catch(console.error);
          }}
          title="Cerrar Berto y todos sus procesos"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
            <line x1="12" y1="2" x2="12" y2="12" />
          </svg>
          <span>Salir de Berto</span>
        </button>
      </div>
    </motion.div>
  );
}

export default SettingsModal;
