'use client';

import {
  Environment,
  Gltf,
  ContactShadows,
  useProgress,
  TransformControls,
} from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, Suspense } from "react";
import { useAvatarConfiguratorStore } from "@/src/state/useAvatarConfiguratorStore";
import { AvatarModel } from "./AvatarModel";
import { AvatarCameraManager } from "./AvatarCameraManager";
import { API_BASE_URL } from "@/src/core/config";
import { Group } from "three";
import { getWeaponConfig } from "./weaponConfigs";

export const AvatarExperience = () => {
  const setScreenshot = useAvatarConfiguratorStore((state) => state.setScreenshot);
  const { gl, scene } = useThree();

  const selectedWeaponId = useAvatarConfiguratorStore((state) => state.selectedWeaponId);
  const weaponGizmoMode = useAvatarConfiguratorStore((state) => state.weaponGizmoMode);
  const weaponRefs = useAvatarConfiguratorStore((state) => state.weaponRefs);

  const activeWeaponRef = selectedWeaponId ? weaponRefs[selectedWeaponId] : null;

  const onObjectChange = () => {
    if (!selectedWeaponId || !activeWeaponRef) return;
    const pos = activeWeaponRef.position;
    const rot = activeWeaponRef.rotation;
    const scl = activeWeaponRef.scale;

    const defaultOffset = getWeaponConfig(selectedWeaponId);

    try {
      localStorage.setItem(
        `weapon_offset_${selectedWeaponId}`,
        JSON.stringify({
          position: [Number(pos.x.toFixed(2)), Number(pos.y.toFixed(2)), Number(pos.z.toFixed(2))],
          rotation: [Number(rot.x.toFixed(2)), Number(rot.y.toFixed(2)), Number(rot.z.toFixed(2))],
          scale: [Number(scl.x.toFixed(2)), Number(scl.y.toFixed(2)), Number(scl.z.toFixed(2))],
          hand: defaultOffset.hand,
        })
      );
    } catch (e) {
      console.warn("Failed to auto-save weapon offset:", e);
    }

    const eventDetail = {
      assetId: selectedWeaponId,
      position: [Number(pos.x.toFixed(2)), Number(pos.y.toFixed(2)), Number(pos.z.toFixed(2))],
      rotation: [Number(rot.x.toFixed(2)), Number(rot.y.toFixed(2)), Number(rot.z.toFixed(2))],
      scale: [Number(scl.x.toFixed(2)), Number(scl.y.toFixed(2)), Number(scl.z.toFixed(2))],
    };
    window.dispatchEvent(new CustomEvent("weapon-offset-change", { detail: eventDetail }));
  };

  useEffect(() => {
    (window as any).scene = scene;
    (window as any).useAvatarConfiguratorStore = useAvatarConfiguratorStore;
  }, [scene]);

  useEffect(() => {
    const screenshot = () => {
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
        }, 50);
      } else {
        timeout = setTimeout(() => {
          setLoading(false);
        }, Math.max(0, 2000 - (Date.now() - setLoadingAt.current)));
      }
    };

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
  const transformRef = useRef<any>(null);

  useFrame((_, delta) => {
    if (transformRef.current) {
      const target = transformRef.current.object;
      if (target && !target.parent) {
        transformRef.current.detach();
      }
    }

    if (!groupRef.current) return;
    const targetX = isMobile ? 0 : -0.6;
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
      <directionalLight position={[5, 5, 5]} intensity={1.5} />
      <directionalLight position={[3, 3, -5]} intensity={2.5} color={"#ff3b3b"} />
      <directionalLight position={[-3, 3, -5]} intensity={3} color={"#3cb1ff"} />

      <group ref={groupRef}>
        <Suspense fallback={null}>
          <AvatarModel isConfigurator={true} />
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

      {activeWeaponRef && activeWeaponRef.parent && weaponGizmoMode !== "none" && (
        <TransformControls
          ref={(ref: any) => {
            transformRef.current = ref;
            if (ref && !ref.__updateMatrixWorldOverridden) {
              ref.__updateMatrixWorldOverridden = true;
              const originalUpdate = ref.updateMatrixWorld;
              ref.updateMatrixWorld = function(force: boolean) {
                if (this.object && !this.object.parent) {
                  this.detach();
                  return;
                }
                originalUpdate.call(this, force);
              };
            }
          }}
          object={activeWeaponRef as any}
          mode={weaponGizmoMode as any}
          size={0.7}
          onObjectChange={onObjectChange}
          onMouseDown={() => {
            const controls = (window as any).controls;
            if (controls) {
              controls.enabled = false;
            }
          }}
          onMouseUp={() => {
            const controls = (window as any).controls;
            if (controls) {
              controls.enabled = true;
            }
          }}
        />
      )}
    </>
  );
};

export default AvatarExperience;
