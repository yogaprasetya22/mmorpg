import * as THREE from "three";

// Zero-allocation raycaster setup
const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true;
const origin = new THREE.Vector3();
const direction = new THREE.Vector3(0, -1, 0); // Downward

// Global list of meshes to raycast against
export const colliders: THREE.Mesh[] = [];
export const nonInstancedColliders: THREE.Mesh[] = [];
if (typeof window !== "undefined") {
    (window as any).globalColliders = colliders;
    (window as any).globalNonInstancedColliders = nonInstancedColliders;
}

let cachedTerrainMesh: THREE.Mesh | null = null;

export const registerCollider = (obj: THREE.Object3D) => {
    if (!obj) return;
    obj.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.name === "terrain") {
                cachedTerrainMesh = mesh;
            }
            if (!colliders.includes(mesh)) {
                colliders.push(mesh);
                if (!(mesh as any).isInstancedMesh) {
                    nonInstancedColliders.push(mesh);
                }
            }
        }
    });
};

export const unregisterCollider = (obj: THREE.Object3D) => {
    if (!obj) return;
    obj.traverse((child: THREE.Object3D) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh === cachedTerrainMesh) {
                cachedTerrainMesh = null;
            }
            const idx = colliders.indexOf(mesh);
            if (idx !== -1) {
                colliders.splice(idx, 1);
            }
            const idxN = nonInstancedColliders.indexOf(mesh);
            if (idxN !== -1) {
                nonInstancedColliders.splice(idxN, 1);
            }
        }
    });
};

export const getGroundHeight = (
    x: number,
    z: number,
    fallbackY: number,
): number => {
    // 1. HIGH-SPEED BVH DIRECT RAYCAST:
    // If we have a cached terrain mesh, only raycast against it directly!
    // This is extremely fast (O(log N) due to three-mesh-bvh) and avoids scanning hundreds of tree meshes!
    if (cachedTerrainMesh) {
        origin.set(x, 200, z);
        raycaster.set(origin, direction);
        const hits = raycaster.intersectObject(cachedTerrainMesh, false);
        if (hits.length > 0) {
            return hits[0].point.y;
        }
        return fallbackY;
    }

    if (colliders.length === 0) return fallbackY;

    // 2. SLOW FALLBACK (only if terrain is not yet loaded/registered):
    origin.set(x, 200, z);
    raycaster.set(origin, direction);

    const hits = raycaster.intersectObjects(colliders, false);
    if (hits.length > 0) {
        const terrainHit = hits.find(
            (h: THREE.Intersection) => h.object.name === "terrain",
        );
        if (terrainHit) {
            return terrainHit.point.y;
        }
        return hits[0].point.y;
    }

    return fallbackY;
};

if (typeof window !== "undefined")
    (window as any).getGroundHeight = getGroundHeight;
