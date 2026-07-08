'use client';

/**
 * BrushIndicator.tsx — standalone brush ring + terrain raycast tracker.
 *
 * Zero entanglement with WorldEditor. Own useFrame, own ring mesh.
 * Exports shared refs so WorldEditor can read brush position for
 * vegetation spray ring, holographic projection, and Zustand UI sync.
 *
 * Rendered alongside (not inside) WorldEditor in GameCanvas.tsx.
 */

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';

// ── Shared mutable refs (module-level, zero React overhead) ─────────
export const brushWorldPosRef = { current: new THREE.Vector3() };
export const hasBrushWorldPosRef = { current: false };
export const brushRingRef = { current: null as THREE.Mesh | null };

// Cache for Zustand writes (stable array reference prevents 50fps re-renders)
const _cacheArray: [number, number, number] = [0, 0, 0];
let _wasOnTerrain = false;

// ── Component ───────────────────────────────────────────────────────
const BrushIndicator = () => {
    const ringRef = useRef<THREE.Mesh>(null);
    const brushSize = useEditorStore(s => s.brushSize);

    // Sync module-level ref on mount/unmount
    useEffect(() => {
        brushRingRef.current = ringRef.current;
        return () => { brushRingRef.current = null; };
    }, []);

    useFrame((state) => {
        const terrain = state.scene.getObjectByName('terrain');
        const st = useEditorStore.getState();
        const active = st.paintMode || st.vegetationBrushActive;

        if (!terrain || !active) {
            if (ringRef.current) ringRef.current.visible = false;
            hasBrushWorldPosRef.current = false;
            _wasOnTerrain = false;
            return;
        }

        state.raycaster.setFromCamera(state.pointer, state.camera);
        const hits = state.raycaster.intersectObject(terrain, false);
        const onTerrain = hits.length > 0;

        if (onTerrain) {
            const p = hits[0].point;

            // Update shared refs (every frame, no React cost)
            brushWorldPosRef.current.copy(p);
            hasBrushWorldPosRef.current = true;

            // Ring position + visibility
            if (ringRef.current) {
                ringRef.current.position.copy(p);
                ringRef.current.position.y += 0.35;
                ringRef.current.visible = true;
            }

            // Zustand write-back: only on enter (stable array ref)
            if (!_wasOnTerrain) {
                _wasOnTerrain = true;
                _cacheArray[0] = p.x;
                _cacheArray[1] = p.y;
                _cacheArray[2] = p.z;
                useEditorStore.getState().setBrushHoverPos?.(_cacheArray);
            }
        } else {
            hasBrushWorldPosRef.current = false;

            if (ringRef.current) ringRef.current.visible = false;

            // Zustand write-back: only on leave
            if (_wasOnTerrain) {
                _wasOnTerrain = false;
                useEditorStore.getState().setBrushHoverPos?.(null);
            }
        }
    });

    // Always-mounted ring (visibility controlled imperatively)
    return (
        <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[brushSize - 0.08, brushSize, 64]} />
            <meshBasicMaterial
                color="#3b82f6"
                transparent
                opacity={0.25}
                side={THREE.DoubleSide}
                depthWrite={false}
            />
        </mesh>
    );
};

export default BrushIndicator;
