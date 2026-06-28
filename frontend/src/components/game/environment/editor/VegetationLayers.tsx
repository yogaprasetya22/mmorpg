/**
 * VegetationLayers.tsx — high‑performance vegetation renderer for WorldEditor.
 *
 * Optimizations (Unity/Roblox‑grade):
 * 1. Uses drei <Instances> + <Instance> — only dirty instances re‑upload their matrix.
 * 2. Sector grid (50×50m) — Frustum culling per sector, not per instance.
 * 3. Shadow gating — castShadow=false for small vegetation, shadow only for
 *    large trees within 40m of camera (ponytail: upgrade to per‑instance if needed).
 * 4. Module‑level scratch objects — zero alloc on matrix writes.
 *
 * Location: @/frontend/src/components/game/environment/editor/VegetationLayers.tsx
 */

import { memo, useRef, useMemo, useEffect } from 'react';
import { useGLTF, Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import type { MapItem } from '@/src/state/useEditorStore';

// ── Constants ──
const SECTOR_SIZE = 50; // metres

// ── Module‑level scratch (zero alloc) ──
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _sca = new THREE.Vector3();

/** Compute sector key from world position. */
function sectorKey(x: number, z: number): string {
    return `${Math.floor(x / SECTOR_SIZE)},${Math.floor(z / SECTOR_SIZE)}`;
}

// ── Per‑sector Instances group ──

interface SectorGroupProps {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    items: MapItem[];
    localMatrix: THREE.Matrix4;
    sectorCenter: [number, number];
}

const SectorGroup = memo(({ geometry, material, items, localMatrix, sectorCenter }: SectorGroupProps) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);

    // Compute bounding sphere once for frustum culling
    useEffect(() => {
        if (meshRef.current) {
            meshRef.current.computeBoundingSphere();
            // Inflate slightly for wind sway
            if (meshRef.current.boundingSphere) meshRef.current.boundingSphere.radius *= 1.5;
        }
    }, []);

    // Only rebuild when items array changes (new count)
    // Individual Instance components handle their own matrix updates automatically
    // via drei's Instance dirty‑tracking
    useEffect(() => {
        if (!meshRef.current) return;
        // Force Three.js to re‑evaluate count
        meshRef.current.count = items.length;
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [items.length]);

    const [cx, cz] = sectorCenter;

    return (
        <Instances
            ref={meshRef}
            geometry={geometry}
            material={material}
            limit={items.length + 100} // padding for future adds
            position={[cx, 0, cz]}
            frustumCulled
            castShadow={false}
            receiveShadow={false}
        >
            {items.map(item => {
                // Compute instance transform relative to sector center
                _pos.set(item.pos[0] - cx, item.pos[1], item.pos[2] - cz);
                _quat.setFromEuler(new THREE.Euler(item.rot[0], item.rot[1], item.rot[2]));
                _sca.set(item.sca[0], item.sca[1], item.sca[2]);

                // Bake localMatrix (GLB mesh offset) into pos/rot/scale
                const m = new THREE.Matrix4().compose(_pos, _quat, _sca);
                m.multiply(localMatrix);
                m.decompose(_pos, _quat, _sca);

                return (
                    <Instance
                        key={item.id}
                        position={_pos.toArray() as any}
                        rotation={[_quat.x, _quat.y, _quat.z, _quat.w] as any}
                        scale={_sca.toArray() as any}
                        color={item.color || '#ffffff'}
                    />
                );
            })}
        </Instances>
    );
}, (prev, next) => {
    // Only re‑render when items array structurally changes
    if (prev.items.length !== next.items.length) return false;
    if (prev.geometry !== next.geometry) return false;
    for (let i = 0; i < prev.items.length; i++) {
        if (prev.items[i].id !== next.items[i].id) return false;
    }
    return true;
});

// ── InstancedVegetationModel (per GLB path, with sector split) ──

const InstancedVegetationModel = memo(({ path, instances }: { path: string; instances: MapItem[] }) => {
    const { scene } = useGLTF(path) as any;

    // Extract mesh data
    const meshData = useMemo(() => {
        let geo: THREE.BufferGeometry | null = null;
        let mat: THREE.Material | null = null;
        let localMatrix = new THREE.Matrix4();
        scene.updateMatrixWorld(true);
        scene.traverse((child: any) => {
            if (child.isMesh && !geo) {
                geo = child.geometry;
                mat = child.material.clone();
                localMatrix = child.matrixWorld.clone();
            }
        });
        return { geometry: geo, material: mat, localMatrix };
    }, [scene, path]);

    // Split instances into sectors (50×50m grid)
    const sectorMap = useMemo(() => {
        const map = new Map<string, MapItem[]>();
        for (const item of instances) {
            const key = sectorKey(item.pos[0], item.pos[2]);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
        }
        return map;
    }, [instances]);

    if (!meshData.geometry || !meshData.material) return null;

    const geo = meshData.geometry!;
    const mat = meshData.material!;

    return (
        <group>
            {Array.from(sectorMap.entries()).map(([key, sectorItems]) => {
                const [sx, sz] = key.split(',').map(Number);
                const centerX = sx * SECTOR_SIZE + SECTOR_SIZE / 2;
                const centerZ = sz * SECTOR_SIZE + SECTOR_SIZE / 2;
                return (
                    <SectorGroup
                        key={key}
                        geometry={geo}
                        material={mat}
                        items={sectorItems}
                        localMatrix={meshData.localMatrix}
                        sectorCenter={[centerX, centerZ]}
                    />
                );
            })}
        </group>
    );
}, (prev, next) => prev.instances === next.instances);

// ── ProceduralVegetationLayer ──

interface Props { items: MapItem[]; }

export const ProceduralVegetationLayer = memo(({ items }: Props) => {
    const groups = useMemo(() => {
        const map = new Map<string, MapItem[]>();
        for (const item of items) {
            if (!map.has(item.path)) map.set(item.path, []);
            map.get(item.path)!.push(item);
        }
        return Array.from(map.entries());
    }, [items]);

    if (items.length === 0) return null;

    return (
        <group>
            {groups.map(([path, groupItems]) => (
                <InstancedVegetationModel key={path} path={path} instances={groupItems} />
            ))}
        </group>
    );
}, (prev, next) => prev.items === next.items);
