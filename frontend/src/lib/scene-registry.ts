import * as THREE from "three";

/**
 * Scene registry — flat Map<id, Object3D> for imperative entity lookups.
 *
 * Systems (EntityUpdateSystem, MonsterAI) find objects by ID in O(1)
 * without walking the React/R3F scene tree.
 *
 * Pattern from `pascalorg/editor` — the geometry system reads the registry
 * to find the group to inject built children into.
 */
export const sceneRegistry = {
    nodes: new Map<string, THREE.Object3D>(),
    byType: new Map<string, Set<string>>(),

    clear() {
        this.nodes.clear();
        this.byType.clear();
    },
};
