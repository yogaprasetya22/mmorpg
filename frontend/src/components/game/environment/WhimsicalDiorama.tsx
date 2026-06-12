'use client';

import { useMemo, useEffect, useRef, useState, Component, ReactNode } from 'react';
import React from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment, Sky } from '@react-three/drei';
import { StaticCollider } from 'bvhecctrl';
import { getTerrainElevation } from "@/src/core/utils/terrainHeight";
import {
    PainterlyWaterMaterial,
    PainterlyTerrainMaterial,
    PainterlyGrassMaterial
} from '../systems/effects/PainterlyMaterials';

import { useStore } from "@/src/state/useStore";
import { useEditorStore } from "@/src/state/useEditorStore";
import { registerCollider, unregisterCollider } from '@/src/core/utils/globalRaycaster';
import { API_BASE_URL } from '@/src/core/config';


import { PainterlyGrass } from './effects/PainterlyGrass';

import { Rain, Lightning } from './effects/WeatherEffects';
import { FloatingDebris } from './effects/FloatingDebris';
import { InstancedTrees } from './effects/InstancedTrees';

/**
 * WhimsicalDiorama - The main environment component
 */
interface WhimsicalDioramaProps {
    baseDistance?: number;
    settingsRef?: React.RefObject<any>;
    debug?: boolean;
    onReady?: () => void;
}

interface ErrorBoundaryProps {
    children: ReactNode;
    onCatch: (error: Error) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

class EnvironmentErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    public state: ErrorBoundaryState = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): ErrorBoundaryState {
        return { hasError: true };
    }

    public componentDidCatch(error: Error) {
        this.props.onCatch(error);
    }

    render() {
        if (this.state.hasError) return null;
        return this.props.children;
    }
}

export const WhimsicalDiorama = ({ baseDistance = 24, settingsRef, debug = false, onReady }: WhimsicalDioramaProps) => {
    const weather = useStore(s => s.weather);
    const [skyLoadFailed, setSkyLoadFailed] = useState(false);
    const { scene } = useThree();
    const meshRef = useRef<THREE.Mesh>(null!);
    const lightRef = useRef<THREE.DirectionalLight>(null);

    useFrame((state) => {
        if (lightRef.current) {
            if (lightRef.current.target.parent !== scene) {
                scene.add(lightRef.current.target);
            }
            
            let centerX = 0;
            let centerY = 0;
            let centerZ = 0;
            
            const isEditorOpen = useEditorStore.getState().isEditorOpen;
            if (isEditorOpen) {
                centerX = state.camera.position.x;
                centerY = state.camera.position.y;
                centerZ = state.camera.position.z;
            } else {
                const pos = useStore.getState().playerPosition;
                centerX = pos[0];
                centerY = pos[1];
                centerZ = pos[2];
            }

            const rad = (useEditorStore.getState().sunAngle * Math.PI) / 180;
            const ox = Math.cos(rad) * 15.0;
            const oz = Math.sin(rad) * 15.0;
            lightRef.current.position.set(centerX + ox, 45, centerZ + oz);
            lightRef.current.target.position.set(centerX, centerY, centerZ);
            lightRef.current.target.updateMatrixWorld();
            lightRef.current.shadow.camera.updateProjectionMatrix();
        }
    });

    // Load sculpt heights and config from editor store
    const sculptData = useEditorStore(s => s.sculptData);
    const terrainConfig = useEditorStore(s => s.terrainConfig);

    const [sculptCanvas] = useState(() => {
        if (typeof window === 'undefined') return null;
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#808080';
            ctx.fillRect(0, 0, 256, 256);
        }
        return canvas;
    });

    const [sculptTrigger, setSculptTrigger] = useState(0);

    useEffect(() => {
        if (!sculptCanvas) return;
        const ctx = sculptCanvas.getContext('2d');
        if (!ctx) return;

        if (!sculptData) {
            // Fill canvas with middle-gray (representing 0 displacement)
            ctx.fillStyle = '#808080';
            ctx.fillRect(0, 0, 256, 256);
            if (typeof window !== 'undefined') {
                const heights = new Float32Array(256 * 256);
                heights.fill(0);
                (window as any).sculptHeights = heights;
            }
            setSculptTrigger(prev => prev + 1);
            return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            ctx.clearRect(0, 0, 256, 256);
            ctx.drawImage(img, 0, 0);
            
            // Update heights cache
            const imgData = ctx.getImageData(0, 0, 256, 256).data;
            const heights = new Float32Array(256 * 256);
            for (let i = 0; i < 256 * 256; i++) {
                const rValue = imgData[i * 4];
                heights[i] = ((rValue - 128) / 128) * 35; // maxDisplacement = 35 meters
            }
            if (typeof window !== 'undefined') {
                (window as any).sculptHeights = heights;
            }
            setSculptTrigger(prev => prev + 1);
        };
        img.src = sculptData;
    }, [sculptCanvas, sculptData]);

    const terrainGeometry = useMemo(() => {
        const size = 1500.0;
        // CRITICAL FIX: Removed isSetup dependency — rebuilding geometry on SETUP->PLAYING
        // caused a BVH registration gap, allowing the character to fall through the map.
        const resolution = settingsRef?.current?.potatoMode ? 64 : 128;
        const geo = new THREE.PlaneGeometry(size, size, resolution, resolution);
        const pos = geo.attributes.position;
        
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const elevation = getTerrainElevation(x, y, "DIORAMA", baseDistance, terrainConfig);
            pos.setZ(i, elevation);
        }

        geo.computeVertexNormals();
        (geo as any).computeBoundsTree({ maxDepth: 64, maxLeafSize: 5 });
        return geo;
    }, [baseDistance, terrainConfig, sculptTrigger, settingsRef?.current?.potatoMode]); // REMOVED isSetup — this was the root cause!

    // Signal parent that BVH is ready (next frame after geometry mounts)
    useEffect(() => {
        const id = requestAnimationFrame(() =>
            requestAnimationFrame(() => onReady?.())
        );
        return () => cancelAnimationFrame(id);
    }, [terrainGeometry, onReady]);



    useEffect(() => {
        if (meshRef.current) {
            registerCollider(meshRef.current);
            return () => unregisterCollider(meshRef.current);
        }
    }, [terrainGeometry]);

    useFrame((state) => {
        // Clear global EXR reflection lighting so that only Editor-configured lights control the scene brightness
        if (scene.environment) {
            scene.environment = null;
        }

        const time = state.clock.elapsedTime;
        PainterlyWaterMaterial.uniforms.time.value = time;
        PainterlyTerrainMaterial.uniforms.time.value = time;
        PainterlyTerrainMaterial.uniforms.baseDist.value = baseDistance;
        PainterlyGrassMaterial.uniforms.time.value = time;
    });

    const { lightIntensity, ambientIntensity, sunAngle, fogDensity } = useEditorStore();
    const sky = useEditorStore(s => s.sky) || 'sunset';

    const skyFile = useMemo(() => {
        if (sky === 'night') return `${API_BASE_URL}/assets/textures/skyboxes/qwantani_night_1k.hdr`;
        if (sky === 'sunset') return `${API_BASE_URL}/assets/textures/skyboxes/qwantani_sunset_1k.hdr`;
        return null;
    }, [sky]);

    const sunPosition = useMemo(() => {
        const rad = (sunAngle * Math.PI) / 180;
        return [Math.cos(rad) * 120, 80, Math.sin(rad) * 120] as [number, number, number];
    }, [sunAngle]);

    return (
        <group>
            {/* 1. SKYBOX & SUNLIGHT (High Noon / 12 PM) */}
            {skyFile && !skyLoadFailed ? (
                <EnvironmentErrorBoundary onCatch={() => setSkyLoadFailed(true)}>
                    <Environment 
                        files={skyFile} 
                        background 
                        blur={0}
                    />
                </EnvironmentErrorBoundary>
            ) : (
                <>
                    <color attach="background" args={["#a0c4ff"]} />
                    <Sky sunPosition={sunPosition} />
                </>
            )}

            <ambientLight intensity={(ambientIntensity ?? (sky === 'night' ? 0.8 : 3.5)) + 1.0} color={sky === 'night' ? "#a5b4fc" : "#ffffff"} />
            <hemisphereLight
                intensity={sky === 'night' ? 0.4 : 1.5}
                color={sky === 'night' ? "#a5b4fc" : "#ffffff"}
                groundColor="#556677"
            />

             <directionalLight
                ref={lightRef}
                position={sunPosition}
                intensity={lightIntensity ?? (sky === 'night' ? 2.0 : 10.0)}

                color={sky === 'night' ? "#a5b4fc" : "#ffffff"}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-bias={-0.0005}
                shadow-normalBias={0.06}

                shadow-camera-left={-35}
                shadow-camera-right={35}
                shadow-camera-top={35}
                shadow-camera-bottom={-35}
                shadow-camera-near={0.5}
                shadow-camera-far={120}
            />
            {sky === 'night' && (
                <pointLight 
                    position={[0, 1.5, 0]} 
                    intensity={(ambientIntensity !== null ? 0.8 * (ambientIntensity / 3.5) : 0.8)} 
                    color="#ff5500" 
                    distance={40} 
                />
            )}


            {/* 2. WEATHER EFFECTS */}
            {(weather === 'RAIN' || weather === 'STORM' || weather === 'THUNDER') && <Rain />}
            {(weather === 'THUNDER' || weather === 'STORM') && <Lightning />}



            {/* 3. TERRAIN ISLAND & MOUNTAINS */}
            <StaticCollider 
                key={`terrain-sc-${sculptTrigger}`}
                debug={debug}
                BVHOptions={{
                    strategy: 1, // SAH
                    maxDepth: 64,
                    maxLeafSize: 5,
                    verbose: false
                } as any}
            >
                <mesh 
                    ref={meshRef}
                    name="terrain"
                    geometry={terrainGeometry}
                    rotation={[-Math.PI / 2, 0, 0]} 
                    position={[0, -0.6, 0]} 
                    receiveShadow
                >
                    <primitive object={PainterlyTerrainMaterial} attach="material" wireframe={debug} />
                </mesh>
            </StaticCollider>

            {/* 4. GRASS & ENVIRONMENT */}
            <PainterlyGrass baseDistance={baseDistance} mode="DIORAMA" />
            <InstancedTrees mode="DIORAMA" baseDistance={baseDistance} />


            {/* 5. WATER PLANE (NO COLLIDER) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]}>
                <planeGeometry args={[1500, 1500]} />
                <primitive object={PainterlyWaterMaterial} attach="material" />
            </mesh>


            {/* 6. FLOATING DEBRIS */}
            <FloatingDebris count={60} />

            {/* 7. FOG FOR DEPTH */}
            <fogExp2 attach="fog" args={[sky === 'night' ? "#0b0f19" : "#1a1a2e", fogDensity]} />
        </group>
    );
};
