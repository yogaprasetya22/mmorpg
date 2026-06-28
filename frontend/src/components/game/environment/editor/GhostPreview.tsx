/**
 * GhostPreview.tsx — semi-transparent 3D preview of model being placed.
 *
 * Location: @/frontend/src/components/game/environment/editor/GhostPreview.tsx
 */

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface GhostPreviewProps {
    path: string;
    position: THREE.Vector3;
    scale: number | [number, number, number];
    rotation: [number, number, number];
}

export const GhostPreview = ({ path, position, scale, rotation }: GhostPreviewProps) => {
    const { scene } = useGLTF(path);
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

    const adjustedPosition = useMemo(
        () => new THREE.Vector3(position.x, position.y + pivotToBottomY, position.z),
        [position, pivotToBottomY],
    );

    return <primitive object={ghost} position={adjustedPosition} rotation={rotation} scale={sca} />;
};
