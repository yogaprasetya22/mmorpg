'use client';

import { CameraControls } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
import { useAvatarConfiguratorStore } from "@/src/state/useAvatarConfiguratorStore";

export const START_CAMERA_POSITION: [number, number, number] = [0, 2, 8];
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [-1, 1, 5];
export const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

interface AvatarCameraManagerProps {
  loading: boolean;
}

export const AvatarCameraManager = ({ loading }: AvatarCameraManagerProps) => {
  const controls = useRef<any>(null);
  const initialLoading = useAvatarConfiguratorStore((state) => state.loading);
  const hasInitialized = useRef(false);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 1024);
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!controls.current) return;
    (window as any).controls = controls.current;

    const offsetX = isMobile ? 0 : -0.6;

    if (initialLoading) {
      controls.current.setLookAt(
        START_CAMERA_POSITION[0] + offsetX,
        START_CAMERA_POSITION[1],
        START_CAMERA_POSITION[2],
        DEFAULT_CAMERA_TARGET[0] + offsetX,
        DEFAULT_CAMERA_TARGET[1],
        DEFAULT_CAMERA_TARGET[2]
      );
    } else if (!hasInitialized.current && !loading) {
      controls.current.setLookAt(
        DEFAULT_CAMERA_POSITION[0] + offsetX,
        DEFAULT_CAMERA_POSITION[1],
        DEFAULT_CAMERA_POSITION[2],
        DEFAULT_CAMERA_TARGET[0] + offsetX,
        DEFAULT_CAMERA_TARGET[1],
        DEFAULT_CAMERA_TARGET[2],
        true
      );
      hasInitialized.current = true;
    }
  }, [initialLoading, loading, isMobile]);

  return (
    <CameraControls
      ref={controls}
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI / 2}
      minDistance={2}
      maxDistance={8}
    />
  );
};
