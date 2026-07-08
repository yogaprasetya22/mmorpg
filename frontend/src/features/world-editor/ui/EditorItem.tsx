/**
 * EditorItem.tsx — renders a single placed 3D model in the world editor.
 *
 * Location: @/frontend/src/components/game/environment/editor/EditorItem.tsx
 */

import { memo, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MapItem } from '@jagres/shared';
import { SleekSelectionRing, SleekHoverRing } from './SelectionRings';

interface EditorItemProps {
    item: MapItem;
    isSelected: boolean;
    isHovered: boolean;
    isDragging: boolean;
    onPointerDown?: (e: any) => void;
    onPointerUp?: (e: any) => void;
    onPointerOver?: (e: any) => void;
    onPointerOut?: (e: any) => void;
}

// ── Shared module-level scratch ──
const _projScreenMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _itemSphere = new THREE.Sphere();
let _lastFrustumFrame = -1;

function getSharedFrustum(state: any): THREE.Frustum {
    const frame = state.gl.info.render.frame;
    if (frame !== _lastFrustumFrame) {
        _lastFrustumFrame = frame;
        _projScreenMatrix.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
        _frustum.setFromProjectionMatrix(_projScreenMatrix);
    }
    return _frustum;
}

export const EditorItem = memo(({ item, isSelected, isHovered, isDragging, onPointerDown, onPointerUp, onPointerOver, onPointerOut }: EditorItemProps) => {
    const { scene: gltfScene } = useGLTF(item.path);
    const groupRef = useRef<THREE.Group>(null!);
    const frameCounterRef = useRef(Math.floor(Math.random() * 3));

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

    const { radius, sphereRadius } = useMemo(() => {
        const box = new THREE.Box3().setFromObject(cloned);
        const size = new THREE.Vector3();
        box.getSize(size);
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        return {
            radius: Math.max(0.4, Math.max(size.x, size.z) * 0.65),
            sphereRadius: sphere.radius
        };
    }, [cloned]);

    // Staggered distance + frustum culling check
    useFrame((state) => {
        const group = groupRef.current;
        if (!group) return;

        frameCounterRef.current++;
        if (frameCounterRef.current % 3 !== 0) return;

        // If selected or being dragged, force visible
        if (isSelected || isDragging) {
            if (!group.visible) group.visible = true;
            return;
        }

        const camPos = state.camera.position;
        const dx = camPos.x - item.pos[0];
        const dz = camPos.z - item.pos[2];
        const distSq = dx * dx + dz * dz;

        // 1. Distance culling (200m render distance for normal items)
        if (distSq > 200 * 200) {
            if (group.visible) group.visible = false;
            return;
        }

        // 2. Camera Frustum Culling
        const maxScale = Math.max(item.sca[0], item.sca[1], item.sca[2]);
        _itemSphere.center.set(item.pos[0], item.pos[1], item.pos[2]);
        _itemSphere.radius = sphereRadius * maxScale;

        const frustum = getSharedFrustum(state);
        const isInsideFrustum = frustum.intersectsSphere(_itemSphere);

        if (group.visible !== isInsideFrustum) {
            group.visible = isInsideFrustum;
        }
    });

    return (
        <group
            ref={groupRef}
            name={item.id}
            position={item.pos}
            rotation={item.rot as any}
            scale={item.sca as any}
            onPointerDown={(e) => { e.stopPropagation(); onPointerDown?.(e); }}
            onPointerUp={(e) => { e.stopPropagation(); onPointerUp?.(e); }}
            onPointerOver={(e) => { e.stopPropagation(); onPointerOver?.(e); }}
            onPointerOut={(e) => { e.stopPropagation(); onPointerOut?.(e); }}
        >
            <primitive
                object={cloned}
            />
            {isSelected && <SleekSelectionRing radius={radius} isDragging={isDragging} />}
            {isHovered && !isSelected && <SleekHoverRing radius={radius} />}
        </group>
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
