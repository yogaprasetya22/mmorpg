/**
 * EditorItem.tsx — renders a single placed 3D model in the world editor.
 *
 * Location: @/frontend/src/components/game/environment/editor/EditorItem.tsx
 */

import { memo, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { MapItem } from '@/src/state/useEditorStore';
import { SleekSelectionRing, SleekHoverRing } from './SelectionRings';

interface EditorItemProps {
    item: MapItem;
    isSelected: boolean;
    isHovered: boolean;
    isDragging: boolean;
    onClick: (e: any) => void;
}

export const EditorItem = memo(({ item, isSelected, isHovered, isDragging, onClick }: EditorItemProps) => {
    const { scene: gltfScene } = useGLTF(item.path);
    const cloned = useMemo(() => {
        const c = gltfScene.clone();
        c.name = item.id;
        c.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.name = item.id;
                child.material = child.material.clone();
                if (item.color) child.material.color.set(item.color);
            }
        });
        return c;
    }, [gltfScene, item.id, item.color]);

    const radius = useMemo(() => {
        const box = new THREE.Box3().setFromObject(cloned);
        const size = new THREE.Vector3();
        box.getSize(size);
        return Math.max(0.4, Math.max(size.x, size.z) * 0.65);
    }, [cloned]);

    return (
        <primitive
            object={cloned}
            name={item.id}
            position={item.pos}
            rotation={item.rot}
            scale={item.sca}
            onClick={(e: any) => { e.stopPropagation(); onClick(e); }}
        >
            {isSelected && <SleekSelectionRing radius={radius} isDragging={isDragging} />}
            {isHovered && !isSelected && <SleekHoverRing radius={radius} />}
        </primitive>
    );
}, (prev, next) => (
    prev.item.id === next.item.id &&
    prev.isSelected === next.isSelected &&
    prev.isHovered === next.isHovered &&
    prev.isDragging === next.isDragging &&
    prev.item.pos[0] === next.item.pos[0] &&
    prev.item.pos[1] === next.item.pos[1] &&
    prev.item.pos[2] === next.item.pos[2] &&
    prev.item.rot[0] === next.item.rot[0] &&
    prev.item.rot[1] === next.item.rot[1] &&
    prev.item.rot[2] === next.item.rot[2] &&
    prev.item.sca[0] === next.item.sca[0] &&
    prev.item.sca[1] === next.item.sca[1] &&
    prev.item.sca[2] === next.item.sca[2] &&
    prev.item.color === next.item.color
));
