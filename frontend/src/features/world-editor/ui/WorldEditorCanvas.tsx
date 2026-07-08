'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import dynamic from 'next/dynamic';
import { useEffect, useLayoutEffect } from 'react';
import * as THREE from 'three';

import { ModularMap } from '@/src/components/game/environment/ModularMap';
import { EnvironmentMultiGlobal } from '@/src/components/game/environment/EnvironmentMultiGlobal';
import { EmptyDrawGuard } from '@/src/components/game/systems/EmptyDrawGuard';
import { GPUDeviceWatcher } from '@/src/components/game/systems/GPUDeviceWatcher';
import FrameLimiter from '@/src/components/game/systems/FrameLimiter';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';

const WorldEditor = dynamic(
    () => import('./WorldEditor').then((mod) => mod.WorldEditor),
    { ssr: false }
);
const BrushIndicator = dynamic(
    () => import('./BrushIndicator'),
    { ssr: false }
);
const WorldEditorUI = dynamic(
    () => import('./WorldEditorUI').then((mod) => mod.WorldEditorUI),
    { ssr: false }
);

// Cache per canvas for async WebGPU renderer init
const WEBGPU_RENDERER_CACHE = new WeakMap<object, Promise<any>>();

// ── In-Canvas children ────────────────────────────────────────────────
const EditorScene = ({ onEnvReady }: { onEnvReady: () => void }) => {
    const { gl } = useThree();

    useEffect(() => { gl.shadowMap.type = THREE.PCFShadowMap; }, [gl]);

    return (
        <>
            <FrameLimiter fps={50} />
            <EmptyDrawGuard />
            <GPUDeviceWatcher />

            <MapControls
                enableDamping
                dampingFactor={0.05}
                screenSpacePanning
                minDistance={1}
                maxDistance={800}
                maxPolarAngle={Math.PI / 2.1}
                minPolarAngle={0}
                mouseButtons={{
                    LEFT: null as any,
                    MIDDLE: THREE.MOUSE.ROTATE,
                    RIGHT: THREE.MOUSE.PAN,
                }}
                makeDefault
            />

            <EnvironmentMultiGlobal
                settingsRef={{ current: { potatoMode: false, vfxQuality: 'HIGH' } }}
                debug={false}
                onReady={onEnvReady}
            />

            <ModularMap debug={false} />
            <WorldEditor />
            <BrushIndicator />
        </>
    );
};

// ── VisualTuningBridge ────────────────────────────────────────────────
const VisualTuningBridge = () => {
    const { camera, scene, gl } = useThree();
    useEffect(() => { gl.shadowMap.type = THREE.PCFShadowMap; }, [gl]);
    useEffect(() => {
        if (camera && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
            (camera as THREE.PerspectiveCamera).fov = 50;
            (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
        }
    }, [camera]);
    useEffect(() => {
        if (scene.fog) (scene.fog as any).density = 0.002;
    }, [scene]);
    return null;
};

// ── Exported Canvas Component ────────────────────────────────────────
export const WorldEditorCanvas = () => {
    useLayoutEffect(() => {
        useEditorStore.getState().setIsEditorOpen(true);
    }, []);

    return (
        <div className="w-full h-full overflow-hidden relative bg-slate-950 flex flex-col select-none touch-none">
            <div className="flex-grow w-full relative h-full">
                <Canvas
                    shadows={{ type: THREE.PCFShadowMap }}
                    dpr={[1, typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5]}
                    camera={{ position: [0, 60, 120], fov: 50 }}
                    resize={{ debounce: 100 }}
                    gl={async (canvasProps) => {
                        const canvas = canvasProps.canvas;
                        if (!canvas) throw new Error('[WorldEditor] No canvas element');

                        const cached = WEBGPU_RENDERER_CACHE.get(canvas);
                        if (cached) return cached;

                        const promise = (async () => {
                            (window as any).useWebGPURenderer = true;

                            if (typeof navigator === 'undefined' || !navigator.gpu) {
                                throw new Error('[WebGPU] navigator.gpu unavailable');
                            }

                            const webgpuMod = await import('three/webgpu');
                            const renderer = new (webgpuMod as any).WebGPURenderer({
                                ...canvasProps,
                                antialias: true,
                                powerPreference: 'high-performance',
                            }) as any;

                            await renderer.init();

                            // Init terrain WebGPU materials
                            try {
                                const { initWebGPUMaterial } = await import('@/src/features/terrain/material/TerrainMaterial');
                                await initWebGPUMaterial();
                            } catch (matErr) {
                                console.error('[WebGPU] initWebGPUMaterial() failed:', matErr);
                            }

                            (renderer as any).addEventListener?.('device_lost', (e: any) => {
                                console.error('[WebGPU] Device lost:', e.reason, e.message);
                                setTimeout(() => window.location.reload(), 1000);
                            });

                            return renderer;
                        })();

                        WEBGPU_RENDERER_CACHE.set(canvas, promise);
                        const renderer = await promise;
                        return renderer;
                    }}
                    className="select-none touch-none w-full h-full"
                >
                    <EditorScene onEnvReady={() => { }} />
                    <VisualTuningBridge />
                </Canvas>
            </div>
            <WorldEditorUI />
        </div>
    );
};
