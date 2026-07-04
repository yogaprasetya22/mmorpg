'use client';

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { useAvatarConfiguratorStore } from "@/src/state/useAvatarConfiguratorStore";
import { AvatarConfiguratorUI } from "@/src/components/game/avatar/AvatarConfiguratorUI";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { DEFAULT_CAMERA_POSITION } from "@/src/components/game/avatar/AvatarCameraManager";
import { useRouter } from "next/navigation";

// Dynamically import the 3D Experience component with SSR disabled
const AvatarExperience = dynamic(
  () => import("@/src/components/game/avatar/AvatarExperience"),
  { ssr: false }
);

export default function CharacterCreationPage() {
  const router = useRouter();
  const fetchCategories = useAvatarConfiguratorStore((state) => state.fetchCategories);
  const containerRef = useRef<HTMLDivElement>(null);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Auth validation check on mount
    const token = localStorage.getItem("game_auth_token");
    if (!token) {
      router.push("/arena");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Set authorized after token validation
    setAuthorized(true);
    fetchCategories();
  }, [fetchCategories, router]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white">
        <p className="text-sm font-semibold tracking-wider text-zinc-400 uppercase animate-pulse">
          Validating Authentication...
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen relative overflow-hidden bg-[#130f30]"
    >
      {/* 2D Overlay UI panel */}
      <AvatarConfiguratorUI />

      {/* 3D WebGL Canvas */}
      <Canvas
        camera={{
          position: DEFAULT_CAMERA_POSITION,
          fov: 45,
        }}
        gl={{
          preserveDrawingBuffer: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 1.5]}
        shadows={{ type: THREE.BasicShadowMap }}
        eventSource={containerRef as any}
        className="w-full h-full"
      >
        <color attach="background" args={["#0a0a0e"]} />
        <fog attach="fog" args={["#0a0a0e", 8, 30]} />
        <group position-y={-0.6}>
          <AvatarExperience />
        </group>
      </Canvas>
    </div>
  );
}
