import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { invoke } from "@tauri-apps/api/core";
import { AvatarState, CursorData } from "../types/avatar";

interface GLBAvatarProps {
  modelUrl?: string | null;
  localPath?: string | null;
  cursorData: CursorData | null;
  isVisible: boolean;
  status: AvatarState;
  isExcited?: boolean;
}

function GLBModelMesh({
  scene,
  cursorData,
  status,
  isExcited,
}: {
  scene: THREE.Group;
  cursorData: CursorData | null;
  status: AvatarState;
  isExcited?: boolean;
}) {
  const modelRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!modelRef.current) return;
    const time = state.clock.elapsedTime;

    let targetRotY = 0;
    let targetRotX = 0;

    if (cursorData) {
      const dx = (cursorData.rel_x - 400) / 400;
      const dy = (cursorData.rel_y - 42) / 450;
      targetRotY = THREE.MathUtils.clamp(dx * 0.44, -0.55, 0.55);
      targetRotX = THREE.MathUtils.clamp(dy * 0.32, -0.15, 0.35);
    }

    // Variaciones según el estado
    let stateRotZ = 0;
    let stateRotXOffset = 0;
    let stateRotYOffset = 0;

    if (status === "escuchando") {
      stateRotZ = Math.sin(time * 1.5) * 0.08 + 0.06;
      stateRotXOffset = 0.05;
    } else if (status === "pensando") {
      stateRotXOffset = -0.12;
      stateRotYOffset = Math.sin(time * 1.2) * 0.16 + 0.1;
    } else if (status === "hablando") {
      stateRotXOffset = Math.sin(time * 9.0) * 0.08;
    }

    if (isExcited) {
      stateRotXOffset += Math.sin(time * 14) * 0.12;
    }

    modelRef.current.rotation.y = THREE.MathUtils.lerp(
      modelRef.current.rotation.y,
      targetRotY + stateRotYOffset,
      0.13
    );
    modelRef.current.rotation.x = THREE.MathUtils.lerp(
      modelRef.current.rotation.x,
      targetRotX + stateRotXOffset,
      0.13
    );
    modelRef.current.rotation.z = THREE.MathUtils.lerp(
      modelRef.current.rotation.z,
      stateRotZ,
      0.13
    );

    // Respiración sutil en reposo
    const breath = Math.sin(time * 2.2) * 0.02;
    modelRef.current.position.y = THREE.MathUtils.lerp(
      modelRef.current.position.y,
      -0.08 + breath,
      0.1
    );
  });

  return (
    <group ref={modelRef} position={[0, -0.08, 0]}>
      <primitive object={scene} />
    </group>
  );
}

export function GLBAvatar({
  modelUrl,
  localPath,
  cursorData,
  isVisible,
  status,
  isExcited = false,
}: GLBAvatarProps) {
  const [loadedScene, setLoadedScene] = useState<THREE.Group | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const loader = new GLTFLoader();

    const processGLB = (arrayBuffer: ArrayBuffer) => {
      loader.parse(
        arrayBuffer,
        "",
        (gltf) => {
          if (isCancelled) return;
          const root = gltf.scene;

          // Auto-escalado y centrado del modelo para que encaje perfectamente en la cápsula
          const box = new THREE.Box3().setFromObject(root);
          const size = new THREE.Vector3();
          box.getSize(size);
          const center = new THREE.Vector3();
          box.getCenter(center);

          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = maxDim > 0 ? 1.5 / maxDim : 1;
          root.scale.setScalar(scale);

          // Centrar en el origen
          root.position.x = -center.x * scale;
          root.position.y = -center.y * scale;
          root.position.z = -center.z * scale;

          setLoadedScene(root);
          setLoadError(null);
        },
        (err) => {
          if (!isCancelled) {
            console.error("Error parsing GLB:", err);
            setLoadError("Error al procesar el modelo .glb");
          }
        }
      );
    };

    if (localPath) {
      // Carga desde ruta local en disco (%APPDATA%\Berto\avatars\...) mediante comando de Rust
      invoke<number[]>("read_avatar_glb_bytes", { filePath: localPath })
        .then((bytes) => {
          const u8 = new Uint8Array(bytes);
          processGLB(u8.buffer);
        })
        .catch((err) => {
          console.error("Error loading local GLB:", err);
          setLoadError("No se pudo leer el archivo .glb local");
        });
    } else if (modelUrl) {
      // Carga desde URL relativa / pública del frontend
      fetch(modelUrl)
        .then((res) => res.arrayBuffer())
        .then(processGLB)
        .catch((err) => {
          console.error("Error fetching GLB URL:", err);
          setLoadError("No se pudo descargar el modelo .glb");
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [modelUrl, localPath]);

  if (loadError) {
    return (
      <div style={{ color: "#F5B8C3", fontSize: "11px", textAlign: "center", padding: "10px" }}>
        ⚠️ {loadError}
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 0, 2.35], fov: 38 }}
      frameloop={isVisible ? "always" : "never"}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      }}
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      <ambientLight intensity={0.95} />
      <directionalLight position={[1.5, 2.5, 3]} intensity={1.2} />
      <directionalLight position={[-1.5, 1, 2]} intensity={0.4} color="#EDEFF5" />
      <directionalLight position={[0, 3, -2.5]} intensity={2.2} color="#9AE6E0" />
      <pointLight position={[0, -0.8, 0.8]} intensity={0.6} color="#9AE6E0" distance={2.2} />

      {loadedScene && (
        <GLBModelMesh
          scene={loadedScene}
          cursorData={cursorData}
          status={status}
          isExcited={isExcited}
        />
      )}
    </Canvas>
  );
}

export default GLBAvatar;
