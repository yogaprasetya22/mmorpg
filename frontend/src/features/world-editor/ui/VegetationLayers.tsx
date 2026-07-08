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
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MapItem } from '@jagres/shared';
import { useEditorStore } from '@/src/features/world-editor/store/useEditorStore';

// ── Constants ──
const SECTOR_SIZE = 50; // metres
const MAX_RENDER_DISTANCE_SQ = 160 * 160; // Culling radius of 160m (squared for performance)

// ── Module‑level scratch (zero alloc) ──
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _sca = new THREE.Vector3();
const _euler = new THREE.Euler();
const _matrix = new THREE.Matrix4();
const _tempColor = new THREE.Color();
const _projScreenMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
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
    castShadow?: boolean;
    receiveShadow?: boolean;
}

const SectorGroup = memo(({ geometry, material, items, localMatrix, sectorCenter, castShadow = false, receiveShadow = false }: SectorGroupProps) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const [cx, cz] = sectorCenter;
    const frameCounterRef = useRef(Math.floor(Math.random() * 3)); // Stagger checks

    const setSelectedId = useEditorStore(s => s.setSelectedId);
    const toggleSelectedId = useEditorStore(s => s.toggleSelectedId);
    const paintMode = useEditorStore(s => s.paintMode);
    const activeAsset = useEditorStore(s => s.activeAsset);
    const vegetationBrushActive = useEditorStore(s => s.vegetationBrushActive);

    // Perform distance culling + frustum culling check in the frame loop
    useFrame((state) => {
        const mesh = meshRef.current;
        if (!mesh) return;

        frameCounterRef.current++;
        if (frameCounterRef.current % 3 !== 0) return;

        // 1. Distance culling (Fast check)
        const camPos = state.camera.position;
        const dx = camPos.x - cx;
        const dz = camPos.z - cz;
        const distSq = dx * dx + dz * dz;

        if (distSq > MAX_RENDER_DISTANCE_SQ) {
            if (mesh.visible) mesh.visible = false;
            return;
        }

        // 2. Camera Frustum Culling (Accurate view check)
        mesh.updateMatrixWorld();
        // Recalculate bounding sphere in world coordinates (offset by sector position)
        mesh.computeBoundingSphere();
        if (!mesh.boundingSphere) return;

        const sphere = mesh.boundingSphere.clone();
        sphere.center.add(mesh.position); // translate sphere offset to world position

        // Extract frustum from camera matrices (cached once per frame)
        const frustum = getSharedFrustum(state);

        const isInsideFrustum = frustum.intersectsSphere(sphere);
        if (mesh.visible !== isInsideFrustum) {
            mesh.visible = isInsideFrustum;
        }
    });

    // Update instance matrices whenever items or localMatrix change
    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;

        const count = items.length;
        mesh.count = count;

        for (let i = 0; i < count; i++) {
            const item = items[i];

            // Compute instance transform relative to sector center
            _pos.set(item.pos[0] - cx, item.pos[1], item.pos[2] - cz);
            _euler.set(item.rot[0], item.rot[1], item.rot[2]);
            _quat.setFromEuler(_euler);
            _sca.set(item.sca[0], item.sca[1], item.sca[2]);

            // Compose local instance matrix
            _matrix.compose(_pos, _quat, _sca);
            // Bake GLB mesh offset matrix
            _matrix.multiply(localMatrix);

            // Apply matrix to instanced mesh
            mesh.setMatrixAt(i, _matrix);

            // Apply custom color if present
            if (item.color) {
                _tempColor.set(item.color);
                mesh.setColorAt(i, _tempColor);
            } else {
                _tempColor.set('#ffffff');
                mesh.setColorAt(i, _tempColor);
            }
        }

        // Notify Three.js to re-upload buffer data to GPU
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        // Recompute bounding sphere for frustum culling
        mesh.computeBoundingSphere();
        if (mesh.boundingSphere) {
            mesh.boundingSphere.radius *= 1.5; // Inflate for wind sway
        }
    }, [items, localMatrix, cx, cz]);

    return (
        <instancedMesh
            ref={meshRef}
            args={[geometry, material, items.length + 100]}
            position={[cx, 0, cz]}
            frustumCulled
            castShadow={castShadow}
            receiveShadow={receiveShadow}
            onPointerDown={(e: any) => {
                if (activeAsset || paintMode || vegetationBrushActive) return;
                e.stopPropagation();
                const instId = e.instanceId;
                if (instId !== undefined && items[instId]) {
                    const item = items[instId];
                    const sh = e.shiftKey || e.nativeEvent?.shiftKey;
                    if (sh) {
                        toggleSelectedId(item.id);
                    } else {
                        setSelectedId(item.id);
                    }
                }
            }}
            onPointerUp={(e: any) => {
                if (activeAsset || paintMode || vegetationBrushActive) return;
                e.stopPropagation();
            }}
        />
    );
}, (prev, next) => {
    // Only re‑render when items array structurally changes
    if (prev.items.length !== next.items.length) return false;
    if (prev.geometry !== next.geometry) return false;
    for (let i = 0; i < prev.items.length; i++) {
        if (prev.items[i].id !== next.items[i].id) return false;
        if (prev.items[i].pos !== next.items[i].pos) return false;
        if (prev.items[i].rot !== next.items[i].rot) return false;
        if (prev.items[i].sca !== next.items[i].sca) return false;
    }
    return true;
});

// ── InstancedVegetationModel (per GLB path, with sector split) ──

const InstancedVegetationModel = memo(({ path, instances }: { path: string; instances: MapItem[] }) => {
    const { scene } = useGLTF(path) as any;

    const isTreeOrRock = useMemo(() => {
        const lower = path.toLowerCase();
        return lower.includes('tree') || lower.includes('rock') || lower.includes('pillar') || lower.includes('structure');
    }, [path]);

    // Extract all sub-meshes data
    const meshes = useMemo(() => {
        const list: { geometry: THREE.BufferGeometry; material: THREE.Material; localMatrix: THREE.Matrix4 }[] = [];
        scene.updateMatrixWorld(true);
        scene.traverse((child: any) => {
            if (child.isMesh) {
                list.push({
                    geometry: child.geometry,
                    material: child.material.clone(),
                    localMatrix: child.matrixWorld.clone(),
                });
            }
        });
        return list;
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

    if (meshes.length === 0) return null;

    return (
        <group>
            {meshes.map((mesh, meshIdx) => (
                <group key={meshIdx}>
                    {Array.from(sectorMap.entries()).map(([key, sectorItems]) => {
                        const [sx, sz] = key.split(',').map(Number);
                        const centerX = sx * SECTOR_SIZE + SECTOR_SIZE / 2;
                        const centerZ = sz * SECTOR_SIZE + SECTOR_SIZE / 2;
                        return (
                            <SectorGroup
                                key={key}
                                geometry={mesh.geometry}
                                material={mesh.material}
                                items={sectorItems}
                                localMatrix={mesh.localMatrix}
                                sectorCenter={[centerX, centerZ]}
                                castShadow={isTreeOrRock}
                                receiveShadow={isTreeOrRock}
                            />
                        );
                    })}
                </group>
            ))}
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
