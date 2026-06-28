'use client';

/** isGrassAssetPath — mirrors wind.ts isGrassOrFlower logic. */
export function isGrassAssetPath(path: string): boolean {
    const lower = path.toLowerCase();
    return (
        lower.includes('grass') ||
        lower.includes('clover') ||
        lower.includes('flower') ||
        lower.includes('fern') ||
        lower.includes('plant') ||
        lower.includes('mushroom') ||
        lower.includes('bush')
    );
}

/**
 * GrassField
 *
 * Render grass items via THREE.InstancedMesh with wind sway.
 * No collider → player walks through.
 * No shadow → lighter GPU load.
 *
 * Performance: memo at 2 levels, inflate bounding sphere for wind sway,
 * module‑level scratch objects (zero alloc per frame).
 */

import { useMemo, useRef, useEffect, memo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { MapItem } from '@/src/state/useEditorStore';
import { applyWindSway } from '@/src/core/utils/wind';

// ── Module‑level scratch (zero alloc) ─────────────────────────────────────────
const _tempObj = new THREE.Object3D();
const _tempMatrix = new THREE.Matrix4();
const _tempColor = new THREE.Color();

// ── PER‑PATH INSTANCED GROUP ──────────────────────────────────────────────────

interface GrassInstancedGroupProps {
    path: string;
    items: MapItem[];
}

const GrassInstancedGroup = memo(({ path, items }: GrassInstancedGroupProps) => {
    const { scene } = useGLTF(path);

    const meshes = useMemo(() => {
        const extracted: { geometry: THREE.BufferGeometry; material: THREE.Material; localMatrix: THREE.Matrix4 }[] = [];
        scene.updateMatrixWorld(true);

        scene.traverse((child: any) => {
            if (!child.isMesh) return;
            const mat = child.material.clone();
            applyWindSway(mat, path);
            extracted.push({
                geometry: child.geometry,
                material: mat,
                localMatrix: child.matrixWorld.clone(),
            });
        });
        return extracted;
    }, [scene, path]);

    if (meshes.length === 0) return null;

    return (
        <group>
            {meshes.map((md, i) => (
                <GrassInstancedMeshPart key={i} meshData={md} items={items} />
            ))}
        </group>
    );
}, (prev, next) => prev.items.length === next.items.length);

// ── INSTANCED MESH PART ───────────────────────────────────────────────────────

interface MeshPartProps {
    meshData: { geometry: THREE.BufferGeometry; material: THREE.Material; localMatrix: THREE.Matrix4 };
    items: MapItem[];
}

const GrassInstancedMeshPart = ({ meshData, items }: MeshPartProps) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const prevLenRef = useRef(0);

    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;

        // Only rebuild matrix when count changes (faster path)
        // for moved items the GrassInstancedGroup re‑render handles it via new component
        if (items.length === prevLenRef.current) return;
        prevLenRef.current = items.length;

        const count = items.length;
        mesh.count = count;

        for (let i = 0; i < count; i++) {
            const item = items[i];
            _tempObj.position.set(item.pos[0], item.pos[1], item.pos[2]);
            _tempObj.rotation.set(item.rot[0], item.rot[1], item.rot[2]);
            _tempObj.scale.set(item.sca[0], item.sca[1], item.sca[2]);
            _tempObj.updateMatrix();

            _tempMatrix.multiplyMatrices(_tempObj.matrix, meshData.localMatrix);
            mesh.setMatrixAt(i, _tempMatrix);

            if (item.color) {
                _tempColor.set(item.color);
                mesh.setColorAt(i, _tempColor);
            } else {
                _tempColor.set(0xffffff);
                mesh.setColorAt(i, _tempColor);
            }
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        // Inflate bounding sphere 2× for wind sway displacement
        mesh.computeBoundingSphere();
        if (mesh.boundingSphere) mesh.boundingSphere.radius *= 2;
        mesh.computeBoundingBox();
    }, [items, meshData]);

    return (
        <instancedMesh
            ref={meshRef}
            args={[meshData.geometry, meshData.material, Math.max(items.length, 1)]}
            castShadow={false}
            receiveShadow={false}
            frustumCulled
        />
    );
};

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────

interface Props {
    items: MapItem[];
}

const GrassFieldInner = ({ items }: Props) => {
    const groups = useMemo(() => {
        const map = new Map<string, MapItem[]>();
        for (const item of items) {
            const arr = map.get(item.path) || [];
            arr.push(item);
            map.set(item.path, arr);
        }
        return Array.from(map.entries());
    }, [items]);

    if (items.length === 0) return null;

    return (
        <group>
            {groups.map(([path, groupItems]) => (
                <GrassInstancedGroup key={path} path={path} items={groupItems} />
            ))}
        </group>
    );
};

export const GrassField = memo(GrassFieldInner, (prev, next) => prev.items.length === next.items.length);
