import * as THREE from "three";

/**
 * Cached material library — deduplicate material instances.
 *
 * Pattern from `pascalorg/editor`'s material cache:
 * - Materials keyed by (type, color, opacity, ...)
 * - Cached materials tagged with userData.__cached = true
 *   so dispose functions skip destroying shared instances.
 */

const materialCache = new Map<string, THREE.Material>();

export type MaterialDescriptor = {
    type: "standard" | "lambert" | "basic";
    color?: string | number;
    opacity?: number;
    transparent?: boolean;
    roughness?: number;
    metalness?: number;
};

function descriptorKey(desc: MaterialDescriptor): string {
    return `${desc.type}|${desc.color ?? "default"}|${desc.opacity ?? 1}|${desc.transparent ?? false}|${desc.roughness ?? 0.5}|${desc.metalness ?? 0}`;
}

export function getCachedMaterial(desc: MaterialDescriptor): THREE.Material {
    const key = descriptorKey(desc);
    let mat = materialCache.get(key);
    if (mat) return mat;

    const color = desc.color ?? 0xffffff;

    switch (desc.type) {
        case "lambert":
            mat = new THREE.MeshLambertMaterial({
                color,
                opacity: desc.opacity ?? 1,
                transparent: desc.transparent ?? false,
            });
            break;
        case "basic":
            mat = new THREE.MeshBasicMaterial({
                color,
                opacity: desc.opacity ?? 1,
                transparent: desc.transparent ?? false,
            });
            break;
        default:
            // standard
            mat = new THREE.MeshStandardMaterial({
                color,
                opacity: desc.opacity ?? 1,
                transparent: desc.transparent ?? false,
                roughness: desc.roughness ?? 0.5,
                metalness: desc.metalness ?? 0,
            });
            break;
    }

    mat.userData.__cached = true;
    materialCache.set(key, mat);
    return mat;
}

export function isCachedMaterial(value: unknown): boolean {
    return Boolean(
        (value as { userData?: { __cached?: boolean } } | null)?.userData
            ?.__cached,
    );
}

export function clearMaterialCache(): void {
    for (const mat of materialCache.values()) {
        mat.dispose();
    }
    materialCache.clear();
}
