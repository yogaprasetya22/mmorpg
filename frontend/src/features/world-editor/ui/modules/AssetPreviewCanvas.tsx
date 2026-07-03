'use client';

import { useState, useEffect, useMemo, useRef, Suspense, Component, type ReactNode, memo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { API_BASE_URL } from '@/src/core/config';
import { Eye, RotateCw } from 'lucide-react';

type Props = { modelUrl?: string };

// ─── CANVAS ERROR BOUNDARY ───
class CanvasErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("AssetPreviewCanvas Error Boundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ─── AUTO-CENTER & AUTO-SCALE PREVIEW MODEL ───
function PreviewModel({ url }: { url: string }) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const { scene } = useGLTF(fullUrl);
  const cloned = useMemo(() => scene.clone(), [scene]);
  const groupRef = useRef<THREE.Group>(null);

  // Auto-scale to fit the preview viewport uniformly
  const scale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    return maxDim > 0 ? 1.8 / maxDim : 1;
  }, [cloned]);

  // Auto-center offset so model sits at origin
  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    return -(box.min.y + size.y / 2) * scale;
  }, [cloned, scale]);

  return (
    <group ref={groupRef} position={[0, yOffset, 0]}>
      <primitive object={cloned} scale={[scale, scale, scale]} />
    </group>
  );
}

// ─── VIEWPORT CONTAINER (always mounted to prevent layout resize bugs) ───
function AssetPreviewCanvasImpl({ modelUrl }: Props) {
  const [ready, setReady] = useState(false);

  // Delay mounting canvas until layout transitions stabilize
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="h-28 w-full bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden relative shadow-inner">
      {/* Overlay status/placeholder */}
      {!modelUrl ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-zinc-950/50 backdrop-blur-xs pointer-events-none">
          <Eye className="w-3.5 h-3.5 text-zinc-700" />
          <span className="text-[7.5px] text-zinc-650 font-mono uppercase tracking-wider">Select a blueprint to preview</span>
        </div>
      ) : (
        <div className="absolute top-2 right-2 z-10 text-zinc-600 flex items-center gap-1 pointer-events-none">
          <RotateCw className="w-2.5 h-2.5" />
          <span className="text-[6.5px] font-mono uppercase">Drag to orbit</span>
        </div>
      )}

      {/* R3F Canvas - always mounted with delayed instantiation to ensure correct width/height */}
      {ready && (
        <Canvas
          camera={{ position: [2.5, 1.8, 2.5], fov: 35, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 1.25]}
        >
          <ambientLight intensity={1.2} />
          <directionalLight position={[4, 5, 3]} intensity={2.5} />
          <directionalLight position={[-2, 3, -4]} intensity={1.0} color="#93c5fd" />
          
          {modelUrl && (
            <Suspense fallback={null}>
              <CanvasErrorBoundary fallback={<mesh><boxGeometry args={[0.4, 0.4, 0.4]} /><meshBasicMaterial color="#e11d48" wireframe /></mesh>}>
                <Center>
                  <PreviewModel url={modelUrl} />
                </Center>
              </CanvasErrorBoundary>
            </Suspense>
          )}

          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={1.2}
            maxDistance={8}
            autoRotate={false}
            target={[0, 0, 0]}
          />
          <Environment preset="sunset" environmentIntensity={0.2} />
        </Canvas>
      )}
    </div>
  );
}

export const AssetPreviewCanvas = memo(AssetPreviewCanvasImpl);
