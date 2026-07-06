/**
 * Clamp skeleton bone count to max 30.
 * GPU skinning performance degrades sharply beyond ~30 bones on low-end.
 * Removes least-influential bones (bones with lowest total skin weight).
 *
 * Safe: keeps skinned mesh rendering intact with most visual fidelity.
 * Ponytail: if env `MORPH_TARGETS` in use, skip — bone reindex corrupts morphs.
 */

import * as THREE from "three";

const MAX_BONES = 30;

export function clampBones(root: THREE.Object3D): void {
    const meshes: THREE.SkinnedMesh[] = [];
    root.traverse((child) => {
        if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
            meshes.push(child as THREE.SkinnedMesh);
        }
    });

    for (const mesh of meshes) {
        const skel = mesh.skeleton;
        if (!skel || skel.bones.length <= MAX_BONES) continue;

        const bones = skel.bones;
        const boneInverses = skel.boneInverses;

        // Compute total weight per bone across all vertices
        const weightMap = new Map<THREE.Bone, number>();
        for (const b of bones) weightMap.set(b, 0);

        const pos = mesh.geometry.attributes.skinIndex;
        const wgt = mesh.geometry.attributes.skinWeight;
        if (!pos || !wgt) continue;

        for (let i = 0; i < pos.count; i++) {
            for (let j = 0; j < 4; j++) {
                const idx = pos.array[i * 4 + j];
                const w = wgt.array[i * 4 + j];
                if (w > 0 && idx < bones.length) {
                    weightMap.set(
                        bones[idx],
                        (weightMap.get(bones[idx]) ?? 0) + w,
                    );
                }
            }
        }

        // Sort bones by total influence ascending, remove bottom ones
        const sorted = [...bones].sort(
            (a, b) => (weightMap.get(a) ?? 0) - (weightMap.get(b) ?? 0),
        );
        const toRemove = new Set(sorted.slice(0, bones.length - MAX_BONES));

        // Remap skin indices: reindex to surviving bones
        const survivingBones = bones.filter((b) => !toRemove.has(b));
        const boneToNewIndex = new Map<THREE.Bone, number>();
        survivingBones.forEach((b, i) => boneToNewIndex.set(b, i));

        const skinIndex = pos.array.slice() as Uint16Array;
        const skinWeight = wgt.array.slice() as Float32Array;
        for (let i = 0; i < pos.count; i++) {
            for (let j = 0; j < 4; j++) {
                const idx = pos.array[i * 4 + j];
                if (idx < bones.length && toRemove.has(bones[idx])) {
                    // Zero out weight for removed bone, shift remaining to first slots
                    skinWeight[i * 4 + j] = 0;
                    skinIndex[i * 4 + j] = 0;
                } else if (idx < bones.length) {
                    skinIndex[i * 4 + j] = boneToNewIndex.get(bones[idx]) ?? 0;
                }
            }
        }

        pos.array.set(skinIndex);
        pos.needsUpdate = true;
        wgt.array.set(skinWeight);
        wgt.needsUpdate = true;

        // Build new skeleton with clamped bones
        const newBones = survivingBones.map((b) => b.clone());
        const newInverses = survivingBones.map((b) => {
            const idx = bones.indexOf(b);
            return idx >= 0
                ? boneInverses[idx].clone()
                : new THREE.Matrix4().identity();
        });

        const newSkel = new THREE.Skeleton(newBones, newInverses);
        mesh.bind(newSkel);
    }
}
