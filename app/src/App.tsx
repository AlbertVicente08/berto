import { useState, useEffect } from "react";
import "./App.css";

interface HealthStatus {
  connected: boolean;
  statusText: string;
  loading: boolean;
}

const BACKEND_URL = "http://127.0.0.1:8765";

function App() {
  const [health, setHealth] = useState<HealthStatus>({
    connected: false,
    statusText: "Comprobando conexión...",
    loading: true,
  });

  const checkHealth = async () => {
    setHealth((prev) => ({ ...prev, loading: true }));
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.status === "ok") {
        setHealth({
          connected: true,
          statusText: "Python conectado (status: ok)",
          loading: false,
        });
      } else {
        setHealth({
          connected: false,
          statusText: `Respuesta inesperada: ${JSON.stringify(data)}`,
          loading: false,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setHealth({
        connected: false,
        statusText: `No conectado: ${msg}`,
        loading: false,
      });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <main className="container">
      <h1>Berto</h1>
      <p style={{ opacity: 0.8, marginTop: "-0.5rem", marginBottom: "2rem" }}>
        Agente de IA de código abierto para Windows (Fase 0: Cimientos)
      </p>

      <div
        style={{
          margin: "1.5rem auto",
          padding: "1rem 1.5rem",
          borderRadius: "12px",
          maxWidth: "400px",
          backgroundColor: health.connected ? "#1e3a2f" : "#3d2222",
          color: health.connected ? "#4ade80" : "#f87171",
          border: `1px solid ${health.connected ? "#22c55e" : "#ef4444"}`,
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.2rem" }}>
            {health.loading ? "⏳" : health.connected ? "🟢" : "🔴"}
          </span>
          <strong style={{ fontSize: "1.1rem" }}>
            {health.loading
              ? "Conectando con Python..."
              : health.connected
              ? "Python conectado"
              : "Desconectado"}
          </strong>
        </div>
        <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", marginBottom: 0, opacity: 0.9 }}>
          {health.statusText}
        </p>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <button onClick={checkHealth} disabled={health.loading}>
          {health.loading ? "Reintentando..." : "Reverificar conexión"}
        </button>
      </div>

      <p style={{ marginTop: "2.5rem", fontSize: "0.8rem", opacity: 0.6 }}>
        Servicio backend en: <code>{BACKEND_URL}/health</code>
      </p>
    </main>
  );
}

export default App;
