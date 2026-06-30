/**
 * GhostPreview.tsx — semi-transparent 3D preview of model being placed.
 *
 * Location: @/frontend/src/components/game/environment/editor/GhostPreview.tsx
 */

import { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface GhostPreviewProps {
    path: string;
    position?: THREE.Vector3;
    positionRef?: React.RefObject<THREE.Vector3 | null>;
    scale: number | [number, number, number];
    rotation: [number, number, number];
}

export const GhostPreview = ({ path, position, positionRef, scale, rotation }: GhostPreviewProps) => {
    const { scene } = useGLTF(path);
    const groupRef = useRef<THREE.Group>(null!);

    const ghost = useMemo(() => {
        const clone = scene.clone();
        clone.traverse((node: any) => {
            if (node.isMesh) {
                node.material = node.material.clone();
                node.material.transparent = true;
                node.material.opacity = 0.45;
                node.material.depthWrite = false;
                node.material.color.set('#818cf8');
                if ('emissive' in node.material) {
                    node.material.emissive = new THREE.Color('#4f46e5');
                }
                if ('emissiveIntensity' in node.material) {
                    (node.material as any).emissiveIntensity = 0.6;
                }
            }
        });
        return clone;
    }, [scene]);

    const sca: [number, number, number] = Array.isArray(scale) ? scale : [scale, scale, scale];

    const pivotToBottomY = useMemo(() => {
        const tempGroup = new THREE.Group();
        const clonedGhost = ghost.clone();
        tempGroup.add(clonedGhost);
        tempGroup.scale.set(...sca);
        tempGroup.rotation.set(...rotation);
        tempGroup.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(tempGroup);
        return -box.min.y;
    }, [ghost, sca, rotation]);

    // Position ghost imperatively in useFrame to avoid parent re-renders
    useFrame(() => {
        if (groupRef.current) {
            if (positionRef && positionRef.current) {
                groupRef.current.position.set(
                    positionRef.current.x,
                    positionRef.current.y + pivotToBottomY,
                    positionRef.current.z
                );
            } else if (position) {
                groupRef.current.position.set(
                    position.x,
                    position.y + pivotToBottomY,
                    position.z
                );
            }
        }
    });

    return (
        <group ref={groupRef}>
            <primitive object={ghost} rotation={rotation} scale={sca} />
        </group>
    );
};
