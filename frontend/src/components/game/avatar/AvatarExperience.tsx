'use client';

import {
  Environment,
  Gltf,
  ContactShadows,
  useProgress,
} from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, Suspense } from "react";
import { useAvatarConfiguratorStore } from "@/src/state/useAvatarConfiguratorStore";
import { AvatarModel } from "./AvatarModel";
import { AvatarCameraManager } from "./AvatarCameraManager";
import { API_BASE_URL } from "@/src/core/config";
import { Group } from "three";

export const AvatarExperience = () => {
  const setScreenshot = useAvatarConfiguratorStore((state) => state.setScreenshot);
  const { gl, scene } = useThree();

  useEffect(() => {
    (window as any).scene = scene;
  }, [scene]);

  useEffect(() => {
    const screenshot = () => {
      // Create a link element to download the image
      const link = document.createElement("a");
      const date = new Date();
      link.setAttribute(
        "download",
        `Avatar_${
          date.toISOString().split("T")[0]
        }_${date.toLocaleTimeString()}.png`
      );
      link.setAttribute(
        "href",
        gl.domElement.toDataURL("image/png")
      );
      link.click();
    };
    setScreenshot(screenshot);
  }, [gl, setScreenshot]);

  const [loading, setLoading] = useState(() => useProgress.getState().active);
  const setLoadingAt = useRef<number>(0);

  useEffect(() => {
    let timeout: any;

    const handleProgress = (state: any) => {
      const active = state.active;
      clearTimeout(timeout);

      if (active) {
        timeout = setTimeout(() => {
          setLoading(true);
          setLoadingAt.current = Date.now();
        }, 50); // show spinner only after 50ms
      } else {
        timeout = setTimeout(() => {
          setLoading(false);
        }, Math.max(0, 2000 - (Date.now() - setLoadingAt.current))); // show spinner for at least 2s
      }
    };

    // Initialize with current state
    handleProgress(useProgress.getState());

    const unsub = useProgress.subscribe(handleProgress);
    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 1024);
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const groupRef = useRef<Group>(null);

  // Smoothly interpolate position-x based on mobile view to center/offset the avatar
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetX = isMobile ? 0 : -0.6;
    // Frame-rate independent lerp for position-x
    groupRef.current.position.x += (targetX - groupRef.current.position.x) * (1 - Math.exp(-10 * delta));
  });

  return (
    <>
      <AvatarCameraManager loading={loading} />
      <Suspense fallback={null}>
        <Environment preset="sunset" environmentIntensity={0.3} />
      </Suspense>

      <mesh rotation-x={-Math.PI / 2} position-y={-0.31}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#222222" roughness={0.85} />
      </mesh>

      <ambientLight intensity={0.6} />

      {/* Key Light */}
      <directionalLight
        position={[5, 5, 5]}
        intensity={1.5}
      />
      {/* Back Lights */}
      <directionalLight position={[3, 3, -5]} intensity={2.5} color={"#ff3b3b"} />
      <directionalLight
        position={[-3, 3, -5]}
        intensity={3}
        color={"#3cb1ff"}
      />

      <group ref={groupRef}>
        <Suspense fallback={null}>
          <AvatarModel />
        </Suspense>
        <Suspense fallback={null}>
          <Gltf
            position-y={-0.31}
            src={`${API_BASE_URL}/assets/environment/structures/platforms/Teleporter Base.glb`}
          />
        </Suspense>
        <ContactShadows
          position={[0, -0.30, 0]}
          opacity={0.7}
          scale={2.5}
          blur={1.2}
          far={1}
        />
      </group>
    </>
  );
};

export default AvatarExperience;
