import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { AvatarState, CursorData } from "../types/avatar";

interface BertoAvatarProps {
  cursorData: CursorData | null;
  isVisible: boolean;
  status?: AvatarState;
  isExcited?: boolean;
  isAsleep?: boolean;
  isWakingUp?: boolean;
}

function RobotMesh({
  cursorData,
  status = "reposo",
  isExcited = false,
  isAsleep = false,
  isWakingUp = false,
}: {
  cursorData: CursorData | null;
  status: AvatarState;
  isExcited?: boolean;
  isAsleep?: boolean;
  isWakingUp?: boolean;
}) {
  const headGroupRef = useRef<THREE.Group>(null);
  const eyesGroupRef = useRef<THREE.Group>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const eyeMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // Color de ojos según el estado (tokens pastel)
  const eyeColor =
    status === "pensando"
      ? "#C3B8F5"
      : status === "hablando"
      ? "#A8E6C3"
      : "#9AE6E0";

  // Parpadeo natural (solo si no está dormido)
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    if (isAsleep) return;
    let timeoutId: number;
    const triggerBlink = () => {
      if (status !== "pensando" && !isAsleep) {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
      }
      timeoutId = window.setTimeout(triggerBlink, 3200 + Math.random() * 3800);
    };
    timeoutId = window.setTimeout(triggerBlink, 2200);
    return () => clearTimeout(timeoutId);
  }, [status, isAsleep]);

  useFrame((state) => {
    if (!headGroupRef.current) return;

    const time = state.clock.elapsedTime;

    let targetRotY = 0;
    let targetRotX = 0;
    let eyeOffsetX = 0;
    let eyeOffsetY = 0;

    if (isAsleep) {
      // Estado DORMIDO: cabeza inclinada suavemente hacia adelante, respiración lenta
      targetRotX = 0.22;
      targetRotY = 0.04;
    } else if (isWakingUp) {
      // Sobresalto al despertar
      targetRotX = -0.16;
      targetRotY = 0;
    } else if (cursorData) {
      // Seguimiento activo del cursor
      const dx = (cursorData.rel_x - 400) / 400;
      const dy = (cursorData.rel_y - 42) / 450;

      targetRotY = THREE.MathUtils.clamp(dx * 0.46, -0.58, 0.58);
      targetRotX = THREE.MathUtils.clamp(dy * 0.34, -0.16, 0.36);

      eyeOffsetX = THREE.MathUtils.clamp(dx * 0.08, -0.1, 0.1);
      eyeOffsetY = -THREE.MathUtils.clamp(dy * 0.05, -0.06, 0.06);
    }

    // Variaciones según el estado operativo
    let stateRotZ = 0;
    let stateRotXOffset = 0;
    let stateRotYOffset = 0;
    let eyeScaleYMod = 1.0;
    let emissiveIntensity = 1.4;

    if (isAsleep) {
      emissiveIntensity = 0.8;
    } else if (isWakingUp) {
      eyeScaleYMod = 1.35;
      emissiveIntensity = 2.4;
    } else if (status === "escuchando") {
      stateRotZ = Math.sin(time * 1.5) * 0.08 + 0.07;
      stateRotXOffset = 0.05;
      emissiveIntensity = 2.2;
      eyeScaleYMod = 1.15;
    } else if (status === "pensando") {
      stateRotXOffset = -0.14;
      stateRotYOffset = Math.sin(time * 1.4) * 0.18 + 0.12;
      eyeOffsetX = THREE.MathUtils.lerp(eyeOffsetX, 0.07, 0.6);
      eyeOffsetY = THREE.MathUtils.lerp(eyeOffsetY, 0.06, 0.6);
      emissiveIntensity = 1.3 + Math.sin(time * 5.5) * 0.7;
      eyeScaleYMod = 0.95;
    } else if (status === "hablando") {
      stateRotXOffset = Math.sin(time * 9.0) * 0.09;
      eyeScaleYMod = 1.0 + Math.sin(time * 12.0) * 0.28;
      emissiveIntensity = 1.6 + Math.sin(time * 8.0) * 0.4;
    }

    if (isExcited && !isAsleep) {
      stateRotXOffset += Math.sin(time * 14) * 0.12;
    }

    if (eyeMatRef.current) {
      eyeMatRef.current.emissiveIntensity = emissiveIntensity;
    }

    // Suavizado tipo resorte (lerp)
    headGroupRef.current.rotation.y = THREE.MathUtils.lerp(
      headGroupRef.current.rotation.y,
      targetRotY + stateRotYOffset,
      isWakingUp ? 0.28 : 0.13
    );
    headGroupRef.current.rotation.x = THREE.MathUtils.lerp(
      headGroupRef.current.rotation.x,
      targetRotX + stateRotXOffset,
      isWakingUp ? 0.28 : 0.13
    );
    headGroupRef.current.rotation.z = THREE.MathUtils.lerp(
      headGroupRef.current.rotation.z,
      stateRotZ,
      0.13
    );

    // Respiración: muy lenta y profunda si duerme (0.9), normal si despierto (2.2)
    const breathSpeed = isAsleep ? 1.0 : 2.2;
    const breathAmp = isAsleep ? 0.015 : 0.022;
    const breathOffset = Math.sin(time * breathSpeed) * breathAmp;
    headGroupRef.current.position.y = THREE.MathUtils.lerp(
      headGroupRef.current.position.y,
      (isWakingUp ? 0.04 : -0.08) + breathOffset,
      0.1
    );

    // Movimiento pupilar
    if (eyesGroupRef.current) {
      eyesGroupRef.current.position.x = THREE.MathUtils.lerp(
        eyesGroupRef.current.position.x,
        eyeOffsetX,
        0.18
      );
      eyesGroupRef.current.position.y = THREE.MathUtils.lerp(
        eyesGroupRef.current.position.y,
        eyeOffsetY,
        0.18
      );
    }

    // Parpadeo y escala de ojos
    const targetEyeScaleY = blink ? 0.1 : eyeScaleYMod;
    if (leftEyeRef.current && rightEyeRef.current) {
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(
        leftEyeRef.current.scale.y,
        targetEyeScaleY,
        0.38
      );
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(
        rightEyeRef.current.scale.y,
        targetEyeScaleY,
        0.38
      );
    }
  });

  return (
    <group ref={headGroupRef} position={[0, -0.08, 0]}>
      {/* 1. Cabeza principal: cerámica blanco perla mate (#EDEFF5) */}
      <RoundedBox args={[1.72, 1.15, 0.96]} radius={0.38} smoothness={4}>
        <meshStandardMaterial
          color="#EDEFF5"
          roughness={0.24}
          metalness={0.06}
        />
      </RoundedBox>

      {/* 2. Visor oscuro obsidiana encastrado suavemente en el frontal */}
      <RoundedBox
        args={[1.36, 0.72, 0.1]}
        radius={0.24}
        smoothness={4}
        position={[0, 0.04, 0.46]}
      >
        <meshStandardMaterial
          color="#11141E"
          roughness={0.14}
          metalness={0.7}
        />
      </RoundedBox>

      {/* 3. Ojos: si duerme, muestra arcos curvos (⌒ ⌒); si despierto, ojos LED redondeados */}
      {isAsleep ? (
        <group position={[0, 0.02, 0.52]}>
          {/* Ojo izquierdo dormido (arco fino ⌒) */}
          <mesh position={[-0.34, 0, 0]}>
            <torusGeometry args={[0.13, 0.022, 8, 24, Math.PI]} />
            <meshBasicMaterial color="#C3B8F5" />
          </mesh>
          {/* Ojo derecho dormido (arco fino ⌒) */}
          <mesh position={[0.34, 0, 0]}>
            <torusGeometry args={[0.13, 0.022, 8, 24, Math.PI]} />
            <meshBasicMaterial color="#C3B8F5" />
          </mesh>
        </group>
      ) : (
        <group ref={eyesGroupRef} position={[0, 0.04, 0.52]}>
          {/* Ojo izquierdo despierto */}
          <RoundedBox
            ref={leftEyeRef}
            args={[0.28, 0.32, 0.04]}
            radius={0.13}
            smoothness={3}
            position={[-0.34, 0, 0]}
          >
            <meshStandardMaterial
              ref={eyeMatRef}
              color={eyeColor}
              emissive={eyeColor}
              emissiveIntensity={1.4}
              roughness={0.1}
            />
          </RoundedBox>

          {/* Ojo derecho despierto */}
          <RoundedBox
            ref={rightEyeRef}
            args={[0.28, 0.32, 0.04]}
            radius={0.13}
            smoothness={3}
            position={[0.34, 0, 0]}
          >
            <meshStandardMaterial
              color={eyeColor}
              emissive={eyeColor}
              emissiveIntensity={1.4}
              roughness={0.1}
            />
          </RoundedBox>
        </group>
      )}

      {/* 4. Patitas / manitas redondeadas apoyadas en la cápsula */}
      <RoundedBox
        args={[0.28, 0.16, 0.24]}
        radius={0.08}
        smoothness={3}
        position={[-0.52, -0.48, 0.42]}
      >
        <meshStandardMaterial
          color="#EDEFF5"
          roughness={0.24}
          metalness={0.06}
        />
      </RoundedBox>
      <RoundedBox
        args={[0.28, 0.16, 0.24]}
        radius={0.08}
        smoothness={3}
        position={[0.52, -0.48, 0.42]}
      >
        <meshStandardMaterial
          color="#EDEFF5"
          roughness={0.24}
          metalness={0.06}
        />
      </RoundedBox>
    </group>
  );
}

export function BertoAvatar({
  cursorData,
  isVisible,
  status = "reposo",
  isExcited = false,
  isAsleep = false,
  isWakingUp = false,
}: BertoAvatarProps) {
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
      <ambientLight intensity={0.9} />
      <directionalLight position={[1.5, 2.5, 3]} intensity={1.15} />
      <directionalLight position={[-1.5, 1, 2]} intensity={0.45} color="#EDEFF5" />

      {/* Rim light (contorno de luz) */}
      <directionalLight
        position={[0, 3, -2.5]}
        intensity={2.4}
        color={isAsleep ? "#C3B8F5" : "#9AE6E0"}
      />
      <pointLight
        position={[-1.8, 0.6, -1]}
        intensity={1.8}
        color={isAsleep ? "#C3B8F5" : "#9AE6E0"}
        distance={3.2}
      />
      <pointLight
        position={[1.8, 0.6, -1]}
        intensity={1.8}
        color={isAsleep ? "#C3B8F5" : "#9AE6E0"}
        distance={3.2}
      />

      <pointLight
        position={[0, -0.8, 0.8]}
        intensity={0.6}
        color={isAsleep ? "#C3B8F5" : "#9AE6E0"}
        distance={2.2}
      />

      <RobotMesh
        cursorData={cursorData}
        status={status}
        isExcited={isExcited}
        isAsleep={isAsleep}
        isWakingUp={isWakingUp}
      />
    </Canvas>
  );
}

export default BertoAvatar;
