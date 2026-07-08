import { useMemo, useRef, useEffect, memo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';

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
import * as THREE from 'three';
import type { MapItem } from '@jagres/shared';
import { applyWindSway } from '@jagres/shared';

// ── Constants ──
const SECTOR_SIZE = 50; // metres
const MAX_RENDER_DISTANCE_SQ = 115 * 115; // Grass culling radius (115m)

// ── Module‑level scratch (zero alloc) ─────────────────────────────────────────
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

// ── PER‑SECTOR INSTANCED GROUP ────────────────────────────────────────────────

interface SectorGroupProps {
    geometry: THREE.BufferGeometry;
    material: THREE.Material;
    items: MapItem[];
    localMatrix: THREE.Matrix4;
    sectorCenter: [number, number];
}

const SectorGroup = memo(({ geometry, material, items, localMatrix, sectorCenter }: SectorGroupProps) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const [cx, cz] = sectorCenter;
    const frameCounterRef = useRef(Math.floor(Math.random() * 3)); // Stagger checks

    // Distance + Frustum culling check
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

        // 2. Camera Frustum Culling
        mesh.updateMatrixWorld();
        mesh.computeBoundingSphere();
        if (!mesh.boundingSphere) return;

        const sphere = mesh.boundingSphere.clone();
        sphere.center.add(mesh.position);

        // Extract frustum from camera matrices (cached once per frame)
        const frustum = getSharedFrustum(state);

        const isInsideFrustum = frustum.intersectsSphere(sphere);
        if (mesh.visible !== isInsideFrustum) {
            mesh.visible = isInsideFrustum;
        }
    });

    // Rebuild matrices on items change
    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;

        const count = items.length;
        mesh.count = count;

        for (let i = 0; i < count; i++) {
            const item = items[i];
            _pos.set(item.pos[0] - cx, item.pos[1], item.pos[2] - cz);
            _euler.set(item.rot[0], item.rot[1], item.rot[2]);
            _quat.setFromEuler(_euler);
            _sca.set(item.sca[0], item.sca[1], item.sca[2]);

            _matrix.compose(_pos, _quat, _sca);
            _matrix.multiply(localMatrix);
            mesh.setMatrixAt(i, _matrix);

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

        mesh.computeBoundingSphere();
        if (mesh.boundingSphere) mesh.boundingSphere.radius *= 2; // Inflate for wind sway
    }, [items, localMatrix, cx, cz]);

    return (
        <instancedMesh
            ref={meshRef}
            args={[geometry, material, items.length + 100]}
            position={[cx, 0, cz]}
            castShadow={false}
            receiveShadow={false}
            frustumCulled
        />
    );
}, (prev, next) => {
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

// ── PER‑PATH INSTANCED GROUP ──────────────────────────────────────────────────

interface GrassInstancedGroupProps {
    path: string;
    items: MapItem[];
}

const GrassInstancedGroup = memo(({ path, items }: GrassInstancedGroupProps) => {
    const { scene } = useGLTF(path);
    const { gl } = useThree();

    const meshes = useMemo(() => {
        const extracted: { geometry: THREE.BufferGeometry; material: THREE.Material; localMatrix: THREE.Matrix4 }[] = [];
        scene.updateMatrixWorld(true);
        const skipWind = !!(gl as any).isWebGPUBackend;

        scene.traverse((child: any) => {
            if (!child.isMesh) return;
            const mat = child.material.clone();
            // ponytail: applyWindSway uses onBeforeCompile — doesn't work with WebGPURenderer.
            if (!skipWind) {
                applyWindSway(mat, path);
            }
            extracted.push({
                geometry: child.geometry,
                material: mat,
                localMatrix: child.matrixWorld.clone(),
            });
        });
        return extracted;
    }, [scene, path, gl]);

    // Split items into sectors (50×50m grid)
    const sectorMap = useMemo(() => {
        const map = new Map<string, MapItem[]>();
        for (const item of items) {
            const key = sectorKey(item.pos[0], item.pos[2]);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(item);
        }
        return map;
    }, [items]);

    if (meshes.length === 0) return null;

    return (
        <group>
            {meshes.map((md, meshIdx) => (
                <group key={meshIdx}>
                    {Array.from(sectorMap.entries()).map(([key, sectorItems]) => {
                        const [sx, sz] = key.split(',').map(Number);
                        const centerX = sx * SECTOR_SIZE + SECTOR_SIZE / 2;
                        const centerZ = sz * SECTOR_SIZE + SECTOR_SIZE / 2;
                        return (
                            <SectorGroup
                                key={key}
                                geometry={md.geometry}
                                material={md.material}
                                items={sectorItems}
                                localMatrix={md.localMatrix}
                                sectorCenter={[centerX, centerZ]}
                            />
                        );
                    })}
                </group>
            ))}
        </group>
    );
}, (prev, next) => prev.items === next.items);

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────

interface Props {
    items: MapItem[];
}

export const GrassField = memo(({ items }: Props) => {
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
}, (prev, next) => prev.items === next.items);
