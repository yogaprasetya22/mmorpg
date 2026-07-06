/**
 * Merge all meshes in a GLTF scene group into one mesh per material group.
 * Preserves skinning (skinIndex/skinWeight) when all meshes share a skeleton.
 * Reduces draw calls per monster from ~5-10 → 1-2.
 *
 * Skip if mesh uses morph targets — merge would break morph indices.
 */

import * as THREE from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function mergeMeshesInScene(
    root: THREE.Object3D,
    skeleton?: THREE.Skeleton,
): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
    });

    if (meshes.length <= 1) return meshes;

    // Group by material reference identity
    const groups = new Map<THREE.Material, THREE.Mesh[]>();
    for (const m of meshes) {
        const mat = m.material;
        if (Array.isArray(mat)) {
            for (const sub of mat) {
                if (!groups.has(sub)) groups.set(sub, []);
                groups.get(sub)!.push(m);
            }
        } else {
            if (!groups.has(mat)) groups.set(mat, [m]);
            else groups.get(mat)!.push(m);
        }
    }

    const out: THREE.Mesh[] = [];
    const toRemove: THREE.Mesh[] = [];

    for (const [material, group] of groups) {
        if (group.length === 0) continue;
        if (group.length === 1) {
            out.push(group[0]);
            continue;
        }

        // Skip morph target meshes — merging would corrupt morph indices
        const hasMorphs = group.some((m) => m.morphTargetInfluences?.length);
        if (hasMorphs) {
            out.push(...group);
            continue;
        }

        // Merge geometries
        const geoms = group.map((m) => m.geometry);
        const merged = BufferGeometryUtils.mergeGeometries(geoms, false);
        if (!merged) {
            out.push(...group);
            continue;
        }

        const anyMesh = group[0];
        let newMesh: THREE.Mesh | THREE.SkinnedMesh;

        if (anyMesh instanceof THREE.SkinnedMesh) {
            const skinned = new THREE.SkinnedMesh(merged, material);
            const skel = skeleton ?? anyMesh.skeleton;
            skinned.bind(skel);
            newMesh = skinned;
        } else {
            newMesh = new THREE.Mesh(merged, material);
        }

        newMesh.castShadow = anyMesh.castShadow;
        newMesh.receiveShadow = anyMesh.receiveShadow;
        newMesh.frustumCulled = true;
        root.add(newMesh);
        out.push(newMesh);
        toRemove.push(...group);
    }

    // Remove originals
    for (const m of toRemove) {
        m.parent?.remove(m);
        m.geometry.dispose();
    }

    return out;
}
